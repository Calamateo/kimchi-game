"use client";

import { useMemo } from "react";
import type { Side } from "@/lib/db";
import { reversi, type ReversiMove, type ReversiState } from "@/lib/games/reversi/engine";

interface Props {
  state: ReversiState;
  mySide: Side;
  canPlay: boolean;
  onMove: (move: ReversiMove) => void;
  explain: (message: string) => void;
  partnerName: string;
  guide?: boolean;
  hint?: ReversiMove | null;
}

export function ReversiBoard({
  state,
  mySide,
  canPlay,
  onMove,
  explain,
  partnerName,
  guide = true,
  hint = null,
}: Props) {
  const legal = useMemo(
    () => new Set(canPlay ? reversi.legalMoves(state).map((m) => m.cell) : []),
    [state, canPlay],
  );
  const flipped = new Set(state.last?.flipped ?? []);

  function tap(cell: number) {
    if (!canPlay) return;
    if (!legal.has(cell)) {
      explain(reversi.explainIllegal(state, { cell }));
      return;
    }
    onMove({ cell });
  }

  let help: string | null = null;
  if (canPlay && guide) {
    help = state.skipped
      ? `${partnerName} no tenía jugadas posibles, así que te toca otra vez. Toca una casilla con punto.`
      : "Toca una casilla con punto: ahí encierras fichas de tu pareja.";
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="board grid aspect-square w-full grid-cols-8 gap-[2px] rounded-2xl bg-[#2f6b45] p-[3px] shadow-md ring-4 ring-[#2f6b45]"
        role="grid"
        aria-label="Tablero de Reversi"
      >
        {state.board.map((cell, i) => {
          const isLegal = legal.has(i);
          const isLast = state.last?.cell === i;
          const isHint = hint?.cell === i;
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={
                cell
                  ? `Casilla ${"abcdefgh"[i & 7]}${8 - (i >> 3)}, ficha ${cell === mySide ? "tuya" : `de ${partnerName}`}`
                  : `Casilla ${"abcdefgh"[i & 7]}${8 - (i >> 3)}${isLegal ? ", jugada posible" : ""}`
              }
              onClick={() => tap(i)}
              className={`tap relative flex items-center justify-center bg-[#3f8f5a]
                ${isHint ? "pulse-soft ring-inset ring-4 ring-white" : ""}`}
            >
              {isLegal && !cell && (
                <span
                  className={`h-[28%] w-[28%] rounded-full ${
                    guide ? "bg-white/70" : "bg-white/0"
                  }`}
                />
              )}
              {cell && (
                <span
                  className={`${flipped.has(i) || isLast ? "pop" : ""} relative flex h-[82%] w-[82%] items-center justify-center rounded-full shadow-md
                    ${cell === "A" ? "bg-piece-b" : "bg-[#f7f3ea]"}`}
                >
                  {isLast && (
                    <span
                      className={`h-[22%] w-[22%] rounded-full ${
                        cell === "A" ? "bg-[#f7f3ea]" : "bg-piece-b"
                      }`}
                    />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {help && (
        <p
          role="status"
          className="rounded-2xl bg-surface px-4 py-2.5 text-center text-sm font-semibold ring-1 ring-line"
        >
          {help}
        </p>
      )}
    </div>
  );
}
