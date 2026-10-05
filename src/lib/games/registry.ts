import type { GameType, Side } from "@/lib/db";
import type { GameEngine } from "./types";
import { tictactoe } from "./tictactoe/engine";
import { checkers } from "./checkers/engine";
import { suggestCheckers } from "./checkers/ai";
import { connect4 } from "./connect4/engine";
import { reversi } from "./reversi/engine";

export interface GameMeta {
  id: GameType;
  name: string;
  tagline: string;
  emoji: string;
  available: boolean;
  /** Reglas en lenguaje sencillo, una oración por punto. */
  rules: string[];
  /** Con qué juega cada lado, para la leyenda. */
  sideName: (side: Side) => string;
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
    sideName: (s) => (s === "A" ? "las ✕" : "los ◯"),
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
    emoji: "🟡",
    available: true,
    engine: connect4,
    sideName: (s) => (s === "A" ? "las rojas" : "las amarillas"),
    rules: [
      "El tablero tiene 7 columnas. Las fichas se dejan caer y bajan hasta el hueco más bajo de la columna.",
      "Por turnos, cada quien suelta una ficha en la columna que quiera.",
      "Gana quien junte cuatro fichas suyas seguidas: en fila, en columna o en diagonal.",
      "Si se llena todo el tablero sin cuatro en línea, es empate.",
      "Consejo: la columna del centro participa en más líneas que las demás.",
    ],
  },
  checkers: {
    id: "checkers",
    name: "Damas",
    tagline: "Avanza en diagonal y captura saltando.",
    emoji: "🔴",
    available: true,
    engine: { ...checkers, suggest: suggestCheckers },
    sideName: (s) => (s === "A" ? "las rojas" : "las negras"),
    rules: [
      "Cada quien tiene 12 piezas en las casillas oscuras. Las tuyas empiezan abajo.",
      "Las piezas avanzan una casilla en diagonal, siempre hacia adelante.",
      "Para capturar, saltas por encima de una pieza de tu pareja y caes en la casilla vacía que sigue. Esa pieza sale del tablero.",
      "Si puedes capturar, es obligatorio. Si después del salto puedes seguir saltando, tienes que continuar.",
      "Cuando una pieza llega al otro extremo del tablero se convierte en dama (lleva corona): se mueve y captura también hacia atrás.",
      "Gana quien deja a su pareja sin piezas o sin movimientos posibles.",
    ],
  },
  reversi: {
    id: "reversi",
    name: "Reversi",
    tagline: "Encierra las fichas del otro para voltearlas.",
    emoji: "⚫",
    available: true,
    engine: reversi,
    sideName: (s) => (s === "A" ? "las negras" : "las blancas"),
    rules: [
      "Se empieza con cuatro fichas en el centro, dos de cada color.",
      "Colocas una ficha de modo que encierre fichas de tu pareja en línea recta entre la nueva y otra tuya. Esas fichas se voltean y pasan a ser tuyas.",
      "Solo puedes jugar en casillas donde voltees al menos una ficha. Si no tienes ninguna, pasa el turno.",
      "La partida termina cuando nadie puede mover. Gana quien tenga más fichas de su color.",
      "Consejo: las esquinas nunca se pueden voltear. Valen oro.",
    ],
  },
  chess: {
    id: "chess",
    name: "Ajedrez",
    tagline: "El clásico. Lo aprenderemos por partes.",
    emoji: "♞",
    available: false,
    engine: null,
    sideName: (s) => (s === "A" ? "las blancas" : "las negras"),
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
