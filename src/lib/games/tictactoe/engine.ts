import { other, type GameEngine, type GameStatus, type Player } from "../types";

export interface TttState {
  board: (Player | null)[];
  current: Player;
}

export interface TttMove {
  cell: number;
}

export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function winningLine(
  board: (Player | null)[],
): readonly [number, number, number] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function status(state: TttState): GameStatus {
  const line = winningLine(state.board);
  if (line) return { kind: "win", winner: state.board[line[0]] as Player };
  if (state.board.every((c) => c !== null)) return { kind: "draw" };
  return { kind: "playing" };
}

function isValidCell(cell: unknown): cell is number {
  return Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < 9;
}

export const tictactoe: GameEngine<TttState, TttMove> = {
  id: "tictactoe",

  initialState(first) {
    return { board: Array<Player | null>(9).fill(null), current: first };
  },

  currentPlayer(state) {
    return state.current;
  },

  legalMoves(state) {
    if (status(state).kind !== "playing") return [];
    return state.board.flatMap((c, i) => (c === null ? [{ cell: i }] : []));
  },

  isLegal(state, move) {
    return (
      isValidCell(move.cell) &&
      state.board[move.cell] === null &&
      status(state).kind === "playing"
    );
  },

  applyMove(state, move) {
    if (!this.isLegal(state, move)) {
      throw new Error(this.explainIllegal(state, move));
    }
    const board = [...state.board];
    board[move.cell] = state.current;
    return { board, current: other(state.current) };
  },

  status,

  explainIllegal(state, move) {
    if (status(state).kind !== "playing") return "La partida ya terminó.";
    if (!isValidCell(move.cell)) return "Esa casilla no existe.";
    if (state.board[move.cell] !== null) {
      return "Esa casilla ya está ocupada. Elige una vacía.";
    }
    return "No se puede hacer esa jugada.";
  },

  suggest(state) {
    const moves = this.legalMoves(state);
    if (moves.length === 0) return null;
    const me = state.current;
    for (const m of moves) {
      if (status(this.applyMove(state, m)).kind === "win") {
        return { move: m, reason: "¡Con esa casilla haces tres en línea!" };
      }
    }
    const theirs: TttState = { ...state, current: other(me) };
    for (const m of moves) {
      if (status(this.applyMove(theirs, m)).kind === "win") {
        return { move: m, reason: "Tu pareja haría línea ahí. Hay que taparla." };
      }
    }
    if (state.board[4] === null) {
      return { move: { cell: 4 }, reason: "El centro participa en cuatro líneas: es la casilla más valiosa." };
    }
    const corner = [0, 2, 6, 8].find((c) => state.board[c] === null);
    if (corner !== undefined) {
      return { move: { cell: corner }, reason: "Las esquinas dan más oportunidades de hacer línea que los lados." };
    }
    return { move: moves[0], reason: "Cualquier casilla libre sirve; ya no hay peligro." };
  },
};
