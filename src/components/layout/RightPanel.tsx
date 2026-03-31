import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import NarrativeFeed from "@/components/narrative/NarrativeFeed";
import { buildNarrativeContent } from "@/lib/narrative/content-system";

interface RightPanelProps {
  userId: string | null;
}

export default async function RightPanel({ userId }: RightPanelProps) {
  if (!userId) return null;

  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_user_id, away_user_id, home_score, away_score, match_type, completed_at, home_elo_change, away_elo_change")
    .or(`home_user_id.eq.${userId},away_user_id.eq.${userId}`)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(8);

  const recentMatches = (matches ?? []) as Array<{
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

  const participantIds = [...new Set(recentMatches.flatMap((m) => [m.home_user_id, m.away_user_id]).filter(Boolean))] as string[];
  let clubNameByUserId: Record<string, string> = {};
  if (participantIds.length > 0) {
    const { data: clubs } = await supabase
      .from("profiles")
      .select("id, club_name")
      .in("id", participantIds);
    clubNameByUserId = Object.fromEntries((clubs ?? []).map((club) => [club.id, club.club_name]));
  }

  const narrative = buildNarrativeContent({
    userId,
    matches: recentMatches,
    clubNameByUserId,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">
            Inbox
          </span>
          <Link href="/inbox" className="font-mono text-[10px] text-accent">
            Open
          </Link>
        </div>
        <NarrativeFeed items={narrative.inbox} compact maxItems={2} emptyLabel="No inbox updates." />
      </div>

      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">
            News Wire
          </span>
          <Link href="/news" className="font-mono text-[10px] text-accent">
            Open
          </Link>
        </div>
        <NarrativeFeed items={narrative.news} compact maxItems={2} emptyLabel="No news updates." />
      </div>

      {/* Recent matches */}
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">
            Recent Matches
          </span>
          {recentMatches.length > 0 && (
            <Link href="/history" className="font-mono text-[10px] text-accent">
              View all
            </Link>
          )}
        </div>
        {recentMatches.length === 0 ? (
          <p className="font-mono text-xs text-text-mid">No matches yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recentMatches.map((m) => {
              const isHome = m.home_user_id === userId;
              const myScore = isHome ? m.home_score : m.away_score;
              const theirScore = isHome ? m.away_score : m.home_score;
              const result =
                myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";

              return (
                <Link
                  key={m.id}
                  href={`/match/${m.id}`}
                  className="flex items-center gap-2 h-7 hover:text-accent transition-colors duration-100"
                >
                  <span
                    className={cn(
                      "font-mono text-[10px] font-bold w-3",
                      result === "W" && "text-win",
                      result === "D" && "text-draw",
                      result === "L" && "text-loss"
                    )}
                  >
                    {result}
                  </span>
                  <span className="font-mono text-xs tabular-nums">
                    {myScore}-{theirScore}
                  </span>
                  <span className="flex-1 font-mono text-[10px] text-text-dim uppercase">
                    {m.match_type}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
