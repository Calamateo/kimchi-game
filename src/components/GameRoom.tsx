"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  opponentOf,
  sideOf,
  userOf,
  type GameRow,
  type ProfileRow,
  type UndoRequestRow,
} from "@/lib/db";
import { GAMES } from "@/lib/games/registry";
import { TUTORIALS } from "@/lib/games/tutorials";
import { countPieces, type CheckersState } from "@/lib/games/checkers/engine";
import { count as reversiCount, type ReversiState } from "@/lib/games/reversi/engine";
import { GameBoard } from "./games/GameBoard";
import { Button, Dot, Sheet, Toast } from "./ui";

interface Props {
  initialGame: GameRow;
  userId: string;
  profiles: ProfileRow[];
}

const EMOJIS = ["👏", "😄", "🤔", "😮", "❤️", "😅"];

export function GameRoom({ initialGame, userId, profiles }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [game, setGame] = useState<GameRow>(initialGame);
  const [undo, setUndo] = useState<UndoRequestRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [connected, setConnected] = useState(true);
  const [reaction, setReaction] = useState<{ emoji: string; mine: boolean; id: number } | null>(null);
  // La pista va ligada al ply para el que se pidió: desaparece sola al mover.
  const [hintFor, setHintFor] = useState<{ ply: number; move: unknown } | null>(null);
  const gameRef = useRef(game);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reactionSeq = useRef(0);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const meta = GAMES[game.type];
  const engine = meta.engine!;
  const mySide = sideOf(game, userId) ?? "A";
  const partnerId = opponentOf(game, userId);
  const me = profiles.find((p) => p.id === userId);
  const partnerName = profiles.find((p) => p.id === partnerId)?.display_name ?? "tu pareja";
  const myName = me?.display_name ?? "tú";
  const guide = me?.settings?.guide_mode ?? true;
  const showHints = me?.settings?.show_hints ?? true;

  const isMyTurn = game.status === "active" && game.turn === userId;
  const hint = hintFor && hintFor.ply === game.ply ? hintFor.move : null;
  const lastMoverIsMe =
    game.ply > 0 &&
    game.result !== "resign" &&
    userOf(game, engine.currentPlayer(game.state)) === partnerId;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const refetch = useCallback(async () => {
    const [{ data: g }, { data: u }] = await Promise.all([
      supabase.from("games").select("*").eq("id", initialGame.id).maybeSingle(),
      supabase
        .from("undo_requests")
        .select("*")
        .eq("game_id", initialGame.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
    if (g) setGame(g as GameRow);
    setUndo((u as UndoRequestRow | null) ?? null);
  }, [supabase, initialGame.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`game:${initialGame.id}`, { config: { presence: { key: userId } } })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${initialGame.id}` },
        (payload) => {
          const next = payload.new as GameRow;
          // Acepta estados más nuevos o un deshacer (ply menor con updated_at posterior).
          if (next.ply >= gameRef.current.ply || next.updated_at > gameRef.current.updated_at) {
            setGame(next);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "undo_requests", filter: `game_id=eq.${initialGame.id}` },
        () => void refetch(),
      )
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const p = payload as { emoji: string; from: string };
        if (p.from === userId) return;
        reactionSeq.current += 1;
        setReaction({ emoji: p.emoji, mine: false, id: reactionSeq.current });
      })
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
    channelRef.current = channel;

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [supabase, initialGame.id, userId, refetch]);

  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 2400);
    return () => clearTimeout(t);
  }, [reaction]);

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
    const nextTurn = st.kind === "playing" ? userOf(current, engine.currentPlayer(newState)) : null;
    const winner = st.kind === "win" ? userOf(current, st.winner) : null;
    const result = st.kind === "win" ? "win" : st.kind === "draw" ? "draw" : null;
    const status = st.kind === "playing" ? "active" : "finished";

    setGame({ ...current, state: newState, ply: current.ply + 1, turn: nextTurn, status, winner, result });

    setBusy(true);
    const { error } = await supabase.rpc("make_move", {
      p_game_id: current.id,
      p_expected_ply: current.ply,
      p_move: move,
      p_new_state: newState,
      p_next_turn: nextTurn,
      p_status: status,
      p_winner: winner,
      p_result: result,
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

  function askHint() {
    if (!engine.suggest) return;
    const s = engine.suggest(game.state);
    if (!s) return;
    setHintFor({ ply: game.ply, move: s.move });
    showToast(`💡 ${s.reason}`);
  }

  async function requestUndo() {
    setBusy(true);
    const { error } = await supabase.rpc("request_undo", { p_game_id: game.id });
    setBusy(false);
    if (error) showToast(error.message);
    else {
      showToast(`Le pedimos a ${partnerName} deshacer tu última jugada.`);
      void refetch();
    }
  }

  async function respondUndo(accept: boolean) {
    if (!undo) return;
    setBusy(true);
    const { error } = await supabase.rpc("respond_undo", { p_request_id: undo.id, p_accept: accept });
    setBusy(false);
    if (error) showToast(error.message);
    void refetch();
  }

  async function cancelUndo() {
    if (!undo) return;
    await supabase.rpc("cancel_undo", { p_request_id: undo.id });
    void refetch();
  }

  function react(emoji: string) {
    reactionSeq.current += 1;
    setReaction({ emoji, mine: true, id: reactionSeq.current });
    void channelRef.current?.send({
      type: "broadcast",
      event: "react",
      payload: { emoji, from: userId },
    });
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
    const state = engine.initialState(
      first === userId ? "A" : "B",
      engine.rematchOptions?.(game.state),
    );
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

  const undoIsMine = undo?.requested_by === userId;
  const tutorial = TUTORIALS[game.type];

  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-6 pt-4 lg:max-w-4xl lg:flex-row lg:items-start lg:gap-8">
      <Toast message={toast} />

      {reaction && (
        <div
          key={reaction.id}
          className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center ${
            reaction.mine ? "bottom-28" : "top-1/3"
          }`}
        >
          <span className={`pop drop-shadow-lg ${reaction.mine ? "text-5xl" : "text-7xl"}`}>
            {reaction.emoji}
          </span>
        </div>
      )}

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
            {!connected && <span className="pulse-soft text-xs text-muted">· reconectando</span>}
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

        {undo && undoIsMine && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-line">
            <span className="pulse-soft flex-1 font-semibold">
              Esperando a que {partnerName} acepte deshacer tu jugada…
            </span>
            <button onClick={cancelUndo} className="tap font-bold text-muted">
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col lg:order-1">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-18rem))]">
          <GameBoard
            type={game.type}
            state={game.state}
            mySide={mySide}
            canPlay={isMyTurn && !busy}
            onMove={onMove}
            explain={showToast}
            partnerName={partnerName}
            guide={guide}
            hint={hint}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold text-muted">
          <span>
            {meta.label?.(game.state) ? `${meta.label(game.state)} · ` : ""}
            Tú juegas con <span className="text-ink">{meta.sideName(mySide, game.state)}</span>
          </span>
          <Score game={game} mySide={mySide} myName={myName} partnerName={partnerName} />
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => setRulesOpen(true)}>
            📖 Reglas
          </Button>
          {isMyTurn && showHints && engine.suggest && (
            <Button variant="secondary" onClick={askHint}>
              💡 Pista
            </Button>
          )}
          {lastMoverIsMe && !undo && (
            <Button variant="secondary" onClick={requestUndo} disabled={busy}>
              ↩ Deshacer
            </Button>
          )}
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

        <div className="mt-4 flex justify-center gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => react(e)}
              aria-label={`Enviar ${e}`}
              className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface text-2xl ring-1 ring-line active:scale-90"
            >
              {e}
            </button>
          ))}
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
        {tutorial && (
          <Link
            href={`/tutorial/${game.type}`}
            className="tap mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-surface-2 font-bold"
          >
            🎓 Ver el tutorial paso a paso
          </Link>
        )}
      </Sheet>

      <Sheet
        open={!!undo && !undoIsMine}
        onClose={() => respondUndo(false)}
        title="Petición de deshacer"
      >
        <p className="text-lg leading-snug">
          {partnerName} quiere deshacer su última jugada. ¿Le das chance?
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => respondUndo(false)} disabled={busy}>
            Ahora no
          </Button>
          <Button className="flex-1" onClick={() => respondUndo(true)} disabled={busy}>
            Sí, deshacer
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

