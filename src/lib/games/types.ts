import type { GameType, Side } from "@/lib/db";

export type Player = Side;

export type GameStatus =
  | { kind: "playing" }
  | { kind: "win"; winner: Player }
  | { kind: "draw" };

export interface Suggestion<M> {
  move: M;
  reason: string;
}

/**
 * Contrato que implementa cada juego.
 * Todo es puro y serializable: el estado se guarda tal cual en Postgres.
 */
export interface GameEngine<S, M> {
  id: GameType;
  initialState(first: Player): S;
  currentPlayer(state: S): Player;
  legalMoves(state: S): M[];
  isLegal(state: S, move: M): boolean;
  /** Lanza error si la jugada no es legal. */
  applyMove(state: S, move: M): S;
  status(state: S): GameStatus;
  /** Explicación amable de por qué una jugada no se puede hacer. */
  explainIllegal(state: S, move: M): string;
  /** Pista: una jugada razonable con una razón corta. */
  suggest?(state: S): Suggestion<M> | null;
}

export const other = (p: Player): Player => (p === "A" ? "B" : "A");

/**
 * Minimax con poda alfa-beta genérico. `evaluate` devuelve el valor desde el
 * punto de vista del jugador `me`. Devuelve la mejor jugada para el jugador en turno.
 */
export function minimax<S, M>(
  engine: GameEngine<S, M>,
  state: S,
  depth: number,
  me: Player,
  evaluate: (state: S, me: Player) => number,
): { move: M | null; score: number } {
  const moves = engine.legalMoves(state);
  const st = engine.status(state);
  if (st.kind === "win") {
    return { move: null, score: st.winner === me ? 1000 + depth : -1000 - depth };
  }
  if (st.kind === "draw" || moves.length === 0) return { move: null, score: 0 };
  if (depth === 0) return { move: null, score: evaluate(state, me) };

  const maximizing = engine.currentPlayer(state) === me;
  let best: M | null = null;
  let bestScore = maximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  const search = (s: S, d: number, a: number, b: number): number => {
    const ms = engine.legalMoves(s);
    const stt = engine.status(s);
    if (stt.kind === "win") return stt.winner === me ? 1000 + d : -1000 - d;
    if (stt.kind === "draw" || ms.length === 0) return 0;
    if (d === 0) return evaluate(s, me);
    const max = engine.currentPlayer(s) === me;
    let value = max ? -Infinity : Infinity;
    for (const m of ms) {
      const v = search(engine.applyMove(s, m), d - 1, a, b);
      if (max) {
        value = Math.max(value, v);
        a = Math.max(a, v);
      } else {
        value = Math.min(value, v);
        b = Math.min(b, v);
      }
      if (b <= a) break;
    }
    return value;
  };

  for (const m of moves) {
    const v = search(engine.applyMove(state, m), depth - 1, alpha, beta);
    if (maximizing ? v > bestScore : v < bestScore) {
      bestScore = v;
      best = m;
    }
    if (maximizing) alpha = Math.max(alpha, v);
    else beta = Math.min(beta, v);
  }
  return { move: best, score: bestScore };
}
