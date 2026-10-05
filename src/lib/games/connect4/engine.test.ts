import { describe, expect, it } from "vitest";
import { connect4, dropRow, type C4State } from "./engine";

function play(cols: number[], first: "A" | "B" = "A"): C4State {
  return cols.reduce((s, col) => connect4.applyMove(s, { col }), connect4.initialState(first));
}

describe("Conecta 4", () => {
  it("empieza vacío con 7 columnas disponibles", () => {
    const s = connect4.initialState("B");
    expect(s.cells).toHaveLength(42);
    expect(connect4.legalMoves(s)).toHaveLength(7);
    expect(s.current).toBe("B");
  });

  it("las fichas caen hasta abajo y se apilan", () => {
    const s = play([3, 3]);
    expect(s.cells[5 * 7 + 3]).toBe("A");
    expect(s.cells[4 * 7 + 3]).toBe("B");
    expect(dropRow(s.cells, 3)).toBe(3);
    expect(s.last).toBe(4 * 7 + 3);
  });

  it("no permite jugar en una columna llena", () => {
    const s = play([0, 0, 0, 0, 0, 0]);
    expect(connect4.isLegal(s, { col: 0 })).toBe(false);
    expect(connect4.explainIllegal(s, { col: 0 })).toMatch(/llena/);
    expect(connect4.legalMoves(s)).toHaveLength(6);
  });

  it("detecta victoria horizontal, vertical y diagonal", () => {
    expect(connect4.status(play([0, 0, 1, 1, 2, 2, 3]))).toEqual({ kind: "win", winner: "A" });
    expect(connect4.status(play([0, 1, 0, 1, 0, 1, 0]))).toEqual({ kind: "win", winner: "A" });
    // Diagonal para A: columnas 0,1,2,3 con alturas 1,2,3,4
    const diag = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(connect4.status(diag)).toEqual({ kind: "win", winner: "A" });
  });

  it("detecta empate con el tablero lleno", () => {
    // Tablero lleno sin cuatro en línea: filas alternadas por pares.
    const rows = ["ABABABA", "ABABABA", "BABABAB", "BABABAB", "ABABABA", "ABABABA"];
    const cells = rows.join("").split("") as ("A" | "B")[];
    const s: C4State = { cells, current: "A", last: null };
    expect(connect4.status(s)).toEqual({ kind: "draw" });
    expect(connect4.legalMoves(s)).toHaveLength(0);
  });

  it("la pista gana cuando puede", () => {
    const s = play([0, 6, 1, 6, 2, 5]);
    expect(connect4.suggest!(s)?.move).toEqual({ col: 3 });
  });

  it("la pista bloquea una victoria inmediata", () => {
    // B tiene tres seguidas en 0,1,2; le toca a A
    const s = play([6, 0, 6, 1, 5, 2]);
    expect(connect4.suggest!(s)?.move).toEqual({ col: 3 });
    expect(connect4.suggest!(s)?.reason).toMatch(/tapar/);
  });

  it("la pista devuelve una jugada legal en posición abierta", () => {
    const s = play([3, 3, 2]);
    const h = connect4.suggest!(s)!;
    expect(connect4.isLegal(s, h.move)).toBe(true);
    expect(h.reason.length).toBeGreaterThan(5);
  });

  it("no muta el estado anterior", () => {
    const s0 = connect4.initialState("A");
    const s1 = connect4.applyMove(s0, { col: 2 });
    expect(s0.cells.every((c) => c === null)).toBe(true);
    expect(s1.cells[5 * 7 + 2]).toBe("A");
  });
});
