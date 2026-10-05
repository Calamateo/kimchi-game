import { describe, expect, it } from "vitest";
import { count, flipsFor, movesFor, reversi, type ReversiState } from "./engine";

const idx = (r: number, c: number) => r * 8 + c;

function fromDiagram(diagram: string, current: "A" | "B" = "A"): ReversiState {
  const rows = diagram.trim().split("\n").map((l) => l.trim());
  const board = Array<"A" | "B" | null>(64).fill(null);
  rows.forEach((line, r) => {
    for (let c = 0; c < 8; c++) {
      const ch = line[c];
      if (ch === "A" || ch === "B") board[idx(r, c)] = ch;
    }
  });
  return { board, current, last: null, skipped: false };
}

describe("Reversi", () => {
  it("empieza con 4 piezas y 4 jugadas posibles", () => {
    const s = reversi.initialState("A");
    expect(count(s.board, "A")).toBe(2);
    expect(count(s.board, "B")).toBe(2);
    expect(reversi.legalMoves(s)).toHaveLength(4);
    expect(reversi.legalMoves(s).map((m) => m.cell).sort((a, b) => a - b)).toEqual([
      idx(2, 3),
      idx(3, 2),
      idx(4, 5),
      idx(5, 4),
    ]);
  });

  it("voltea las piezas encerradas en todas las direcciones", () => {
    const s = fromDiagram(`
      ........
      ........
      ..BBB...
      ..BAB...
      ..BBB...
      ........
      ........
      ........
    `);
    // A no tiene jugadas desde el centro rodeado... pero colocar en (1,3) encierra (2,3)
    expect(flipsFor(s.board, idx(1, 3), "A")).toEqual([idx(2, 3)]);
    const next = reversi.applyMove(s, { cell: idx(1, 3) });
    expect(next.board[idx(2, 3)]).toBe("A");
    expect(next.board[idx(1, 3)]).toBe("A");
    expect(next.last).toEqual({ cell: idx(1, 3), flipped: [idx(2, 3)] });
  });

  it("rechaza casillas ocupadas y jugadas que no voltean nada", () => {
    const s = reversi.initialState("A");
    expect(reversi.isLegal(s, { cell: idx(3, 3) })).toBe(false);
    expect(reversi.explainIllegal(s, { cell: idx(3, 3) })).toMatch(/ocupada/);
    expect(reversi.isLegal(s, { cell: 0 })).toBe(false);
    expect(reversi.explainIllegal(s, { cell: 0 })).toMatch(/encierras/);
  });

  it("si la pareja no puede mover, repite turno quien sí puede", () => {
    const s = fromDiagram(`
      BAAAAAB.
      ........
      ........
      ........
      ........
      ........
      ........
      .BAAAAAA
    `, "A");
    // A juega en (0,7) y voltea la B de (0,6). B conserva dos fichas pero
    // ninguna jugada; A sí tiene (7,0), así que repite turno.
    const next = reversi.applyMove(s, { cell: idx(0, 7) });
    expect(count(next.board, "B")).toBe(2);
    expect(movesFor(next.board, "B")).toHaveLength(0);
    expect(next.skipped).toBe(true);
    expect(next.current).toBe("A");
    expect(reversi.status(next)).toEqual({ kind: "playing" });
  });

  it("si nadie puede mover tras la jugada, el estado termina", () => {
    const s = fromDiagram(`
      ........
      ........
      ........
      ...AB...
      ........
      ........
      ........
      ........
    `, "A");
    const next = reversi.applyMove(s, { cell: idx(3, 5) });
    expect(count(next.board, "B")).toBe(0);
    expect(next.skipped).toBe(false);
    expect(reversi.status(next)).toEqual({ kind: "win", winner: "A" });
  });

  it("termina cuando nadie puede mover y gana quien tiene más", () => {
    const s = fromDiagram(`
      BAAAAAAB
      ABAAAAAB
      AABAAAAB
      AAABAAAB
      BBBBBBBB
      BBBBBBBB
      BBBBBBBB
      BBBBBBB.
    `, "B");
    expect(movesFor(s.board, "A")).toHaveLength(0);
    expect(movesFor(s.board, "B")).toHaveLength(0);
    expect(reversi.status(s)).toEqual({ kind: "win", winner: "B" });
  });

  it("empata con el mismo número de piezas", () => {
    const s = fromDiagram(`
      AAAAAAAA
      AAAAAAAA
      AAAAAAAA
      AAAAAAAA
      BBBBBBBB
      BBBBBBBB
      BBBBBBBB
      BBBBBBBB
    `);
    expect(reversi.status(s)).toEqual({ kind: "draw" });
  });

  it("la pista toma una esquina si puede", () => {
    const t = fromDiagram(`
      .BA.....
      ........
      ........
      ........
      ........
      ........
      ........
      ........
    `, "A");
    expect(reversi.suggest!(t)?.move).toEqual({ cell: 0 });
    expect(reversi.suggest!(t)?.reason).toMatch(/esquina/);
  });

  it("la pista devuelve jugadas legales desde la apertura", () => {
    const s = reversi.initialState("B");
    const h = reversi.suggest!(s)!;
    expect(reversi.isLegal(s, h.move)).toBe(true);
  });

  it("no muta el estado anterior", () => {
    const s0 = reversi.initialState("A");
    const s1 = reversi.applyMove(s0, { cell: idx(2, 3) });
    expect(s0.board[idx(2, 3)]).toBeNull();
    expect(s1.board[idx(2, 3)]).toBe("A");
    expect(s1.board[idx(3, 3)]).toBe("A");
  });
});
