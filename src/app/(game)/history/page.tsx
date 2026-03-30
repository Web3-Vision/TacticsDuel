import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-4">
        <p className="text-text-mid text-sm">Log in to view match history.</p>
      </div>
    );
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-4">
      <h1 className="font-mono text-lg uppercase tracking-wide mb-4">
        Match History
      </h1>
      {!matches || matches.length === 0 ? (
        <p className="text-text-mid text-sm">
          No matches yet. Play your first game.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {matches.map((match) => {
            const isHome = match.home_user_id === user.id;
            const myScore = isHome ? match.home_score : match.away_score;
            const theirScore = isHome ? match.away_score : match.home_score;
            const result =
              myScore > theirScore
                ? "W"
                : myScore < theirScore
                  ? "L"
                  : "D";
            const eloChange = isHome
              ? match.home_elo_change
              : match.away_elo_change;

            return (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                className="h-[44px] flex items-center gap-2 px-3 bg-surface border border-border rounded-[4px] hover:border-border-light transition-colors duration-100"
              >
                <span
                  className={cn(
                    "font-mono text-xs font-medium w-4",
                    result === "W" && "text-win",
                    result === "D" && "text-draw",
                    result === "L" && "text-loss"
                  )}
                >
                  {result}
                </span>
                <span className="font-mono text-md tabular-nums">
                  {myScore}-{theirScore}
                </span>
                <span className="flex-1 font-mono text-xs text-text-dim uppercase">
                  {match.match_type}
                </span>
                {eloChange != null && (
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      eloChange > 0 ? "text-win" : eloChange < 0 ? "text-loss" : "text-draw"
                    )}
                  >
                    {eloChange > 0 ? "+" : ""}
                    {eloChange}
                  </span>
                )}
                <span className="font-mono text-[10px] text-text-dim">
                  {match.completed_at
                    ? new Date(match.completed_at).toLocaleDateString()
                    : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
