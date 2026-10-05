import type { GameType } from "@/lib/db";
import { checkers, isKing, parseBoard, type CheckersMove, type CheckersState } from "./checkers/engine";
import { connect4, type C4Move, type C4State } from "./connect4/engine";
import { CORNERS, reversi, type ReversiMove, type ReversiState } from "./reversi/engine";

/**
 * Tutoriales interactivos. Quien aprende siempre juega con el lado A y
 * siempre le toca mover. Cada paso tiene un tablero preparado, una
 * instrucción y, opcionalmente, una comprobación de la jugada hecha.
 */
export interface TutorialStep<S = unknown, M = unknown> {
  title: string;
  text: string;
  state: S;
  /** Devuelve null si la jugada cumple el objetivo, o un mensaje para reintentar. */
  check?: (move: M, before: S, after: S) => string | null;
  success: string;
}

export interface Tutorial<S = unknown, M = unknown> {
  game: GameType;
  intro: string;
  steps: TutorialStep<S, M>[];
  outro: string;
}

const ck = (diagram: string): CheckersState => ({
  board: parseBoard(diagram),
  current: "A",
  noProgress: 0,
  last: null,
});

const checkersTutorial: Tutorial<CheckersState, CheckersMove> = {
  game: "checkers",
  intro:
    "Vamos paso a paso. Tus piezas son las rojas y siempre empiezan abajo. Aquí puedes equivocarte las veces que quieras.",
  steps: [
    {
      title: "Mover un peón",
      text: "Los peones avanzan una casilla en diagonal, hacia adelante. Toca tu pieza roja y luego una de las casillas con punto verde.",
      state: ck(`
        .b......
        ........
        ........
        ........
        ........
        ..a.....
        ........
        ........
      `),
      success: "¡Eso es! Así de simple se mueve un peón. Nunca hacia atrás, nunca en línea recta.",
    },
    {
      title: "Capturar saltando",
      text: "Si una pieza de tu pareja está justo delante en diagonal y la casilla de atrás está libre, la saltas y la capturas. Toca tu pieza y luego la casilla donde cae después del salto.",
      state: ck(`
        .b......
        ........
        ........
        ........
        ...b....
        ..a.....
        ........
        ........
      `),
      check: (_m, _b, after) => (after.last?.captured.length ? null : "Casi. Elige la casilla que está justo detrás de la pieza negra."),
      success: "¡Capturada! La pieza negra sale del tablero.",
    },
    {
      title: "Capturar es obligatorio",
      text: "Cuando puedes capturar, tienes que hacerlo. Fíjate: solo la pieza que puede saltar está resaltada. Intenta mover la otra y verás el aviso. Luego haz la captura.",
      state: ck(`
        .b......
        ........
        ........
        ........
        ...b....
        ..a.....
        ........
        ......a.
      `),
      success: "Exacto. Si hay captura disponible, la regla te obliga a tomarla. Eso hace el juego más interesante.",
    },
    {
      title: "Saltos en cadena",
      text: "Si después de saltar puedes volver a saltar, tienes que seguir. Toca tu pieza, luego la primera casilla donde cae y después la segunda.",
      state: ck(`
        .b......
        ........
        ........
        ....b...
        ........
        ..b.....
        .a......
        ........
      `),
      check: (m) => (m.path.length === 3 ? null : "Hay que completar los dos saltos seguidos."),
      success: "¡Doble captura! Las cadenas de saltos son la forma más rápida de ganar ventaja.",
    },
    {
      title: "Coronar una dama",
      text: "Cuando un peón llega a la última fila se convierte en dama y lleva corona. Lleva tu pieza al fondo del tablero.",
      state: ck(`
        ........
        ..a.....
        ........
        ........
        ........
        ........
        ........
        ......b.
      `),
      check: (_m, _b, after) =>
        after.board.some((p) => p === "A") ? null : "Mueve la pieza roja hasta la primera fila para coronar.",
      success: "¡Dama! Fíjate en la corona. Ahora esa pieza vale mucho más.",
    },
    {
      title: "La dama va hacia atrás",
      text: "A diferencia de los peones, la dama se mueve y captura en las cuatro diagonales. Tienes una pieza negra detrás: captúrala.",
      state: ck(`
        .b......
        ........
        ........
        ........
        ...A....
        ....b...
        ........
        ........
      `),
      check: (_m, _b, after) => (after.last?.captured.length ? null : "Usa la dama para saltar hacia atrás sobre la pieza negra."),
      success: "Perfecto. Por eso coronar es tan valioso: la dama domina el tablero.",
    },
  ],
  outro:
    "¡Lista! Ya conoces todas las reglas: mover, capturar, la captura obligatoria, las cadenas y las damas. Lo demás se aprende jugando. Cuando quieras una idea, usa el botón de Pista.",
};

