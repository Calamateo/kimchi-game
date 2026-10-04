import type { GameType, Side } from "@/lib/db";

export type Player = Side;

export type GameStatus =
  | { kind: "playing" }
  | { kind: "win"; winner: Player }
  | { kind: "draw" };

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
}

export const other = (p: Player): Player => (p === "A" ? "B" : "A");
