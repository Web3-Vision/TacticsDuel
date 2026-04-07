import { createClient } from "@/lib/supabase/client";

export async function ensureSquadEditable() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("squad_locked")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to check squad lock");
  }

  if (profile?.squad_locked) {
    throw new Error("Unlock your squad in Team Hub before making changes");
  }

  return { supabase, user };
}
