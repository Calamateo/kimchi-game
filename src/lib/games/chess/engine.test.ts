import { describe, expect, it } from "vitest";
import { chess, isInCheck, kingSquare, registerLesson, VARIANTS, type ChessState } from "./engine";
import { suggestChess } from "./ai";

function play(uci: string[], variant: ChessState["variant"] = "full", first: "A" | "B" = "A"): ChessState {
  return uci.reduce(
    (s, u) =>
      chess.applyMove(s, {
        from: u.slice(0, 2) as never,
        to: u.slice(2, 4) as never,
        promotion: (u[4] as never) || undefined,
      }),
    chess.initialState(first, { variant }),
  );
}

describe("Ajedrez", () => {
  it("empieza en la posición inicial con 20 jugadas y las blancas para el primer jugador", () => {
    const s = chess.initialState("B");
    expect(s.white).toBe("B");
    expect(chess.currentPlayer(s)).toBe("B");
    expect(chess.legalMoves(s)).toHaveLength(20);
    expect(s.fen).toBe(VARIANTS.full.fen);
  });

  it("aplica jugadas y alterna el turno", () => {
    const s = play(["e2e4", "e7e5"]);
    expect(s.moves).toEqual(["e2e4", "e7e5"]);
    expect(chess.currentPlayer(s)).toBe("A");
    expect(s.last).toEqual({ from: "e7", to: "e5" });
  });

  it("rechaza jugadas ilegales con explicación", () => {
    const s = chess.initialState("A");
    expect(chess.isLegal(s, { from: "e2", to: "e5" })).toBe(false);
    expect(chess.explainIllegal(s, { from: "e2", to: "e5" })).toMatch(/peón/);
    expect(chess.explainIllegal(s, { from: "e7", to: "e5" })).toMatch(/de tu pareja/);
    expect(chess.explainIllegal(s, { from: "e4", to: "e5" })).toMatch(/ninguna pieza/);
    expect(chess.explainIllegal(s, { from: "b1", to: "d2" })).toMatch(/ocupa una pieza tuya/);
    expect(chess.explainIllegal(s, { from: "a1", to: "a3" })).toMatch(/torre/);
    expect(chess.explainIllegal(s, { from: "b1", to: "b3" })).toMatch(/caballo/);
  });

  it("detecta jaque mate (mate del pastor)", () => {
    const s = play(["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]);
    expect(chess.status(s)).toEqual({ kind: "win", winner: "A" });
    expect(chess.legalMoves(s)).toHaveLength(0);
  });

  it("detecta jaque y explica que hay que protegerse", () => {
    const s = play(["e2e4", "f7f6", "d1h5"]);
    expect(isInCheck(s)).toBe(true);
    expect(kingSquare(s, "B")).toBe("e8");
    expect(chess.explainIllegal(s, { from: "a7", to: "a6" })).toMatch(/jaque/);
  });

  it("detecta tablas por ahogado", () => {
    // Partida real más corta conocida que termina en rey ahogado
    const real = play(["e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6", "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6"]);
    expect(chess.status(real)).toEqual({ kind: "draw" });
    expect(chess.legalMoves(real)).toHaveLength(0);
  });

  it("en la variante de peones gana quien corona primero", () => {
    const s = play(["a2a4", "h7h6", "a4a5", "h6h5", "a5a6", "h5h4", "a6b7", "h4h3", "b7b8q"], "pawns");
    expect(s.promoted).toBe("A");
    expect(chess.status(s)).toEqual({ kind: "win", winner: "A" });
  });

  it("en ajedrez completo coronar no termina la partida", () => {
    const s = play(["a2a4", "h7h6", "a4a5", "h6h5", "a5a6", "h5h4", "a6b7", "h4h3", "b7a8q"], "full");
    expect(s.promoted).toBe("A");
    expect(chess.status(s).kind).toBe("playing");
  });

  it("la coronación exige elegir pieza", () => {
    const s = play(["a2a4", "h7h6", "a4a5", "h6h5", "a5a6", "h5h4", "a6b7", "h4h3"]);
    expect(chess.isLegal(s, { from: "b7", to: "a8" })).toBe(false);
    expect(chess.explainIllegal(s, { from: "b7", to: "a8" })).toMatch(/corona/);
    expect(chess.isLegal(s, { from: "b7", to: "a8", promotion: "q" })).toBe(true);
  });

  it("las variantes de aprendizaje arrancan sin enroque y con las piezas indicadas", () => {
    const minor = chess.initialState("A", { variant: "minor" });
    expect(minor.fen).toContain("1NB1KBN1");
    expect(chess.rematchOptions!(minor)).toEqual({ variant: "minor" });
    const major = chess.initialState("A", { variant: "major" });
    expect(chess.legalMoves(major).length).toBeGreaterThan(16);
  });

  it("la pista da mate si puede y devuelve jugadas legales", () => {
    const s = play(["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6"]);
    const h = suggestChess(s)!;
    expect(h.move).toEqual({ from: "h5", to: "f7", promotion: undefined });
    expect(h.reason).toMatch(/mate/);

    const open = chess.initialState("A");
    const h2 = suggestChess(open)!;
    expect(chess.isLegal(open, h2.move)).toBe(true);
  });

  it("la pista prefiere coronar en la variante de peones", () => {
    const s = play(["a2a4", "h7h6", "a4a5", "h6h5", "a5a6", "h5h4", "a6b7", "h4h3"], "pawns");
    const h = suggestChess(s)!;
    expect(h.move.to).toBe("b8");
    expect(h.move.promotion).toBeDefined();
    expect(h.reason).toMatch(/Coronas/);
  });

  it("las lecciones del tutorial se reconstruyen desde su FEN", () => {
    const variant = registerLesson("7k/6pp/8/8/8/8/8/R3K3 w - - 0 1");
    const s = chess.initialState("A", { variant });
    expect(chess.legalMoves(s).length).toBeGreaterThan(0);
    const mate = chess.applyMove(s, { from: "a1", to: "a8" });
    expect(chess.status(mate)).toEqual({ kind: "win", winner: "A" });
  });

  it("no muta el estado anterior", () => {
    const s0 = chess.initialState("A");
    const s1 = chess.applyMove(s0, { from: "e2", to: "e4" });
    expect(s0.moves).toHaveLength(0);
    expect(s1.moves).toHaveLength(1);
  });
});
