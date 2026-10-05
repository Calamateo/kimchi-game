import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { other, type GameEngine, type GameStatus, type Player } from "../types";

/**
 * Ajedrez sobre chess.js. El estado guarda la lista de jugadas (formato UCI)
 * para poder reconstruir la partida completa (repeticiones incluidas) y la
 * posición actual en FEN como caché.
 *
 * Variantes de aprendizaje: tableros reducidos donde además del jaque mate
 * gana quien corona primero, para que las partidas sean cortas.
 */
export type ChessVariant = "pawns" | "minor" | "major" | "full";

export interface VariantInfo {
  id: ChessVariant;
  name: string;
  description: string;
  fen: string;
  promotionWins: boolean;
}

export const VARIANTS: Record<ChessVariant, VariantInfo> = {
  pawns: {
    id: "pawns",
    name: "Peones y reyes",
    description: "Solo peones y los dos reyes. Gana quien corona primero.",
    fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
    promotionWins: true,
  },
  minor: {
    id: "minor",
    name: "Caballos y alfiles",
    description: "Se suman las piezas que saltan y las de las diagonales. Gana el jaque mate o coronar primero.",
    fen: "1nb1kbn1/pppppppp/8/8/8/8/PPPPPPPP/1NB1KBN1 w - - 0 1",
    promotionWins: true,
  },
  major: {
    id: "major",
    name: "Torres y dama",
    description: "Las piezas pesadas. Gana el jaque mate o coronar primero.",
    fen: "r2qk2r/pppppppp/8/8/8/8/PPPPPPPP/R2QK2R w - - 0 1",
    promotionWins: true,
  },
  full: {
    id: "full",
    name: "Ajedrez completo",
    description: "Todas las piezas, enroque y al paso. Gana el jaque mate.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    promotionWins: false,
  },
};

export const VARIANT_ORDER: ChessVariant[] = ["pawns", "minor", "major", "full"];

/**
 * Posiciones de lección (tutorial). Se registran como variantes efímeras
 * `lesson:<fen>` para que el motor pueda reconstruirlas igual que las demás.
 */
export function registerLesson(fen: string): ChessVariant {
  const id = `lesson:${fen}` as ChessVariant;
  if (!(id in VARIANTS)) {
    (VARIANTS as Record<string, VariantInfo>)[id] = {
      id,
      name: "Lección",
      description: "",
      fen,
      promotionWins: false,
    };
  }
  return id;
}

export interface ChessState {
  variant: ChessVariant;
  /** Qué jugador lleva las blancas (las blancas siempre empiezan). */
  white: Player;
  /** Jugadas en formato UCI: e2e4, e7e8q */
  moves: string[];
  fen: string;
  last: { from: Square; to: Square } | null;
  /** Quién coronó primero (solo cuenta en variantes de aprendizaje). */
  promoted: Player | null;
}

export interface ChessMove {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
}

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "peón",
  n: "caballo",
  b: "alfil",
  r: "torre",
  q: "dama",
  k: "rey",
};

export const PIECE_TIPS: Record<PieceSymbol, string> = {
  p: "El peón avanza de frente una casilla (dos desde su posición inicial) y solo captura en diagonal.",
  n: "El caballo salta en forma de L: dos casillas en una dirección y una hacia el lado. Puede pasar por encima de otras piezas.",
  b: "El alfil se mueve en diagonal tantas casillas como quiera, sin saltar piezas.",
  r: "La torre se mueve en línea recta, horizontal o vertical, sin saltar piezas.",
  q: "La dama combina torre y alfil: línea recta o diagonal, tantas casillas como quiera.",
  k: "El rey se mueve una sola casilla en cualquier dirección. Nunca puede quedar en jaque.",
};

const cache = new WeakMap<ChessState, Chess>();

/** Reconstruye la partida (con historial) a partir del estado. */
export function load(state: ChessState): Chess {
  const hit = cache.get(state);
  if (hit) return hit;
  const c = new Chess(VARIANTS[state.variant].fen);
  for (const u of state.moves) {
    c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as ChessMove["promotion"] });
  }
  cache.set(state, c);
  return c;
}

export function colorOf(state: ChessState, player: Player): Color {
  return player === state.white ? "w" : "b";
}

export function playerOf(state: ChessState, color: Color): Player {
  return color === "w" ? state.white : other(state.white);
}

function currentPlayer(state: ChessState): Player {
  const turn = state.fen.split(" ")[1] as Color;
  return playerOf(state, turn);
}

