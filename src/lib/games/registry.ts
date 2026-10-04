import type { GameType } from "@/lib/db";
import type { GameEngine } from "./types";
import { tictactoe } from "./tictactoe/engine";

export interface GameMeta {
  id: GameType;
  name: string;
  tagline: string;
  emoji: string;
  available: boolean;
  /** Reglas en lenguaje sencillo, una oración por punto. */
  rules: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: GameEngine<any, any> | null;
}

export const GAMES: Record<GameType, GameMeta> = {
  tictactoe: {
    id: "tictactoe",
    name: "Gato",
    tagline: "Tres en línea. Perfecto para empezar.",
    emoji: "❌",
    available: true,
    engine: tictactoe,
    rules: [
      "Se juega en un tablero de 3 por 3 casillas.",
      "Por turnos, cada quien pone su marca en una casilla vacía.",
      "Gana quien logre tres marcas suyas en línea: horizontal, vertical o diagonal.",
      "Si se llenan las nueve casillas y nadie hizo línea, es empate.",
    ],
  },
  connect4: {
    id: "connect4",
    name: "Conecta 4",
    tagline: "Deja caer fichas y forma cuatro en línea.",
    emoji: "🔴",
    available: false,
    engine: null,
    rules: [],
  },
  checkers: {
    id: "checkers",
    name: "Damas",
    tagline: "Avanza en diagonal y captura saltando.",
    emoji: "⚪",
    available: false,
    engine: null,
    rules: [],
  },
  reversi: {
    id: "reversi",
    name: "Reversi",
    tagline: "Encierra las fichas del otro para voltearlas.",
    emoji: "⚫",
    available: false,
    engine: null,
    rules: [],
  },
  chess: {
    id: "chess",
    name: "Ajedrez",
    tagline: "El clásico. Lo aprenderemos por partes.",
    emoji: "♞",
    available: false,
    engine: null,
    rules: [],
  },
};

export const GAME_ORDER: GameType[] = [
  "tictactoe",
  "connect4",
  "checkers",
  "reversi",
  "chess",
];
