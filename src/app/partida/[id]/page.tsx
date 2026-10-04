import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameRoom } from "@/components/GameRoom";
import type { GameRow, ProfileRow } from "@/lib/db";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: game }, { data: profiles }] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, display_name, settings"),
  ]);
  if (!game) notFound();

  return (
    <GameRoom
      initialGame={game as GameRow}
      userId={user.id}
      profiles={(profiles ?? []) as ProfileRow[]}
    />
  );
}
