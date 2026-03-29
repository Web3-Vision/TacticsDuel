import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let recentMatches: Array<{
    id: string;
    home_user_id: string;
    home_score: number;
    away_score: number;
    match_type: string;
    completed_at: string;
  }> = [];

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;

    const { data: matches } = await supabase
      .from("matches")
      .select("id, home_user_id, home_score, away_score, match_type, completed_at")
      .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5);

    recentMatches = (matches ?? []) as typeof recentMatches;
  }

  const division = profile
    ? DIVISIONS.find((d) => d.id === profile.division)
    : null;

  // Last 5 results
  const last5 = recentMatches.map((m) => {
    const isHome = m.home_user_id === user?.id;
    const myScore = isHome ? m.home_score : m.away_score;
    const theirScore = isHome ? m.away_score : m.home_score;
    if (myScore > theirScore) return "W";
    if (myScore < theirScore) return "L";
    return "D";
  });

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Division progress */}
      {profile && division && (
        <div className="bg-surface border border-border rounded-md p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
              {division.name}
            </span>
            <span className="font-mono text-xs text-text-mid tabular-nums">
              {profile.division_points}
              {division.pointsToPromote
                ? ` / ${division.pointsToPromote}`
                : ""}{" "}
              pts
            </span>
          </div>
          {division.pointsToPromote && (
            <div className="h-1.5 bg-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${Math.min(100, Math.max(0, (profile.division_points / division.pointsToPromote) * 100))}%`,
                }}
              />
            </div>
          )}
          {/* Last 5 + record */}
          <div className="flex items-center gap-2 mt-2">
            {last5.length > 0 && (
              <div className="flex gap-1">
                {last5.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-4 h-4 rounded-sm flex items-center justify-center font-mono text-[8px] font-semibold",
                      r === "W" && "bg-win/20 text-win",
                      r === "D" && "bg-draw/20 text-draw",
                      r === "L" && "bg-loss/20 text-loss"
                    )}
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1" />
            <span className="font-mono text-xs text-text-mid tabular-nums">
              <span className="text-win">{profile.wins}W</span>{" "}
              <span className="text-draw">{profile.draws}D</span>{" "}
              <span className="text-loss">{profile.losses}L</span>
            </span>
            <span className="font-mono text-xs text-text-dim tabular-nums">
              ELO {profile.elo_rating}
            </span>
          </div>
        </div>
      )}

      {/* Play buttons */}
      <Link
        href="/play"
        className="block w-full h-12 leading-[48px] text-center bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
      >
        Play Match
      </Link>

      <div className="flex gap-2">
        <Link
          href="/squad"
          className="flex-1 block h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Edit Squad
        </Link>
        <Link
          href="/squad/tactics"
          className="flex-1 block h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Tactics
        </Link>
      </div>

      {/* Recent matches */}
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
            Recent
          </span>
          {recentMatches.length > 0 && (
            <Link
              href="/history"
              className="font-mono text-xs text-accent"
            >
              View all
            </Link>
          )}
        </div>
        {recentMatches.length === 0 ? (
          <p className="text-text-mid text-sm">
            No matches yet. Play your first game.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {recentMatches.slice(0, 3).map((m) => {
              const isHome = m.home_user_id === user?.id;
              const myScore = isHome ? m.home_score : m.away_score;
              const theirScore = isHome ? m.away_score : m.home_score;
              const result =
                myScore > theirScore
                  ? "W"
                  : myScore < theirScore
                    ? "L"
                    : "D";

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 h-8"
                >
                  <span
                    className={cn(
                      "font-mono text-xs font-medium w-3",
                      result === "W" && "text-win",
                      result === "D" && "text-draw",
                      result === "L" && "text-loss"
                    )}
                  >
                    {result}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {myScore}-{theirScore}
                  </span>
                  <span className="flex-1 font-mono text-[10px] text-text-dim uppercase">
                    {m.match_type}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team strength */}
      {profile && (
        <div className="bg-surface border border-border rounded-md p-3 flex items-center justify-between">
          <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
            Team Strength
          </span>
          <span className="font-mono text-md text-accent tabular-nums">
            --
          </span>
        </div>
      )}
    </div>
  );
}
