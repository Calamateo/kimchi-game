"use client";

import { useMemo, useState } from "react";
import type { Side } from "@/lib/db";
import {
  checkers,
  isDark,
  isJumpStep,
  isKing,
  pathStartsWith,
  row,
  sideOfPiece,
  type CheckersMove,
  type CheckersState,
} from "@/lib/games/checkers/engine";

interface Props {
  state: CheckersState;
  mySide: Side;
  canPlay: boolean;
  onMove: (move: CheckersMove) => void;
  /** Muestra una explicación amable (toast). */
  explain: (message: string) => void;
  partnerName: string;
  /** Si está activado, muestra la línea de ayuda bajo el tablero. */
  guide?: boolean;
  /** Jugada sugerida a resaltar. */
  hint?: CheckersMove | null;
}

export function CheckersBoard({
  state,
  mySide,
  canPlay,
  onMove,
  explain,
  partnerName,
  guide = true,
  hint = null,
}: Props) {
  // La selección va ligada al estado para el que se hizo: si llega una jugada
  // nueva (propia o ajena), la selección anterior deja de aplicar sola.
  const [sel, setSel] = useState<{ forState: CheckersState; path: number[] } | null>(null);
  const path = sel && sel.forState === state ? sel.path : [];
  const setPath = (p: number[]) => setSel({ forState: state, path: p });

  const legal = useMemo(
    () => (canPlay ? checkers.legalMoves(state) : []),
    [state, canPlay],
  );
  const mustCapture = legal.some((m) => isJumpStep(m.path[0], m.path[1]));
  const movable = useMemo(() => new Set(legal.map((m) => m.path[0])), [legal]);
  const candidates = path.length
    ? legal.filter((m) => pathStartsWith(m.path, path))
    : [];
  const targets = new Set(
    candidates
      .map((m) => m.path[path.length])
      .filter((x): x is number => x !== undefined),
  );
  const lastPath = new Set(state.last?.path ?? []);
  const lastCaptured = new Set(state.last?.captured ?? []);
  const hintFrom = hint?.path[0] ?? null;
  const hintTo = hint ? hint.path[hint.path.length - 1] : null;

  function tap(i: number) {
    const piece = state.board[i];
    if (!canPlay) return;

    if (path.length === 0) {
      if (piece && sideOfPiece(piece) === mySide) {
        if (movable.has(i)) {
          setPath([i]);
        } else {
          explain(checkers.explainIllegal(state, { path: [i, i] }));
        }
      } else if (piece) {
        explain(`Esa pieza es de ${partnerName}. Elige una de las tuyas.`);
      } else {
        explain("Primero toca una de tus piezas.");
      }
      return;
    }

    if (i === path[0] && path.length === 1) {
      setPath([]);
      return;
    }
    if (
      path.length === 1 &&
      piece &&
      sideOfPiece(piece) === mySide &&
      movable.has(i)
    ) {
      setPath([i]);
      return;
    }

    const next = [...path, i];
    const matching = legal.filter((m) => pathStartsWith(m.path, next));
    if (matching.length === 0) {
      explain(checkers.explainIllegal(state, { path: next }));
      return;
    }
    if (matching.some((m) => m.path.length === next.length)) {
      onMove({ path: next });
      setPath([]);
    } else {
      setPath(next);
    }
  }

  let help: string | null = null;
  if (canPlay && guide) {
    if (path.length === 0) {
      help = mustCapture
        ? `Captura obligatoria: toca una pieza resaltada y salta sobre la de ${partnerName}.`
        : "Toca una de tus piezas resaltadas.";
    } else if (path.length === 1) {
      help = mustCapture
        ? "Ahora toca la casilla donde caerás después del salto."
        : "Ahora toca la casilla a donde quieres mover.";
    } else {
      help = "¡Sigue saltando! Toca la siguiente casilla.";
    }
  }

  // El tablero se gira para que cada quien vea sus piezas abajo.
  const order = mySide === "A" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const selected = path.length ? path[path.length - 1] : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="board grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl shadow-md ring-4 ring-board-dark"
        role="grid"
        aria-label="Tablero de damas"
      >
        {order.map((r) =>
          order.map((c) => {
            const i = r * 8 + c;
            const dark = isDark(i);
            const piece = state.board[i];
            const isTarget = targets.has(i);
            const isSelected = selected === i || path.includes(i);
            const isMovable = path.length === 0 && movable.has(i);
            const inLast = lastPath.has(i);
            const wasCaptured = lastCaptured.has(i);
            const isHintFrom = hintFrom === i;
            const isHintTo = hintTo === i;

            if (!dark) {
              return (
                <div key={i} className="bg-board-light" aria-hidden="true" />
              );
            }

            return (
              <button
                key={i}
                role="gridcell"
                onClick={() => tap(i)}
                aria-label={describeCell(i, piece, mySide, partnerName)}
                className={`tap relative flex items-center justify-center
                  ${inLast && !piece ? "bg-board-dark brightness-110" : "bg-board-dark"}
                  ${isSelected ? "ring-inset ring-4 ring-accent" : ""}
                  ${isTarget ? "ring-inset ring-4 ring-sage" : ""}
                  ${isHintFrom || isHintTo ? "pulse-soft ring-inset ring-4 ring-sky" : ""}`}
              >
                {isHintTo && !piece && (
                  <span className="absolute h-1/3 w-1/3 rounded-full bg-sky/80" />
                )}
                {wasCaptured && !piece && (
                  <span className="absolute h-1/3 w-1/3 rounded-full border-2 border-dashed border-rose/60" />
                )}
                {isTarget && !piece && (
                  <span className="pop h-1/3 w-1/3 rounded-full bg-sage/80" />
                )}
                {piece && (
                  <span
                    className={`pop flex h-[78%] w-[78%] items-center justify-center rounded-full shadow-md
                      ${sideOfPiece(piece) === "A" ? "bg-piece-a text-white" : "bg-piece-b text-piece-b-ink"}
                      ${isMovable ? "ring-3 ring-accent ring-offset-2 ring-offset-board-dark" : ""}
                      ${inLast ? "outline outline-2 outline-white/50" : ""}`}
                  >
                    <span className="h-[62%] w-[62%] rounded-full border-2 border-white/25 flex items-center justify-center text-[clamp(10px,3.2vw,22px)] font-black leading-none">
                      {isKing(piece) ? "♛" : ""}
                    </span>
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {help && (
        <p
          role="status"
          className="rounded-2xl bg-surface px-4 py-2.5 text-center text-sm font-semibold text-ink ring-1 ring-line"
        >
          {help}
        </p>
      )}
    </div>
  );
}

function describeCell(
  i: number,
  piece: CheckersState["board"][number],
  mySide: Side,
  partnerName: string,
) {
  const file = "abcdefgh"[i & 7];
  const rank = 8 - row(i);
  if (!piece) return `Casilla ${file}${rank}, vacía`;
  const owner = sideOfPiece(piece) === mySide ? "tuya" : `de ${partnerName}`;
  return `Casilla ${file}${rank}, ${isKing(piece) ? "dama" : "pieza"} ${owner}`;
}
