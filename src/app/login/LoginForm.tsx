"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setLoading(false);
      setError(
        error.message.includes("Invalid login")
          ? "Correo o contraseña incorrectos. Revisa e intenta otra vez."
          : "No se pudo entrar. Revisa tu conexión e intenta de nuevo.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-muted">Correo</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-14 rounded-2xl bg-surface px-4 text-lg ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-muted">Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-14 rounded-2xl bg-surface px-4 text-lg ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-2xl bg-rose/10 px-4 py-3 text-sm font-semibold text-rose">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={loading} className="mt-2">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
      <p className="mt-4 text-center text-sm text-muted">
        Solo se inicia sesión una vez por dispositivo.
      </p>
    </form>
  );
}
