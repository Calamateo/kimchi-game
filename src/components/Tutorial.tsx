"use client";

import { useState } from "react";
import Link from "next/link";
import type { GameType } from "@/lib/db";
import { GAMES } from "@/lib/games/registry";
import type { Tutorial as TutorialData } from "@/lib/games/tutorials";
import { GameBoard } from "./games/GameBoard";
import { Button, Toast } from "./ui";

interface Props {
  type: GameType;
  tutorial: TutorialData;
  learnerName: string;
}

type Phase = "intro" | "step" | "done-step" | "outro";

export function Tutorial({ type, tutorial, learnerName }: Props) {
  const meta = GAMES[type];
  const engine = meta.engine!;
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [board, setBoard] = useState<unknown>(tutorial.steps[0].state);
  const [toast, setToast] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const step = tutorial.steps[index];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  function start() {
    setIndex(0);
    setBoard(tutorial.steps[0].state);
    setFeedback(null);
    setPhase("step");
  }

  function onMove(move: unknown) {
    if (phase !== "step") return;
    if (!engine.isLegal(board, move)) {
      showToast(engine.explainIllegal(board, move));
      return;
    }
    const after = engine.applyMove(board, move);
    const problem = step.check?.(move, board, after) ?? null;
    if (problem) {
      // Muestra la jugada un instante y vuelve a empezar el paso.
      setBoard(after);
      showToast(problem);
      setTimeout(() => setBoard(step.state), 900);
      return;
    }
    setBoard(after);
    setFeedback(step.success);
    setPhase("done-step");
  }

  function next() {
    if (index + 1 >= tutorial.steps.length) {
      setPhase("outro");
      return;
    }
    const i = index + 1;
    setIndex(i);
    setBoard(tutorial.steps[i].state);
    setFeedback(null);
    setPhase("step");
  }

  function retry() {
    setBoard(step.state);
    setFeedback(null);
    setPhase("step");
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-8 pt-4">
      <Toast message={toast} />

      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="tap flex min-h-11 items-center gap-1 rounded-full bg-surface px-4 text-sm font-bold ring-1 ring-line"
        >
          ‹ Inicio
        </Link>
        <span className="rounded-full bg-surface px-3 py-2 text-sm font-semibold ring-1 ring-line">
          {meta.emoji} Aprender {meta.name}
        </span>
      </header>

      {phase === "intro" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="text-6xl">{meta.emoji}</div>
          <h1 className="text-3xl font-extrabold">{meta.name}</h1>
          <p className="max-w-sm text-lg leading-snug text-muted">{tutorial.intro}</p>
          <p className="text-sm text-muted">
            {tutorial.steps.length} pasos cortos · sin prisa, {learnerName}
          </p>
          <Button size="lg" onClick={start}>
            Empezar
          </Button>
        </section>
      )}

      {(phase === "step" || phase === "done-step") && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5 px-1" aria-label={`Paso ${index + 1} de ${tutorial.steps.length}`}>
            {tutorial.steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < index ? "bg-sage" : i === index ? "bg-accent" : "bg-line"
                }`}
              />
            ))}
          </div>

          <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              Paso {index + 1} de {tutorial.steps.length}
            </p>
            <h2 className="mt-1 text-xl font-extrabold">{step.title}</h2>
            <p className="mt-2 leading-snug">{feedback ?? step.text}</p>
          </div>

          <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-22rem))]">
            <GameBoard
              type={type}
              state={board}
              mySide="A"
              canPlay={phase === "step"}
              onMove={onMove}
              explain={showToast}
              partnerName="tu pareja"
              guide
              hint={null}
            />
          </div>

          {phase === "done-step" && (
            <div className="pop flex justify-center gap-2">
              <Button variant="secondary" onClick={retry}>
                Repetir
              </Button>
              <Button onClick={next}>
                {index + 1 >= tutorial.steps.length ? "Terminar" : "Siguiente ›"}
              </Button>
            </div>
          )}
        </section>
      )}

      {phase === "outro" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl font-extrabold">¡Lo lograste, {learnerName}!</h1>
          <p className="max-w-sm text-lg leading-snug text-muted">{tutorial.outro}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={start}>
              Repetir
            </Button>
            <Link href="/">
              <Button>Ir a jugar</Button>
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
