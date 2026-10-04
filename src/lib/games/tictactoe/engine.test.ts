import { describe, expect, it } from "vitest";
import { tictactoe, type TttState } from "./engine";

function play(cells: number[], first: "A" | "B" = "A"): TttState {
  return cells.reduce(
    (s, cell) => tictactoe.applyMove(s, { cell }),
    tictactoe.initialState(first),
  );
}

describe("Gato", () => {
  it("empieza con el tablero vacío y el primer jugador indicado", () => {
    const s = tictactoe.initialState("B");
    expect(s.board).toHaveLength(9);
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(tictactoe.currentPlayer(s)).toBe("B");
    expect(tictactoe.legalMoves(s)).toHaveLength(9);
  });

  it("alterna turnos", () => {
    const s = play([0, 4]);
    expect(s.board[0]).toBe("A");
    expect(s.board[4]).toBe("B");
    expect(s.current).toBe("A");
  });

  it("no permite ocupar una casilla llena", () => {
    const s = play([0]);
    expect(tictactoe.isLegal(s, { cell: 0 })).toBe(false);
    expect(() => tictactoe.applyMove(s, { cell: 0 })).toThrow(/ocupada/);
  });

  it("rechaza casillas fuera del tablero", () => {
    const s = tictactoe.initialState("A");
    expect(tictactoe.isLegal(s, { cell: 9 })).toBe(false);
    expect(tictactoe.isLegal(s, { cell: -1 })).toBe(false);
    expect(tictactoe.isLegal(s, { cell: 1.5 })).toBe(false);
  });

  it("detecta victoria en fila, columna y diagonal", () => {
    expect(tictactoe.status(play([0, 3, 1, 4, 2]))).toEqual({
      kind: "win",
      winner: "A",
    });
    expect(tictactoe.status(play([0, 1, 3, 4, 8, 7]))).toEqual({
      kind: "win",
      winner: "B",
    });
    expect(tictactoe.status(play([0, 1, 4, 2, 8]))).toEqual({
      kind: "win",
      winner: "A",
    });
  });

  it("detecta empate", () => {
    const s = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(tictactoe.status(s)).toEqual({ kind: "draw" });
    expect(tictactoe.legalMoves(s)).toHaveLength(0);
  });

  it("no permite seguir jugando después de ganar", () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(tictactoe.legalMoves(s)).toHaveLength(0);
    expect(tictactoe.isLegal(s, { cell: 8 })).toBe(false);
    expect(tictactoe.explainIllegal(s, { cell: 8 })).toMatch(/terminó/);
  });

  it("no muta el estado anterior", () => {
    const s0 = tictactoe.initialState("A");
    const s1 = tictactoe.applyMove(s0, { cell: 4 });
    expect(s0.board[4]).toBeNull();
    expect(s1.board[4]).toBe("A");
  });
});
