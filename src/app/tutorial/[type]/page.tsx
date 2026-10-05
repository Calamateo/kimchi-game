import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tutorial } from "@/components/Tutorial";
import { TUTORIALS } from "@/lib/games/tutorials";
import type { GameType } from "@/lib/db";

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const tutorial = TUTORIALS[type as GameType];
  if (!tutorial) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <Tutorial
      type={type as GameType}
      tutorial={tutorial}
      learnerName={profile?.display_name ?? "tú"}
    />
  );
}
