"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { opponentOf, type GameRow, type GameType, type ProfileRow } from "@/lib/db";
import { GAMES, GAME_ORDER } from "@/lib/games/registry";
import { timeAgo } from "@/lib/time";
import { Button, Card, Dot, Sheet, Toast } from "./ui";

interface Props {
  userId: string;
  profiles: ProfileRow[];
  initialGames: GameRow[];
}

export function Lobby({ userId, profiles, initialGames }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [games, setGames] = useState<GameRow[]>(initialGames);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);

  const me = profiles.find((p) => p.id === userId);
  const partner = profiles.find((p) => p.id !== userId);
  const nameOf = useCallback(
    (id: string | null) => profiles.find((p) => p.id === id)?.display_name ?? "…",
    [profiles],
  );

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("games")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(60);
    if (data) setGames(data as GameRow[]);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("lobby")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => void refetch(),
      )
      .subscribe();

    const presence = supabase.channel("presence:lobby", {
      config: { presence: { key: userId } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        setPartnerOnline(Object.keys(state).some((k) => k !== userId));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence.track({ at: Date.now() });
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(presence);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [supabase, refetch, userId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function createGame(type: GameType) {
    const meta = GAMES[type];
    if (!meta.available || !meta.engine || !partner) return;
    setCreating(true);
    // Alterna quién empieza respecto a la partida más reciente.
    const last = games[0];
    const first =
      last ? (last.first_player === userId ? partner.id : userId) : userId;
    const state = meta.engine.initialState(first === userId ? "A" : "B");
    const { data, error } = await supabase
      .from("games")
      .insert({
        type,
        player_a: userId,
        player_b: partner.id,
        first_player: first,
        turn: first,
        state,
        created_by: userId,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      showToast("No se pudo crear la partida. Intenta de nuevo.");
      return;
    }
    setSheetOpen(false);
    router.push(`/partida/${data.id}`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const active = games.filter((g) => g.status === "active");
  const myTurn = active.filter((g) => g.turn === userId);
  const theirTurn = active.filter((g) => g.turn !== userId);
  const finished = games.filter((g) => g.status !== "active").slice(0, 10);

  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <Toast message={toast} />

      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Hola,</p>
          <h1 className="text-3xl font-extrabold leading-tight">
            {me?.display_name ?? "…"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {partner && (
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm font-semibold ring-1 ring-line">
              <Dot online={partnerOnline} />
              {partner.display_name}
            </div>
          )}
          <button
            onClick={signOut}
            className="tap rounded-full bg-surface px-3 py-2 text-sm font-semibold text-muted ring-1 ring-line"
          >
            Salir
          </button>
        </div>
      </header>

      <Section title="Tu turno" empty="Nada pendiente por ahora." games={myTurn}>
        {(g) => <GameItem game={g} nameOf={nameOf} userId={userId} highlight />}
      </Section>

      <Section
        title={partner ? `Esperando a ${partner.display_name}` : "Esperando"}
        empty="Ninguna partida en espera."
        games={theirTurn}
      >
        {(g) => <GameItem game={g} nameOf={nameOf} userId={userId} />}
      </Section>

      {finished.length > 0 && (
        <Section title="Terminadas" empty="" games={finished}>
          {(g) => <GameItem game={g} nameOf={nameOf} userId={userId} />}
        </Section>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex justify-center bg-gradient-to-t from-bg via-bg/90 to-transparent px-4 pb-4 pt-8">
        <Button size="lg" className="w-full max-w-lg" onClick={() => setSheetOpen(true)}>
          ＋ Nueva partida
        </Button>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="¿Qué jugamos?">
        <ul className="flex flex-col gap-2">
          {GAME_ORDER.map((id) => {
            const g = GAMES[id];
            return (
              <li key={id}>
                <button
                  disabled={!g.available || creating}
                  onClick={() => createGame(id)}
                  className="tap flex w-full items-center gap-4 rounded-2xl bg-surface-2 p-4 text-left disabled:opacity-50"
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-lg font-extrabold">{g.name}</span>
                    <span className="block text-sm text-muted">{g.tagline}</span>
                  </span>
                  {!g.available && (
                    <span className="rounded-full bg-surface px-2 py-1 text-xs font-bold text-muted">
                      Pronto
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </main>
  );
}

function Section({
  title,
  empty,
  games,
  children,
}: {
  title: string;
  empty: string;
  games: GameRow[];
  children: (g: GameRow) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-extrabold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {games.length === 0 ? (
        <p className="px-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((g) => (
            <li key={g.id}>{children(g)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GameItem({
  game,
  nameOf,
  userId,
  highlight = false,
}: {
  game: GameRow;
  nameOf: (id: string | null) => string;
  userId: string;
  highlight?: boolean;
}) {
  const meta = GAMES[game.type];
  let detail: string;
  if (game.status === "active") {
    detail = game.turn === userId ? "Te toca jugar" : `Turno de ${nameOf(game.turn)}`;
  } else if (game.result === "draw") {
    detail = "Empate";
  } else if (game.winner === userId) {
    detail = "Ganaste";
  } else {
    detail = `Ganó ${nameOf(game.winner)}`;
  }
  return (
    <Link href={`/partida/${game.id}`} className="block">
      <Card
        className={`flex items-center gap-4 ${
          highlight ? "ring-2 ring-accent" : ""
        }`}
      >
        <span className="text-3xl">{meta.emoji}</span>
        <span className="flex-1">
          <span className="block text-lg font-extrabold">
            {meta.name} con {nameOf(opponentOf(game, userId))}
          </span>
          <span className="block text-sm text-muted">
            {detail} · {timeAgo(game.updated_at)}
          </span>
        </span>
        <span className="text-muted">›</span>
      </Card>
    </Link>
  );
}
