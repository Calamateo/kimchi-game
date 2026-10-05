import { other, type GameEngine, type GameStatus, type Player } from "../types";

/**
 * Damas inglesas / americanas (la variante más sencilla):
 * - Tablero 8x8, solo casillas oscuras. 12 piezas por lado.
 * - Los peones avanzan una casilla en diagonal hacia adelante y capturan
 *   saltando hacia adelante. Las damas se mueven y capturan en las 4 diagonales,
 *   siempre una casilla (no "vuelan").
 * - Capturar es obligatorio y hay que completar la cadena de saltos.
 * - Al coronar, el turno termina (no se sigue capturando como dama).
 * - Pierde quien no tiene movimientos legales. Tablas tras 80 jugadas
 *   consecutivas sin capturas ni movimientos de peón.
 */

/** minúscula = peón, mayúscula = dama. a = jugador A, b = jugador B */
export type Piece = "a" | "A" | "b" | "B";

export interface CheckersState {
  board: (Piece | null)[];
  current: Player;
  noProgress: number;
  last: { path: number[]; captured: number[] } | null;
}

export interface CheckersMove {
  /** Casillas recorridas: origen, [aterrizajes intermedios], destino. */
  path: number[];
}

export const DRAW_AFTER_PLIES = 80;

export const row = (i: number) => i >> 3;
export const col = (i: number) => i & 7;
const at = (r: number, c: number) => r * 8 + c;
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const isDark = (i: number) => (row(i) + col(i)) % 2 === 1;

export const sideOfPiece = (p: Piece): Player =>
  p === "a" || p === "A" ? "A" : "B";
export const isKing = (p: Piece) => p === "A" || p === "B";
const forwardDir = (side: Player) => (side === "A" ? -1 : 1);
const promoRow = (side: Player) => (side === "A" ? 0 : 7);
const kingOf = (side: Player): Piece => (side === "A" ? "A" : "B");

const ALL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function dirsFor(piece: Piece) {
  if (isKing(piece)) return ALL_DIRS;
  const f = forwardDir(sideOfPiece(piece));
  return ALL_DIRS.filter((d) => d[0] === f);
}

function jumpsFrom(
  board: (Piece | null)[],
  start: number,
  r: number,
  c: number,
  piece: Piece,
  captured: number[],
  path: number[],
  out: CheckersMove[],
) {
  const side = sideOfPiece(piece);
  let found = false;
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + 2 * dr;
    const lc = c + 2 * dc;
    if (!inBounds(lr, lc)) continue;
    const mid = at(mr, mc);
    const land = at(lr, lc);
    const mp = board[mid];
    if (!mp || sideOfPiece(mp) === side || captured.includes(mid)) continue;
    if (board[land] !== null && land !== start) continue;
    found = true;
    const newPath = [...path, land];
    const newCaptured = [...captured, mid];
    if (!isKing(piece) && lr === promoRow(side)) {
      // Al coronar termina el movimiento.
      out.push({ path: newPath });
      continue;
    }
    jumpsFrom(board, start, lr, lc, piece, newCaptured, newPath, out);
  }
  if (!found && path.length > 1) out.push({ path });
}

/** Movimientos del jugador en turno sin considerar si la partida terminó. */
export function rawMoves(state: CheckersState): CheckersMove[] {
  const { board, current } = state;
  const captures: CheckersMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || sideOfPiece(p) !== current) continue;
    jumpsFrom(board, i, row(i), col(i), p, [], [i], captures);
  }
  if (captures.length > 0) return captures;

  const simple: CheckersMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || sideOfPiece(p) !== current) continue;
    for (const [dr, dc] of dirsFor(p)) {
      const nr = row(i) + dr;
      const nc = col(i) + dc;
      if (!inBounds(nr, nc)) continue;
      const t = at(nr, nc);
      if (board[t] === null) simple.push({ path: [i, t] });
    }
  }
  return simple;
}

export function isJumpStep(from: number, to: number) {
  return Math.abs(row(to) - row(from)) === 2;
}

export function pathStartsWith(full: number[], prefix: number[]) {
  if (prefix.length > full.length) return false;
  return prefix.every((v, i) => full[i] === v);
}

function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function validShape(move: unknown): move is CheckersMove {
  if (!move || typeof move !== "object") return false;
  const p = (move as { path?: unknown }).path;
  return (
    Array.isArray(p) &&
    p.length >= 1 &&
    p.every((x) => Number.isInteger(x) && x >= 0 && x < 64)
  );
}

function status(state: CheckersState): GameStatus {
  if (state.noProgress >= DRAW_AFTER_PLIES) return { kind: "draw" };
  if (rawMoves(state).length === 0) {
    return { kind: "win", winner: other(state.current) };
  }
  return { kind: "playing" };
}

