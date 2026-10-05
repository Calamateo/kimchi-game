import {
  minimax,
  other,
  type GameEngine,
  type GameStatus,
  type Player,
} from "../types";

export interface ReversiState {
  board: (Player | null)[];
  current: Player;
  last: { cell: number; flipped: number[] } | null;
  /** true si el jugador anterior tuvo que pasar por falta de jugadas */
  skipped: boolean;
}

export interface ReversiMove {
  cell: number;
}

const row = (i: number) => i >> 3;
const col = (i: number) => i & 7;
const at = (r: number, c: number) => r * 8 + c;
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export const CORNERS = [0, 7, 56, 63];

/** Piezas que se voltearían al colocar en `cell`. Vacío si la jugada no es válida. */
export function flipsFor(board: (Player | null)[], cell: number, player: Player): number[] {
  if (board[cell] !== null) return [];
  const out: number[] = [];
  const r0 = row(cell);
  const c0 = col(cell);
  for (const [dr, dc] of DIRS) {
    const run: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (inBounds(r, c) && board[at(r, c)] === other(player)) {
      run.push(at(r, c));
      r += dr;
      c += dc;
    }
    if (run.length > 0 && inBounds(r, c) && board[at(r, c)] === player) {
      out.push(...run);
    }
  }
  return out;
}

export function movesFor(board: (Player | null)[], player: Player): ReversiMove[] {
  const moves: ReversiMove[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === null && flipsFor(board, i, player).length > 0) moves.push({ cell: i });
  }
  return moves;
}

export function count(board: (Player | null)[], player: Player) {
  return board.filter((p) => p === player).length;
}

function status(state: ReversiState): GameStatus {
  const { board } = state;
  if (movesFor(board, "A").length > 0 || movesFor(board, "B").length > 0) {
    return { kind: "playing" };
  }
  const a = count(board, "A");
  const b = count(board, "B");
  if (a === b) return { kind: "draw" };
  return { kind: "win", winner: a > b ? "A" : "B" };
}

function validCell(cell: unknown): cell is number {
  return Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < 64;
}

const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -40, -2, -2, -2, -2, -40, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -40, -2, -2, -2, -2, -40, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

function evaluate(state: ReversiState, me: Player): number {
  const { board } = state;
  const empties = board.filter((p) => p === null).length;
  let score = 0;
  if (empties <= 12) {
    // Final: lo que importa es el conteo
    score += (count(board, me) - count(board, other(me))) * 10;
  } else {
    for (let i = 0; i < 64; i++) {
      if (board[i] === me) score += WEIGHTS[i];
      else if (board[i] !== null) score -= WEIGHTS[i];
    }
    score += (movesFor(board, me).length - movesFor(board, other(me)).length) * 4;
  }
  return score;
}

export const reversi: GameEngine<ReversiState, ReversiMove> = {
  id: "reversi",

  initialState(first) {
    const board = Array<Player | null>(64).fill(null);
    board[at(3, 3)] = "B";
    board[at(4, 4)] = "B";
    board[at(3, 4)] = "A";
    board[at(4, 3)] = "A";
    return { board, current: first, last: null, skipped: false };
  },

  currentPlayer(state) {
    return state.current;
  },

  legalMoves(state) {
    if (status(state).kind !== "playing") return [];
    return movesFor(state.board, state.current);
  },

  isLegal(state, move) {
    return (
      !!move &&
      validCell(move.cell) &&
      status(state).kind === "playing" &&
      flipsFor(state.board, move.cell, state.current).length > 0
    );
  },

  applyMove(state, move) {
    if (!this.isLegal(state, move)) throw new Error(this.explainIllegal(state, move));
    const board = [...state.board];
    const flipped = flipsFor(board, move.cell, state.current);
    board[move.cell] = state.current;
    for (const f of flipped) board[f] = state.current;

    // Si la pareja no puede mover pero yo sí, me toca otra vez.
    const next = other(state.current);
    const skipped = movesFor(board, next).length === 0 && movesFor(board, state.current).length > 0;
    return {
      board,
      current: skipped ? state.current : next,
      last: { cell: move.cell, flipped },
      skipped,
    };
  },

  status,

  explainIllegal(state, move) {
    if (status(state).kind !== "playing") return "La partida ya terminó.";
    if (!move || !validCell(move.cell)) return "Esa casilla no existe.";
    if (state.board[move.cell] !== null) return "Esa casilla ya está ocupada.";
    return "Ahí no encierras ninguna pieza de tu pareja. Coloca tu pieza de modo que haya piezas suyas en línea entre la nueva y otra tuya.";
  },

  suggest(state) {
    const me = state.current;
    const moves = this.legalMoves(state);
    if (moves.length === 0) return null;
    const corner = moves.find((m) => CORNERS.includes(m.cell));
    if (corner) {
      return { move: corner, reason: "Una esquina nunca se puede voltear. Tómala." };
    }
    const { move } = minimax(this, state, 3, me, evaluate);
    const best = move ?? moves[0];
    const flips = flipsFor(state.board, best.cell, me).length;
    const after = this.applyMove(state, best);
    const theirMoves = movesFor(after.board, other(me)).length;
    let reason: string;
    if (theirMoves <= 2) reason = "Deja a tu pareja con muy pocas opciones para responder.";
    else if (flips >= 4) reason = `Voltea ${flips} piezas y no regala las esquinas.`;
    else reason = "Es una jugada tranquila: gana terreno sin abrirle esquinas a tu pareja.";
    return { move: best, reason };
  },
};
