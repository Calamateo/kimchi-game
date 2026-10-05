"use client";

import type { Side } from "@/lib/db";
import {
  COLS,
  ROWS,
  connect4,
  dropRow,
  winningCells,
  type C4Move,
  type C4State,
} from "@/lib/games/connect4/engine";

interface Props {
  state: C4State;
  mySide: Side;
  canPlay: boolean;
  onMove: (move: C4Move) => void;
  explain: (message: string) => void;
  partnerName: string;
  guide?: boolean;
  hint?: C4Move | null;
}

export function Connect4Board({
  state,
  mySide,
  canPlay,
  onMove,
  explain,
  partnerName,
  guide = true,
  hint = null,
}: Props) {
  const win = new Set(winningCells(state.cells) ?? []);
  const hintCell =
    hint && state.cells[hint.col] === null ? dropRow(state.cells, hint.col) * COLS + hint.col : null;

  function tap(col: number) {
    if (!canPlay) return;
    if (!connect4.isLegal(state, { col })) {
      explain(connect4.explainIllegal(state, { col }));
      return;
    }
    onMove({ col });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="board grid w-full gap-1.5 rounded-3xl bg-sky p-2.5 shadow-md"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Tablero de Conecta 4"
      >
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const col = i % COLS;
          const cell = state.cells[i];
          const isLast = state.last === i;
          const isWin = win.has(i);
          const isHint = hintCell === i;
          const landing = canPlay && cell === null && dropRow(state.cells, col) * COLS + col === i;
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={
                cell
                  ? `Columna ${col + 1}, ficha ${cell === mySide ? "tuya" : `de ${partnerName}`}`
                  : `Columna ${col + 1}, hueco vacío`
              }
              onClick={() => tap(col)}
              className={`tap relative flex aspect-square items-center justify-center rounded-full
                ${cell ? "bg-bg" : "bg-bg/90"}
                ${isHint ? "pulse-soft ring-4 ring-white" : ""}
                ${landing && !isHint && guide ? "ring-2 ring-white/40" : ""}`}
            >
              {cell && (
                <span
                  className={`pop block h-[86%] w-[86%] rounded-full shadow-inner
                    ${cell === "A" ? "bg-piece-a" : "bg-c4-b"}
                    ${isWin ? "ring-4 ring-white" : ""}
                    ${isLast && !isWin ? "ring-2 ring-ink/40" : ""}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {canPlay && guide && (
        <p
          role="status"
          className="rounded-2xl bg-surface px-4 py-2.5 text-center text-sm font-semibold ring-1 ring-line"
        >
          Toca cualquier hueco de la columna donde quieras soltar tu ficha.
        </p>
      )}
    </div>
  );
}
