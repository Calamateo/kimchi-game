"use client";

import type { Side } from "@/lib/db";
import { winningLine, type TttMove, type TttState } from "@/lib/games/tictactoe/engine";

interface Props {
  state: TttState;
  mySide: Side;
  canPlay: boolean;
  onMove: (move: TttMove) => void;
}

export function TicTacToeBoard({ state, mySide, canPlay, onMove }: Props) {
  const line = winningLine(state.board);

  return (
    <div
      className="board grid aspect-square w-full grid-cols-3 gap-2 rounded-3xl bg-board-dark p-2 shadow-inner"
      role="grid"
      aria-label="Tablero de gato"
    >
      {state.board.map((cell, i) => {
        const inLine = line?.includes(i) ?? false;
        const empty = cell === null;
        const playable = canPlay && empty;
        return (
          <button
            key={i}
            role="gridcell"
            aria-label={
              cell
                ? `Casilla ${i + 1}, ${cell === mySide ? "tuya" : "de tu pareja"}`
                : `Casilla ${i + 1}, vacía`
            }
            disabled={!playable}
            onClick={() => onMove({ cell: i })}
            className={`tap flex items-center justify-center rounded-2xl text-[min(18vw,6rem)] font-extrabold leading-none transition
              ${inLine ? "bg-sage/80" : "bg-board-light"}
              ${playable ? "active:scale-95 hover:brightness-95" : ""}
              ${empty && canPlay ? "ring-2 ring-accent/40 ring-inset" : ""}`}
          >
            {cell && (
              <span
                className={`pop ${
                  cell === "A" ? "text-accent" : "text-sky"
                } ${inLine ? "text-white" : ""}`}
              >
                {cell === "A" ? "✕" : "◯"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
