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

/**
 * Pista de ajedrez: búsqueda de 2 plies (mi jugada + respuesta) con
 * "quiescencia" de capturas para no sugerir piezas colgadas. Pensada para
 * responder en menos de medio segundo en un teléfono.
 */

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 300, b: 310, r: 500, q: 900, k: 0 };
const CENTER = new Set(["d4", "e4", "d5", "e5"]);
const MATE = 100000;

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

function orderMoves(moves: CjMove[]) {
  moves.sort(
    (a, b) =>
      (b.captured ? VALUE[b.captured] : 0) + (b.promotion ? 800 : 0) -
      ((a.captured ? VALUE[a.captured] : 0) + (a.promotion ? 800 : 0)),
  );
  return moves;
}

/**
 * En los nodos internos usamos la notación SAN (sin `verbose`), que es mucho
 * más barata: `x` marca captura y `=` coronación. Las capturas van primero.
 */
function orderSan(sans: string[]) {
  const weight = (s: string) => (s.includes("=") ? 2 : 0) + (s.includes("x") ? 1 : 0);
  return sans.sort((a, b) => weight(b) - weight(a));
}

function terminal(c: Chess, count: number, me: Color, depth: number): number | null {
  if (count === 0) {
    if (!c.inCheck()) return 0;
    return c.turn() === me ? -MATE - depth : MATE + depth;
  }
  return null;
}

/** Solo capturas y coronaciones, para estabilizar la evaluación. */
function quiesce(c: Chess, alpha: number, beta: number, me: Color, pw: boolean, depth: number): number {
  const sans = c.moves();
  const t = terminal(c, sans.length, me, depth);
  if (t !== null) return t;
  const stand = evaluate(c, me, pw);
  if (depth === 0) return stand;
  const tactical = orderSan(sans.filter((s) => s.includes("x") || s.includes("=")));
  if (tactical.length === 0) return stand;
  const maximizing = c.turn() === me;
  let best = stand;
  if (maximizing) alpha = Math.max(alpha, stand);
  else beta = Math.min(beta, stand);
  for (const m of tactical) {
    c.move(m);
    const v = quiesce(c, alpha, beta, me, pw, depth - 1);
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

function search(c: Chess, depth: number, alpha: number, beta: number, me: Color, pw: boolean): number {
  const moves = orderSan(c.moves());
  const t = terminal(c, moves.length, me, depth);
  if (t !== null) return t;
  if (c.isInsufficientMaterial()) return 0;
  if (depth === 0) return quiesce(c, alpha, beta, me, pw, 3);
  const maximizing = c.turn() === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    c.move(m);
    const v = search(c, depth - 1, alpha, beta, me, pw);
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
  const c = new Chess(load(state).fen());
  const me = c.turn();
  const opp: Color = me === "w" ? "b" : "w";
  const promotionWins = VARIANTS[state.variant].promotionWins;
  const moves = orderMoves(c.moves({ verbose: true }));
  if (moves.length === 0) return null;

  // Pasada 1: evaluación rápida (capturas forzadas) de todas las jugadas.
  const scored = moves.map((m) => {
    c.move(m);
    const v = promotionWins && m.promotion ? MATE - 1 : quiesce(c, -Infinity, Infinity, me, promotionWins, 2);
    c.undo();
    return { m, v };
  });
  scored.sort((a, b) => b.v - a.v);

  // Pasada 2: las mejores candidatas se revisan con la respuesta de la pareja.
  const candidates = scored.slice(0, 8);
  let best: CjMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const { m, v: quick } of candidates) {
    c.move(m);
    const v = quick >= MATE - 1 ? quick : search(c, 1, alpha, Infinity, me, promotionWins);
    c.undo();
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
    alpha = Math.max(alpha, v);
  }
  if (!best) return null;

  const move: ChessMove = { from: best.from, to: best.to, promotion: best.promotion as ChessMove["promotion"] };
  const wasAttacked = c.isAttacked(best.from, opp);
  c.move(best);
  const replies = c.moves();
  const givesCheck = c.inCheck();
  const givesMate = givesCheck && replies.length === 0;
  const nowAttacked = c.isAttacked(best.to, opp);
  c.undo();

  let reason: string;
  if (givesMate) reason = "¡Esa jugada es jaque mate!";
  else if (best.promotion) reason = promotionWins ? "¡Coronas y ganas la partida!" : "Coronas: tu peón se convierte en dama.";
  else if (best.captured && VALUE[best.captured] >= 300) {
    reason = `Capturas ${articulo(best.captured)} ${PIECE_NAMES[best.captured]}${nowAttacked ? ", aunque podrían recapturar" : " sin riesgo"}.`;
  } else if (best.captured) reason = `Capturas un peón${nowAttacked ? "" : " sin riesgo"}.`;
  else if (givesCheck) reason = "Das jaque: obligas a tu pareja a defender su rey.";
  else if (wasAttacked && !nowAttacked) reason = `Pones a salvo tu ${PIECE_NAMES[best.piece]}, que estaba amenazada.`;
  else if (CENTER.has(best.to)) reason = `Lleva tu ${PIECE_NAMES[best.piece]} al centro, donde controla más casillas.`;
  else if (best.piece === "n" || best.piece === "b") reason = `Desarrolla tu ${PIECE_NAMES[best.piece]}: sal con las piezas antes de atacar.`;
  else if (best.piece === "p" && promotionWins) reason = "Avanza el peón: aquí gana quien corona primero.";
  else reason = "Es una jugada sólida que no deja piezas sin defender.";

  return { move, reason };
}

function articulo(p: PieceSymbol) {
  return p === "q" || p === "r" ? "una" : "un";
}

export { colorOf };
