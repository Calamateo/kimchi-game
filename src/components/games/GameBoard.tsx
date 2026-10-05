"use client";

import type { GameType, Side } from "@/lib/db";
import { TicTacToeBoard } from "./TicTacToeBoard";
import { CheckersBoard } from "./CheckersBoard";
import { Connect4Board } from "./Connect4Board";
import { ReversiBoard } from "./ReversiBoard";
import { ChessBoard } from "./ChessBoard";

export interface BoardProps {
  type: GameType;
  state: unknown;
  mySide: Side;
  canPlay: boolean;
  onMove: (move: unknown) => void;
  explain: (message: string) => void;
  partnerName: string;
  guide: boolean;
  hint: unknown | null;
}

/** Elige el tablero según el tipo de juego. */
export function GameBoard({ type, state, hint, ...rest }: BoardProps) {
  switch (type) {
    case "tictactoe":
      return (
        <TicTacToeBoard
          state={state as never}
          mySide={rest.mySide}
          canPlay={rest.canPlay}
          onMove={rest.onMove}
          hint={hint as never}
        />
      );
    case "checkers":
      return <CheckersBoard state={state as never} hint={hint as never} {...rest} />;
    case "connect4":
      return <Connect4Board state={state as never} hint={hint as never} {...rest} />;
    case "reversi":
      return <ReversiBoard state={state as never} hint={hint as never} {...rest} />;
    case "chess":
      return <ChessBoard state={state as never} hint={hint as never} {...rest} />;
    default:
      return (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted ring-1 ring-line">
          Este juego todavía no está disponible.
        </p>
      );
  }
}
