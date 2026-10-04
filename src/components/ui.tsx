"use client";

import { useEffect, type ReactNode } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "tap inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";
  const sizes = size === "lg" ? "min-h-14 px-6 text-lg" : "min-h-12 px-5 text-base";
  const variants = {
    primary: "bg-accent text-accent-ink shadow-sm",
    secondary: "bg-surface-2 text-ink",
    ghost: "bg-transparent text-ink",
    danger: "bg-rose/15 text-rose",
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-line ${className}`}>
      {children}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="safe-bottom relative w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-xl ring-1 ring-line sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button
            onClick={onClose}
            className="tap flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-lg"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pop rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-lg">
        {message}
      </div>
    </div>
  );
}

export function Dot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        online ? "bg-sage" : "bg-line"
      }`}
      aria-label={online ? "en línea" : "desconectado"}
    />
  );
}
