"use client";

import { useMemo, useState } from "react";
import type { Square } from "chess.js";
import type { Side } from "@/lib/db";
import {
  chess,
  colorOf,
  isInCheck,
  kingSquare,
  load,
  PIECE_NAMES,
  PIECE_TIPS,
  VARIANTS,
  type ChessMove,
  type ChessState,
} from "@/lib/games/chess/engine";
import { Sheet } from "../ui";

interface Props {
  state: ChessState;
  mySide: Side;
  canPlay: boolean;
  onMove: (move: ChessMove) => void;
  explain: (message: string) => void;
  partnerName: string;
  guide?: boolean;
  hint?: ChessMove | null;
}

const GLYPH: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const FILES = "abcdefgh";

function squareName(r: number, c: number): Square {
  return `${FILES[c]}${8 - r}` as Square;
}

export function ChessBoard({
  state,
  mySide,
  canPlay,
  onMove,
  explain,
  partnerName,
  guide = true,
  hint = null,
}: Props) {
  const [sel, setSel] = useState<{ forState: ChessState; from: Square | null } | null>(null);
  const selected = sel && sel.forState === state ? sel.from : null;
  const setSelected = (sq: Square | null) => setSel({ forState: state, from: sq });
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);

  const game = useMemo(() => load(state), [state]);
  const myColor = colorOf(state, mySide);
  const legal = useMemo(() => (canPlay ? chess.legalMoves(state) : []), [state, canPlay]);
  const movable = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const targets = useMemo(() => {
    const map = new Map<Square, { capture: boolean; promotion: boolean }>();
    if (!selected) return map;
    for (const m of legal) {
      if (m.from !== selected) continue;
      const cur = map.get(m.to);
      map.set(m.to, {
        capture: cur?.capture || !!game.get(m.to) || isEnPassant(m, state),
        promotion: cur?.promotion || !!m.promotion,
      });
    }
    return map;
  }, [legal, selected, game, state]);

  const inCheck = isInCheck(state);
  const checkedKing = inCheck ? kingSquare(state, chess.currentPlayer(state)) : null;
  const flipped = myColor === "b";
  const order = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  function tap(sq: Square) {
    if (!canPlay) return;
    const piece = game.get(sq);

    if (!selected) {
      if (piece && piece.color === myColor) {
        if (movable.has(sq)) setSelected(sq);
        else explain(chess.explainIllegal(state, { from: sq, to: sq }));
      } else if (piece) {
        explain(`Esa pieza es de ${partnerName}. Elige una de las tuyas.`);
      } else {
        explain("Primero toca una de tus piezas.");
      }
      return;
    }

    if (sq === selected) {
      setSelected(null);
      return;
    }
    if (piece && piece.color === myColor) {
      if (movable.has(sq)) setSelected(sq);
      else explain(chess.explainIllegal(state, { from: sq, to: sq }));
      return;
    }
    const t = targets.get(sq);
    if (!t) {
      explain(chess.explainIllegal(state, { from: selected, to: sq }));
      return;
    }
    if (t.promotion) {
      setPromo({ from: selected, to: sq });
      return;
    }
    onMove({ from: selected, to: sq });
    setSelected(null);
  }

  function choosePromotion(p: ChessMove["promotion"]) {
    if (!promo) return;
    onMove({ from: promo.from, to: promo.to, promotion: p });
    setPromo(null);
    setSelected(null);
  }

  let help: string | null = null;
  if (canPlay && guide) {
    if (selected) {
      const p = game.get(selected);
      help = p ? PIECE_TIPS[p.type] : null;
    } else if (inCheck) {
      help = "¡Tu rey está en jaque! Tienes que sacarlo del peligro: muévelo, tapa el ataque o captura la pieza que lo amenaza.";
    } else {
      help = VARIANTS[state.variant].promotionWins
        ? "Toca una pieza para ver a dónde puede ir. Recuerda: aquí gana quien corona primero."
        : "Toca una pieza para ver a dónde puede ir.";
    }
  } else if (!canPlay && inCheck && guide && chess.status(state).kind === "playing") {
    help = `${partnerName} está en jaque.`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="board grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl shadow-md ring-4 ring-board-dark"
        role="grid"
        aria-label="Tablero de ajedrez"
      >
        {order.map((r) =>
          order.map((c) => {
            const sq = squareName(r, c);
            const dark = (r + c) % 2 === 1;
            const piece = game.get(sq);
            const target = targets.get(sq);
            const isSelected = selected === sq;
            const isMovable = !selected && movable.has(sq);
            const isLast = state.last?.from === sq || state.last?.to === sq;
            const isHint = hint?.from === sq || hint?.to === sq;
            const isChecked = checkedKing === sq;
            const showCoord = guide && (c === (flipped ? 7 : 0) || r === (flipped ? 0 : 7));
            return (
              <button
                key={sq}
                role="gridcell"
                onClick={() => tap(sq)}
                aria-label={
                  piece
                    ? `${sq}, ${PIECE_NAMES[piece.type]} ${piece.color === myColor ? "tuyo" : `de ${partnerName}`}`
                    : `${sq}, vacía`
                }
                className={`tap relative flex items-center justify-center
                  ${dark ? "bg-board-dark" : "bg-board-light"}
                  ${isLast ? "brightness-110 saturate-150" : ""}
                  ${isSelected ? "ring-inset ring-4 ring-accent" : ""}
                  ${target ? (target.capture ? "ring-inset ring-4 ring-rose" : "") : ""}
                  ${isHint ? "pulse-soft ring-inset ring-4 ring-sky" : ""}
                  ${isChecked ? "bg-rose/70" : ""}`}
              >
                {showCoord && (
                  <span className="pointer-events-none absolute bottom-0 right-0.5 text-[9px] font-bold text-ink/50">
                    {c === (flipped ? 7 : 0) && r === (flipped ? 0 : 7) ? sq : c === (flipped ? 7 : 0) ? sq[1] : sq[0]}
                  </span>
                )}
                {target && !piece && !target.capture && (
                  <span className="pop h-[30%] w-[30%] rounded-full bg-sage/80" />
                )}
                {piece && (
                  <span
                    className={`${isLast ? "pop" : ""} chess-piece select-none leading-none
                      ${piece.color === "w" ? "chess-white" : "chess-black"}
                      ${isMovable ? "drop-shadow-[0_0_6px_var(--accent)]" : ""}`}
                    style={{ fontSize: "min(9.5vw, 3.1rem)" }}
                  >
                    {GLYPH[piece.type]}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {help && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-2.5 text-center text-sm font-semibold ring-1 ring-line ${
            inCheck && canPlay ? "bg-rose/10 text-rose" : "bg-surface"
          }`}
        >
          {help}
        </p>
      )}

      <Sheet open={!!promo} onClose={() => setPromo(null)} title="¡Tu peón corona!">
        <p className="mb-4 text-muted">Elige en qué pieza se convierte. La dama es casi siempre la mejor opción.</p>
        <div className="grid grid-cols-4 gap-2">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button
              key={p}
              onClick={() => choosePromotion(p)}
              className={`tap flex flex-col items-center gap-1 rounded-2xl p-3 ${
                p === "q" ? "bg-accent text-accent-ink" : "bg-surface-2"
              }`}
            >
              <span className="text-4xl leading-none">{GLYPH[p]}</span>
              <span className="text-xs font-bold capitalize">{PIECE_NAMES[p]}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function isEnPassant(m: ChessMove, state: ChessState) {
  const g = load(state);
  const piece = g.get(m.from);
  return !!piece && piece.type === "p" && m.from[0] !== m.to[0] && !g.get(m.to);
}