const c4 = (cols: number[], first: "A" | "B" = "A"): C4State =>
  cols.reduce((s, col) => connect4.applyMove(s, { col }), connect4.initialState(first));

const connect4Tutorial: Tutorial<C4State, C4Move> = {
  game: "connect4",
  intro: "Tus fichas son las rojas. La idea es simple: cuatro seguidas y ganas.",
  steps: [
    {
      title: "Soltar una ficha",
      text: "Toca cualquier hueco de una columna. Tu ficha cae hasta el fondo o hasta la ficha más alta que haya.",
      state: c4([]),
      success: "Así de fácil. Las fichas siempre caen, no se pueden colocar flotando.",
    },
    {
      title: "Hacer cuatro en línea",
      text: "Ya tienes tres rojas seguidas abajo. Suelta la cuarta para ganar.",
      state: c4([0, 6, 1, 6, 2, 5]),
      check: (_m, _b, after) =>
        connect4.status(after).kind === "win" ? null : "Busca la columna que completa la línea de cuatro.",
      success: "¡Cuatro en línea! Las líneas también valen en vertical y en diagonal.",
    },
    {
      title: "Tapar a tu pareja",
      text: "Ahora tu pareja tiene tres amarillas seguidas. Si no la tapas, gana en su turno. Pon tu ficha donde haría la cuarta.",
      state: c4([6, 1, 6, 2, 5, 3]),
      check: (_m, _b, after) => {
        const theirs: C4State = { ...after, current: "B" };
        const canWin = connect4
          .legalMoves(theirs)
          .some((m) => connect4.status(connect4.applyMove(theirs, m)).kind === "win");
        return canWin ? "Tu pareja todavía puede completar su línea. Fíjate en la columna que la cierra." : null;
      },
      success: "Bien visto. Mitad del juego es construir tu línea; la otra mitad, vigilar la suya.",
    },
  ],
  outro: "Eso es todo. Consejo: la columna del centro participa en más líneas que las demás.",
};

const rv = (board: string, current: "A" | "B" = "A"): ReversiState => {
  const rows = board.trim().split("\n").map((l) => l.trim());
  const cells = Array<"A" | "B" | null>(64).fill(null);
  rows.forEach((line, r) => {
    for (let c = 0; c < 8; c++) {
      const ch = line[c];
      if (ch === "A" || ch === "B") cells[r * 8 + c] = ch;
    }
  });
  return { board: cells, current, last: null, skipped: false };
};

const reversiTutorial: Tutorial<ReversiState, ReversiMove> = {
  game: "reversi",
  intro: "Tus fichas son las negras. Aquí no se capturan piezas: se voltean.",
  steps: [
    {
      title: "Encerrar para voltear",
      text: "Coloca una ficha de modo que haya fichas blancas en línea recta entre la nueva y otra negra tuya. Las casillas con punto te muestran dónde se puede. Toca una.",
      state: reversi.initialState("A"),
      success: "¿Viste? La ficha blanca encerrada se volteó y ahora es tuya.",
    },
    {
      title: "Varias direcciones a la vez",
      text: "Una sola ficha puede voltear en varias líneas al mismo tiempo. Busca la casilla que voltea más de una ficha.",
      state: rv(`
        ........
        ........
        ...B....
        ..BAB...
        ...B....
        ........
        ........
        ........
      `),
      check: (_m, _b, after) =>
        (after.last?.flipped.length ?? 0) >= 2 ? null : "Esa voltea solo una. Hay una casilla que voltea dos a la vez.",
      success: "¡Dos de golpe! Cuantas más líneas cierres, más fichas cambian de color.",
    },
    {
      title: "Las esquinas valen oro",
      text: "Una ficha en la esquina nunca se puede voltear. Tienes una esquina disponible: tómala.",
      state: rv(`
        .BA.....
        .B......
        .A......
        ........
        ........
        ........
        ........
        ........
      `),
      check: (m) => (CORNERS.includes(m.cell) ? null : "Busca la casilla de la esquina, arriba a la izquierda."),
      success: "Esa ficha ya es tuya para siempre. Las esquinas deciden muchas partidas.",
    },
  ],
  outro: "Listo. Recuerda: al final gana quien tenga más fichas, así que las esquinas y los bordes son tus aliados.",
};

export const TUTORIALS: Partial<Record<GameType, Tutorial>> = {
  checkers: checkersTutorial as Tutorial,
  connect4: connect4Tutorial as Tutorial,
  reversi: reversiTutorial as Tutorial,
};

export { checkers, isKing };
