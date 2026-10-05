import {
  minimax,
  other,
  type GameEngine,
  type GameStatus,
  type Player,
} from "../types";

export const COLS = 7;
export const ROWS = 6;

export interface C4State {
  /** índice = fila * 7 + columna; fila 0 es la de arriba */
  cells: (Player | null)[];
  current: Player;
  last: number | null;
}

export interface C4Move {
  col: number;
}

const at = (r: number, c: number) => r * COLS + c;

export function dropRow(cells: (Player | null)[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (cells[at(r, col)] === null) return r;
  }
  return -1;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function winningCells(cells: (Player | null)[]): number[] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = cells[at(r, c)];
      if (!p) continue;
      for (const [dr, dc] of DIRS) {
        const line = [at(r, c)];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (cells[at(nr, nc)] !== p) break;
          line.push(at(nr, nc));
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

function status(state: C4State): GameStatus {
  const line = winningCells(state.cells);
  if (line) return { kind: "win", winner: state.cells[line[0]] as Player };
  if (state.cells.slice(0, COLS).every((c) => c !== null)) return { kind: "draw" };
  return { kind: "playing" };
}

function validCol(col: unknown): col is number {
  return Number.isInteger(col) && (col as number) >= 0 && (col as number) < COLS;
}

/** Valor de las ventanas de 4 para el jugador `me`. */
function evaluate(state: C4State, me: Player): number {
  let score = 0;
  const { cells } = state;
  // Preferencia por la columna central
  for (let r = 0; r < ROWS; r++) {
    if (cells[at(r, 3)] === me) score += 3;
    else if (cells[at(r, 3)] === other(me)) score -= 3;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k++) {
          const v = cells[at(r + dr * k, c + dc * k)];
          if (v === me) mine++;
          else if (v !== null) theirs++;
        }
        if (mine > 0 && theirs === 0) score += mine === 3 ? 25 : mine === 2 ? 6 : 1;
        if (theirs > 0 && mine === 0) score -= theirs === 3 ? 30 : theirs === 2 ? 6 : 1;
      }
    }
  }
  return score;
}

export const connect4: GameEngine<C4State, C4Move> = {
  id: "connect4",

  initialState(first) {
    return { cells: Array<Player | null>(ROWS * COLS).fill(null), current: first, last: null };
  },

  currentPlayer(state) {
    return state.current;
  },

  legalMoves(state) {
    if (status(state).kind !== "playing") return [];
    const moves: C4Move[] = [];
    // Orden centro → afuera: mejora la poda del minimax y las pistas
    for (const col of [3, 2, 4, 1, 5, 0, 6]) {
      if (state.cells[col] === null) moves.push({ col });
    }
    return moves;
  },

  isLegal(state, move) {
    return (
      !!move &&
      validCol(move.col) &&
      state.cells[move.col] === null &&
      status(state).kind === "playing"
    );
  },

  applyMove(state, move) {
    if (!this.isLegal(state, move)) throw new Error(this.explainIllegal(state, move));
    const cells = [...state.cells];
    const r = dropRow(cells, move.col);
    const idx = at(r, move.col);
    cells[idx] = state.current;
    return { cells, current: other(state.current), last: idx };
  },

  status,

  explainIllegal(state, move) {
    if (status(state).kind !== "playing") return "La partida ya terminó.";
    if (!move || !validCol(move.col)) return "Esa columna no existe.";
    if (state.cells[move.col] !== null) return "Esa columna ya está llena. Elige otra.";
    return "No se puede hacer esa jugada.";
  },

  suggest(state) {
    const me = state.current;
    const moves = this.legalMoves(state);
    if (moves.length === 0) return null;

    // 1) Gano ya
    for (const m of moves) {
      if (status(this.applyMove(state, m)).kind === "win") {
        return { move: m, reason: "¡Con esta ficha haces cuatro en línea!" };
      }
    }
    // 2) Bloqueo una victoria inmediata de la pareja
    const theirs: C4State = { ...state, current: other(me) };
    for (const m of moves) {
      if (status(this.applyMove(theirs, m)).kind === "win") {
        return {
          move: m,
          reason: "Tu pareja está a una ficha de ganar en esa columna. Hay que taparla.",
        };
      }
    }
    // 3) Minimax
    const { move } = minimax(this, state, 4, me, evaluate);
    const best = move ?? moves[0];
    const reason =
      best.col === 3
        ? "La columna del centro participa en más líneas posibles."
        : "Es la jugada que mejor posición te deja y no le regala una línea a tu pareja.";
    return { move: best, reason };
  },
};