function Score({
  game,
  mySide,
  myName,
  partnerName,
}: {
  game: GameRow;
  mySide: "A" | "B";
  myName: string;
  partnerName: string;
}) {
  const theirSide = mySide === "A" ? "B" : "A";
  let mine: number;
  let theirs: number;
  let colors: [string, string];
  if (game.type === "checkers") {
    const s = game.state as CheckersState;
    mine = countPieces(s.board, mySide);
    theirs = countPieces(s.board, theirSide);
    colors = ["bg-piece-a", "bg-piece-b"];
  } else if (game.type === "reversi") {
    const s = game.state as ReversiState;
    mine = reversiCount(s.board, mySide);
    theirs = reversiCount(s.board, theirSide);
    colors = ["bg-piece-b", "bg-[#f7f3ea] ring-1 ring-line"];
  } else {
    return null;
  }
  const myColor = mySide === "A" ? colors[0] : colors[1];
  const theirColor = mySide === "A" ? colors[1] : colors[0];
  return (
    <span className="flex items-center gap-3">
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-4 w-4 rounded-full ${myColor}`} />
        {myName}: <span className="text-ink">{mine}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-4 w-4 rounded-full ${theirColor}`} />
        {partnerName}: <span className="text-ink">{theirs}</span>
      </span>
    </span>
  );
}
