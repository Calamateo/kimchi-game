import { minimax, other, type Player, type Suggestion } from "../types";
import {
  checkers,
  isJumpStep,
  isKing,
  rawMoves,
  row,
  sideOfPiece,
  type CheckersMove,
  type CheckersState,
} from "./engine";

function evaluate(state: CheckersState, me: Player): number {
  let score = 0;
  state.board.forEach((p, i) => {
    if (!p) return;
    const side = sideOfPiece(p);
    let v = isKing(p) ? 1.6 : 1;
    if (!isKing(p)) {
      // Pequeño premio por avanzar
      const advance = side === "A" ? 7 - row(i) : row(i);
      v += advance * 0.03;
    }
    score += side === me ? v : -v;
  });
  return score;
}

export function suggestCheckers(state: CheckersState): Suggestion<CheckersMove> | null {
  const moves = checkers.legalMoves(state);
  if (moves.length === 0) return null;
  const me = state.current;

  const { move } = minimax(checkers, state, 4, me, evaluate);
  const best = move ?? moves[0];

  const captures = best.path.filter((_, i) => i > 0 && isJumpStep(best.path[i - 1], best.path[i])).length;
  const after = checkers.applyMove(state, best);
  const piece = state.board[best.path[0]]!;
  const endsKing = !isKing(piece) && isKing(after.board[best.path[best.path.length - 1]]!);
  const theirCaptures = rawMoves({ ...after, current: other(me) }).some((m) =>
    isJumpStep(m.path[0], m.path[1]),
  );

  let reason: string;
  if (captures >= 2) reason = `Capturas ${captures} piezas de un solo salto en cadena.`;
  else if (captures === 1 && endsKing) reason = "Capturas una pieza y además coronas.";
  else if (captures === 1) reason = theirCaptures
    ? "Capturas una pieza. Tu pareja podrá responder, pero es la mejor opción."
    : "Capturas una pieza y quedas a salvo.";
  else if (endsKing) reason = "Llegas al fondo y coronas una dama.";
  else if (!theirCaptures) reason = "Es una jugada segura: después de moverte, tu pareja no puede capturarte.";
  else reason = "Es la opción que menos piezas pone en riesgo.";

  return { move: best, reason };
}
