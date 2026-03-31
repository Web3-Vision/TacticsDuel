import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NarrativeFeed from "@/components/narrative/NarrativeFeed";
import { buildNarrativeContent } from "@/lib/narrative/content-system";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-4">
        <p className="font-mono text-sm text-text-mid">Log in to access inbox updates.</p>
      </div>
    );
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_user_id, away_user_id, home_score, away_score, match_type, completed_at, home_elo_change, away_elo_change")
    .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20);

  const typedMatches = (matches ?? []) as Array<{
    id: string;
    home_user_id: string;
    away_user_id: string | null;
    home_score: number;
    away_score: number;
    match_type: string;
    completed_at: string;
    home_elo_change: number | null;
    away_elo_change: number | null;
  }>;

  const participantIds = [...new Set(typedMatches.flatMap((m) => [m.home_user_id, m.away_user_id]).filter(Boolean))] as string[];
  let clubNameByUserId: Record<string, string> = {};
  if (participantIds.length > 0) {
    const { data: clubs } = await supabase
      .from("profiles")
      .select("id, club_name")
      .in("id", participantIds);
    clubNameByUserId = Object.fromEntries((clubs ?? []).map((club) => [club.id, club.club_name]));
  }

  const narrative = buildNarrativeContent({
    userId: user.id,
    matches: typedMatches,
    clubNameByUserId,
  });

  return (
    <div className="p-4 pb-20 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">Club Messaging</p>
          <h1 className="font-mono text-lg text-text mt-1">Inbox</h1>
        </div>
        <Link href="/home" className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
          Back Home
        </Link>
      </header>

      <section className="glass-panel rounded-xl p-3">
        <NarrativeFeed items={narrative.inbox} maxItems={12} emptyLabel="No inbox updates right now." />
      </section>
    </div>
  );
}
