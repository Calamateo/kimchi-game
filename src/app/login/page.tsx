import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="safe-top safe-bottom flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-4xl shadow-md">
          🎲
        </div>
        <h1 className="text-3xl font-extrabold">Kimchi</h1>
        <p className="mt-1 text-muted">Juegos de mesa para dos</p>
      </div>
      <LoginForm />
    </main>
  );
}
