"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  opponentOf,
  sideOf,
  userOf,
  type GameRow,
  type ProfileRow,
} from "@/lib/db";
import { GAMES } from "@/lib/games/registry";
import { TicTacToeBoard } from "./games/TicTacToeBoard";
import { CheckersBoard } from "./games/CheckersBoard";
import { countPieces, type CheckersState } from "@/lib/games/checkers/engine";
import { Button, Dot, Sheet, Toast } from "./ui";

interface Props {
  initialGame: GameRow;
  userId: string;
  profiles: ProfileRow[];
}

export function GameRoom({ initialGame, userId, profiles }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [game, setGame] = useState<GameRow>(initialGame);
  const [toast, setToast] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [connected, setConnected] = useState(true);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const meta = GAMES[game.type];
  const engine = meta.engine!;
  const mySide = sideOf(game, userId) ?? "A";
  const partnerId = opponentOf(game, userId);
  const partnerName =
    profiles.find((p) => p.id === partnerId)?.display_name ?? "tu pareja";
  const myName = profiles.find((p) => p.id === userId)?.display_name ?? "tú";

  const isMyTurn = game.status === "active" && game.turn === userId;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("id", initialGame.id)
      .maybeSingle();
    if (data) setGame(data as GameRow);
  }, [supabase, initialGame.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`game:${initialGame.id}`, {
        config: { presence: { key: userId } },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${initialGame.id}`,
        },
        (payload) => {
          const next = payload.new as GameRow;
          // Solo acepta estados más nuevos que el que tenemos.
          if (next.ply >= gameRef.current.ply) setGame(next);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPartnerOnline(Object.keys(state).some((k) => k !== userId));
      })
      .subscribe((s) => {
        setConnected(s === "SUBSCRIBED");
        if (s === "SUBSCRIBED") {
          void channel.track({ at: Date.now() });
          void refetch();
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [supabase, initialGame.id, userId, refetch]);

  async function onMove(move: unknown) {
    const current = gameRef.current;
    if (current.status !== "active") return;
    if (current.turn !== userId) {
      showToast(`Espera, es el turno de ${partnerName}.`);
      return;
    }
    if (!engine.isLegal(current.state, move)) {
      showToast(engine.explainIllegal(current.state, move));
      return;
    }
    const newState = engine.applyMove(current.state, move);
    const st = engine.status(newState);
    const nextTurn =
      st.kind === "playing" ? userOf(current, engine.currentPlayer(newState)) : null;
    const winner = st.kind === "win" ? userOf(current, st.winner) : null;

    // Actualización optimista
    setGame({
      ...current,
      state: newState,
      ply: current.ply + 1,
      turn: nextTurn,
      status: st.kind === "playing" ? "active" : "finished",
      winner,
      result: st.kind === "win" ? "win" : st.kind === "draw" ? "draw" : null,
    });

    setBusy(true);
    const { error } = await supabase.rpc("make_move", {
      p_game_id: current.id,
      p_expected_ply: current.ply,
      p_move: move,
      p_new_state: newState,
      p_next_turn: nextTurn,
      p_status: st.kind === "playing" ? "active" : "finished",
      p_winner: winner,
      p_result: st.kind === "win" ? "win" : st.kind === "draw" ? "draw" : null,
    });
    setBusy(false);
    if (error) {
      showToast(
        error.message.includes("recarga") || error.message.includes("turno")
          ? "La partida cambió. Actualizando…"
          : "No se guardó la jugada. Revisa tu conexión.",
      );
      void refetch();
    }
  }

  async function resign() {
    if (!window.confirm("¿Seguro que quieres rendirte en esta partida?")) return;
    const { error } = await supabase
      .from("games")
      .update({ status: "finished", winner: partnerId, result: "resign", turn: null })
      .eq("id", game.id)
      .eq("status", "active");
    if (error) showToast("No se pudo terminar la partida.");
    else void refetch();
  }

  async function rematch() {
    setBusy(true);
    const first = game.first_player === userId ? partnerId : userId;
    const state = engine.initialState(first === userId ? "A" : "B");
    const { data, error } = await supabase
      .from("games")
      .insert({
        type: game.type,
        player_a: userId,
        player_b: partnerId,
        first_player: first,
        turn: first,
        state,
        created_by: userId,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      showToast("No se pudo crear la revancha.");
      return;
    }
    router.push(`/partida/${data.id}`);
  }

  let banner: { text: string; tone: "mine" | "theirs" | "end" };
  if (game.status === "active") {
    banner = isMyTurn
      ? { text: `Tu turno, ${myName}`, tone: "mine" }
      : { text: `Turno de ${partnerName}`, tone: "theirs" };
  } else if (game.result === "draw") {
    banner = { text: "Empate. ¡Bien jugado!", tone: "end" };
  } else if (game.result === "resign") {
    banner =
      game.winner === userId
        ? { text: `${partnerName} se rindió`, tone: "end" }
        : { text: "Te rendiste en esta partida", tone: "end" };
  } else {
    banner =
      game.winner === userId
        ? { text: `¡Ganaste, ${myName}!`, tone: "end" }
        : { text: `Ganó ${partnerName}. ¡Otra ronda!`, tone: "end" };
  }

  const bannerClass = {
    mine: "bg-accent text-accent-ink",
    theirs: "bg-surface-2 text-ink",
    end: "bg-sage text-white",
  }[banner.tone];

  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-6 pt-4 lg:max-w-4xl lg:flex-row lg:items-start lg:gap-8">
      <Toast message={toast} />

      <div className="flex flex-1 flex-col lg:order-2 lg:w-80 lg:flex-none">
        <header className="mb-3 flex items-center justify-between">
          <Link
            href="/"
            className="tap flex min-h-11 items-center gap-1 rounded-full bg-surface px-4 text-sm font-bold ring-1 ring-line"
          >
            ‹ Inicio
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm font-semibold ring-1 ring-line">
            <Dot online={partnerOnline} />
            {partnerName}
            {!connected && (
              <span className="pulse-soft text-xs text-muted">· reconectando</span>
            )}
          </div>
        </header>

        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-center text-lg font-extrabold ${bannerClass} ${
            banner.tone === "mine" ? "pop" : ""
          }`}
          role="status"
        >
          {banner.text}
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:order-1">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))]">
          {game.type === "tictactoe" && (
            <TicTacToeBoard
              state={game.state as never}
              mySide={mySide}
              canPlay={isMyTurn && !busy}
              onMove={onMove}
            />
          )}
          {game.type === "checkers" && (
            <CheckersBoard
              state={game.state as CheckersState}
              mySide={mySide}
              canPlay={isMyTurn && !busy}
              onMove={onMove}
              explain={showToast}
              partnerName={partnerName}
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-muted">
          {game.type === "tictactoe" && (
            <span>
              {meta.name} · Tú juegas con{" "}
              <span className="text-ink">{mySide === "A" ? "✕" : "◯"}</span>
            </span>
          )}
          {game.type === "checkers" && (
            <CheckersScore
              state={game.state as CheckersState}
              mySide={mySide}
              myName={myName}
              partnerName={partnerName}
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => setRulesOpen(true)}>
            📖 Reglas
          </Button>
          {game.status === "active" ? (
            <Button variant="danger" onClick={resign}>
              Rendirse
            </Button>
          ) : (
            <Button onClick={rematch} disabled={busy}>
              🔁 Otra ronda
            </Button>
          )}
        </div>
      </div>

      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} title={`Reglas de ${meta.name}`}>
        <ol className="flex flex-col gap-3">
          {meta.rules.map((r, i) => (
            <li key={i} className="flex gap-3 text-base leading-snug">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-ink">
                {i + 1}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          Consejo: toca una pieza y luego la casilla a donde quieres ir. Si no se
          puede, te explicamos por qué.
        </p>
      </Sheet>
    </main>
  );
}

function CheckersScore({
  state,
  mySide,
  myName,
  partnerName,
}: {
  state: CheckersState;
  mySide: "A" | "B";
  myName: string;
  partnerName: string;
}) {
  const mine = countPieces(state.board, mySide);
  const theirs = countPieces(state.board, mySide === "A" ? "B" : "A");
  return (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-block h-4 w-4 rounded-full ${
            mySide === "A" ? "bg-piece-a" : "bg-piece-b"
          }`}
        />
        {myName}: <span className="text-ink">{mine}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-block h-4 w-4 rounded-full ${
            mySide === "A" ? "bg-piece-b" : "bg-piece-a"
          }`}
        />
        {partnerName}: <span className="text-ink">{theirs}</span>
      </span>
    </div>
  );
}