export function countPieces(board: (Piece | null)[], side: Player) {
  return board.filter((p) => p !== null && sideOfPiece(p) === side).length;
}

export function parseBoard(diagram: string): (Piece | null)[] {
  const rows = diagram
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (rows.length !== 8 || rows.some((r) => r.length !== 8)) {
    throw new Error("El diagrama debe tener 8 filas de 8 caracteres");
  }
  const board: (Piece | null)[] = Array(64).fill(null);
  rows.forEach((line, r) => {
    for (let c = 0; c < 8; c++) {
      const ch = line[c];
      if (ch === ".") continue;
      if (ch === "a" || ch === "A" || ch === "b" || ch === "B") {
        board[at(r, c)] = ch;
      }
    }
  });
  return board;
}

export const checkers: GameEngine<CheckersState, CheckersMove> = {
  id: "checkers",

  initialState(first) {
    const board: (Piece | null)[] = Array(64).fill(null);
    for (let i = 0; i < 64; i++) {
      if (!isDark(i)) continue;
      if (row(i) <= 2) board[i] = "b";
      if (row(i) >= 5) board[i] = "a";
    }
    return { board, current: first, noProgress: 0, last: null };
  },

  currentPlayer(state) {
    return state.current;
  },

  legalMoves(state) {
    if (status(state).kind !== "playing") return [];
    return rawMoves(state);
  },

  isLegal(state, move) {
    if (!validShape(move)) return false;
    return this.legalMoves(state).some((m) => samePath(m.path, move.path));
  },

  applyMove(state, move) {
    if (!this.isLegal(state, move)) {
      throw new Error(this.explainIllegal(state, move));
    }
    const board = [...state.board];
    const from = move.path[0];
    const to = move.path[move.path.length - 1];
    const piece = board[from] as Piece;
    const side = sideOfPiece(piece);
    const captured: number[] = [];
    for (let i = 1; i < move.path.length; i++) {
      const a = move.path[i - 1];
      const b = move.path[i];
      if (isJumpStep(a, b)) captured.push((a + b) / 2);
    }
    board[from] = null;
    for (const c of captured) board[c] = null;
    board[to] =
      !isKing(piece) && row(to) === promoRow(side) ? kingOf(side) : piece;

    const progress = captured.length > 0 || !isKing(piece);
    return {
      board,
      current: other(state.current),
      noProgress: progress ? 0 : state.noProgress + 1,
      last: { path: move.path, captured },
    };
  },

  status,

  explainIllegal(state, move) {
    if (status(state).kind !== "playing") return "La partida ya terminó.";
    if (!validShape(move)) return "Ese movimiento no se puede hacer.";
    const { board, current } = state;
    const path = move.path;
    const from = path[0];
    const piece = board[from];
    if (!piece) return "No hay ninguna pieza en esa casilla. Toca una de tus piezas.";
    if (sideOfPiece(piece) !== current) return "Esa pieza no es tuya. Elige una de las tuyas.";

    const legal = rawMoves(state);
    const mustCapture = legal.some((m) => isJumpStep(m.path[0], m.path[1]));
    const mine = legal.filter((m) => m.path[0] === from);
    if (mine.length === 0) {
      return mustCapture
        ? "Tienes una captura obligatoria con otra pieza. Las piezas que pueden saltar están resaltadas."
        : "Esa pieza no tiene movimientos posibles ahora mismo.";
    }
    if (path.length < 2) return "Ahora elige a dónde mover la pieza.";

    const to = path[1];
    if (!isDark(to)) return "Las piezas solo se mueven por las casillas oscuras.";
    if (board[to] !== null && to !== from) return "Esa casilla está ocupada.";
    const dr = row(to) - row(from);
    const dc = col(to) - col(from);
    if (Math.abs(dr) !== Math.abs(dc) || dr === 0 || Math.abs(dr) > 2) {
      return "La pieza se mueve en diagonal: una casilla para avanzar o dos para saltar.";
    }
    if (!isKing(piece) && Math.sign(dr) !== forwardDir(current)) {
      return "Los peones solo avanzan hacia adelante. Solo las damas pueden ir hacia atrás.";
    }
    if (Math.abs(dr) === 2) {
      const mp = board[(from + to) / 2];
      if (!mp || sideOfPiece(mp) === current) {
        return "Para saltar necesitas una pieza de tu pareja justo en medio.";
      }
    }
    if (Math.abs(dr) === 1 && mustCapture) {
      return "Captura obligatoria: cuando puedes saltar una pieza, tienes que hacerlo.";
    }
    if (mine.some((m) => pathStartsWith(m.path, path))) {
      return "¡Sigue saltando! Hay que completar todos los saltos posibles.";
    }
    return "Ese movimiento no se puede hacer.";
  },
};
