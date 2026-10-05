import { describe, expect, it } from "vitest";
import { GAMES } from "./registry";
import { TUTORIALS } from "./tutorials";

/**
 * Cada paso de cada tutorial debe poder superarse: la posición está en juego,
 * le toca mover a quien aprende (lado A) y existe al menos una jugada legal
 * que pasa la comprobación del paso.
 */
describe("Tutoriales", () => {
  for (const [type, tutorial] of Object.entries(TUTORIALS)) {
    if (!tutorial) continue;
    const engine = GAMES[type as keyof typeof GAMES].engine!;

    describe(type, () => {
      tutorial.steps.forEach((step, i) => {
        it(`paso ${i + 1} "${step.title}" se puede completar`, () => {
          expect(engine.status(step.state).kind).toBe("playing");
          expect(engine.currentPlayer(step.state)).toBe("A");
          const moves = engine.legalMoves(step.state);
          expect(moves.length).toBeGreaterThan(0);
          const solutions = moves.filter((m: unknown) => {
            const after = engine.applyMove(step.state, m);
            return (step.check?.(m, step.state, after) ?? null) === null;
          });
          expect(solutions.length).toBeGreaterThan(0);
        });
      });

      it("tiene textos de intro, pasos y cierre", () => {
        expect(tutorial.intro.length).toBeGreaterThan(10);
        expect(tutorial.outro.length).toBeGreaterThan(10);
        for (const s of tutorial.steps) {
          expect(s.title.length).toBeGreaterThan(2);
          expect(s.text.length).toBeGreaterThan(10);
          expect(s.success.length).toBeGreaterThan(5);
        }
      });
    });
  }
});
