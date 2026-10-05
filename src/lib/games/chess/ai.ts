import { Chess, type Color, type Move as CjMove, type PieceSymbol } from "chess.js";
import type { Suggestion } from "../types";
import {
  chess,
  colorOf,
  load,
  PIECE_NAMES,
  VARIANTS,
  type ChessMove,
  type ChessState,
} from "./engine";

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 300, b: 310, r: 500, q: 900, k: 0 };
const CENTER = new Set(["d4", "e4", "d5", "e5"]);

function evaluate(c: Chess, me: Color, promotionWins: boolean): number {
  let score = 0;
  for (const row of c.board()) {
    for (const sq of row) {
      if (!sq) continue;
      let v = VALUE[sq.type];
      if (CENTER.has(sq.square) && (sq.type === "p" || sq.type === "n")) v += 15;
      if (sq.type === "p" && promotionWins) {
        const rank = Number(sq.square[1]);
        const advance = sq.color === "w" ? rank - 2 : 7 - rank;
        v += advance * advance * 6;
      }
      score += sq.color === me ? v : -v;
    }
  }
  return score;
}

function search(c: Chess, depth: number, alpha: number, beta: number, me: Color, promotionWins: boolean): number {
  if (c.isCheckmate()) return c.turn() === me ? -100000 - depth : 100000 + depth;
  if (c.isDraw() || c.isStalemate()) return 0;
  if (depth === 0) return evaluate(c, me, promotionWins);
  const moves = c.moves({ verbose: true });
  // Capturas primero: mejor poda
  moves.sort((a, b) => (b.captured ? VALUE[b.captured] : 0) - (a.captured ? VALUE[a.captured] : 0));
  const maximizing = c.turn() === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    c.move(m);
    const v = search(c, depth - 1, alpha, beta, me, promotionWins);
    c.undo();
    if (maximizing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function suggestChess(state: ChessState): Suggestion<ChessMove> | null {
  if (chess.status(state).kind !== "playing") return null;
  const base = load(state);
  const c = new Chess(base.fen());
  const me = c.turn();
  const promotionWins = VARIANTS[state.variant].promotionWins;
  const moves = c.moves({ verbose: true });
  if (moves.length === 0) return null;

  let best: CjMove | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    c.move(m);
    let v: number;
    if (promotionWins && m.isPromotion()) v = 90000;
    else v = search(c, 2, -Infinity, Infinity, me, promotionWins);
    c.undo();
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
  }
  if (!best) return null;

  const move: ChessMove = { from: best.from, to: best.to, promotion: best.promotion as ChessMove["promotion"] };
  const opp: Color = me === "w" ? "b" : "w";
  const wasAttacked = c.isAttacked(best.from, opp);
  c.move(best);
  const givesMate = c.isCheckmate();
  const givesCheck = c.inCheck();
  const nowAttacked = c.isAttacked(best.to, me === "w" ? "b" : "w");
  c.undo();

  let reason: string;
  if (givesMate) reason = "¡Esa jugada es jaque mate!";
  else if (best.isPromotion()) reason = promotionWins ? "¡Coronas y ganas la partida!" : "Coronas: tu peón se convierte en dama.";
  else if (best.captured && VALUE[best.captured] >= 300) reason = `Capturas ${articulo(best.captured)} ${PIECE_NAMES[best.captured]}${nowAttacked ? ", aunque podrían recapturar" : " sin riesgo"}.`;
  else if (best.captured) reason = `Capturas un peón${nowAttacked ? "" : " sin riesgo"}.`;
  else if (givesCheck) reason = "Das jaque: obligas a tu pareja a defender su rey.";
  else if (wasAttacked && !nowAttacked) reason = `Pones a salvo tu ${PIECE_NAMES[best.piece]}, que estaba amenazada.`;
  else if (CENTER.has(best.to)) reason = `Lleva tu ${PIECE_NAMES[best.piece]} al centro, donde controla más casillas.`;
  else if (best.piece === "n" || best.piece === "b") reason = `Desarrolla tu ${PIECE_NAMES[best.piece]}: sal con las piezas antes de atacar.`;
  else reason = "Es una jugada sólida que no deja piezas sin defender.";

  return { move, reason };
}

function articulo(p: PieceSymbol) {
  return p === "q" || p === "r" ? "una" : "un";
}

export { colorOf };