export function kingSquare(state: ChessState, player: Player): Square | null {
  const c = load(state);
  const color = colorOf(state, player);
  for (const row of c.board()) {
    for (const sq of row) {
      if (sq && sq.type === "k" && sq.color === color) return sq.square;
    }
  }
  return null;
}

export function isInCheck(state: ChessState): boolean {
  return load(state).inCheck();
}

function status(state: ChessState): GameStatus {
  const c = load(state);
  if (c.isCheckmate()) return { kind: "win", winner: other(currentPlayer(state)) };
  if (VARIANTS[state.variant].promotionWins && state.promoted) {
    return { kind: "win", winner: state.promoted };
  }
  if (c.isDraw() || c.isStalemate()) return { kind: "draw" };
  return { kind: "playing" };
}

function validShape(move: unknown): move is ChessMove {
  if (!move || typeof move !== "object") return false;
  const m = move as Partial<ChessMove>;
  const sq = /^[a-h][1-8]$/;
  return (
    typeof m.from === "string" &&
    typeof m.to === "string" &&
    sq.test(m.from) &&
    sq.test(m.to) &&
    (m.promotion === undefined || ["q", "r", "b", "n"].includes(m.promotion))
  );
}

export function toUci(m: ChessMove) {
  return `${m.from}${m.to}${m.promotion ?? ""}`;
}

export const chess: GameEngine<ChessState, ChessMove> = {
  id: "chess",

  initialState(first, options) {
    const variant = ((options as { variant?: ChessVariant } | undefined)?.variant ?? "full") as ChessVariant;
    const info = VARIANTS[variant] ?? VARIANTS.full;
    return {
      variant: info.id,
      white: first,
      moves: [],
      fen: info.fen,
      last: null,
      promoted: null,
    };
  },

  rematchOptions(state) {
    return { variant: state.variant };
  },

  currentPlayer,

  legalMoves(state) {
    if (status(state).kind !== "playing") return [];
    return load(state)
      .moves({ verbose: true })
      .map((m) => ({ from: m.from, to: m.to, promotion: m.promotion as ChessMove["promotion"] }));
  },

  isLegal(state, move) {
    if (!validShape(move)) return false;
    return this.legalMoves(state).some(
      (m) => m.from === move.from && m.to === move.to && m.promotion === move.promotion,
    );
  },

  applyMove(state, move) {
    if (!this.isLegal(state, move)) throw new Error(this.explainIllegal(state, move));
    const c = new Chess(VARIANTS[state.variant].fen);
    for (const u of state.moves) {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as ChessMove["promotion"] });
    }
    const mover = currentPlayer(state);
    const m = c.move({ from: move.from, to: move.to, promotion: move.promotion });
    const next: ChessState = {
      variant: state.variant,
      white: state.white,
      moves: [...state.moves, toUci(move)],
      fen: c.fen(),
      last: { from: move.from, to: move.to },
      promoted: state.promoted ?? (m.isPromotion() ? mover : null),
    };
    cache.set(next, c);
    return next;
  },

  status,

  explainIllegal(state, move) {
    if (status(state).kind !== "playing") return "La partida ya terminó.";
    if (!validShape(move)) return "Ese movimiento no se puede hacer.";
    const c = load(state);
    const myColor = colorOf(state, currentPlayer(state));
    const piece = c.get(move.from);
    if (!piece) return "No hay ninguna pieza en esa casilla. Toca una de tus piezas.";
    if (piece.color !== myColor) return "Esa pieza es de tu pareja. Elige una de las tuyas.";
    const fromMoves = c.moves({ square: move.from, verbose: true });
    if (fromMoves.length === 0) {
      return c.inCheck()
        ? "Tu rey está en jaque. Solo puedes hacer jugadas que lo saquen del jaque."
        : `Tu ${PIECE_NAMES[piece.type]} no tiene movimientos posibles ahora mismo.`;
    }
    if (move.from === move.to) return "Elige a dónde mover la pieza.";
    const target = c.get(move.to);
    if (target && target.color === myColor) return "Esa casilla la ocupa una pieza tuya.";
    if (fromMoves.some((m) => m.to === move.to)) {
      return "Ese peón corona: elige en qué pieza se convierte.";
    }
    if (c.inCheck()) return "Tu rey está en jaque: esa jugada no lo protege.";
    return PIECE_TIPS[piece.type];
  },
};
