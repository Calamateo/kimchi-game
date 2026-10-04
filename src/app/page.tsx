import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Lobby } from "@/components/Lobby";
import type { GameRow, ProfileRow } from "@/lib/db";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profiles }, { data: games }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, settings"),
    supabase
      .from("games")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <Lobby
      userId={user.id}
      profiles={(profiles ?? []) as ProfileRow[]}
      initialGames={(games ?? []) as GameRow[]}
    />
  );
}
