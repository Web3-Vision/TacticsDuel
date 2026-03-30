import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, cn } from "@/lib/utils";
import { Lock, Target, ArrowRightLeft } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Record<string, unknown> | null = null;
  let recentMatches: Array<{
    id: string;
    home_user_id: string;
    home_score: number;
    away_score: number;
    match_type: string;
    completed_at: string;
    home_elo_change: number | null;
    away_elo_change: number | null;
  }> = [];
  let squadCount = 0;
  let hasTactics = false;

  if (user) {
    const [profileRes, matchesRes, squadRes, tacticsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("matches")
        .select("id, home_user_id, home_score, away_score, match_type, completed_at, home_elo_change, away_elo_change")
        .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5),
      supabase.from("squads").select("id").eq("user_id", user.id).eq("is_starter", true),
      supabase.from("tactics").select("id").eq("user_id", user.id).single(),
    ]);

    profile = profileRes.data;
    recentMatches = (matchesRes.data ?? []) as typeof recentMatches;
    squadCount = squadRes.data?.length ?? 0;
    hasTactics = !!tacticsRes.data;
  }

  const division = profile
    ? DIVISIONS.find((d) => d.id === (profile.division as number))
    : null;

  const totalMatches = ((profile?.wins as number) ?? 0) + ((profile?.draws as number) ?? 0) + ((profile?.losses as number) ?? 0);
  const squadLocked = profile?.squad_locked as boolean ?? false;
  const rankedInCycle = profile?.ranked_matches_in_cycle as number ?? 0;
  const transfersRemaining = profile?.transfers_remaining as number ?? 0;
  const divMatchesPlayed = profile?.division_matches_played as number ?? 0;

  // Last 5 results
  const last5 = recentMatches.map((m) => {
    const isHome = m.home_user_id === user?.id;
    const myScore = isHome ? m.home_score : m.away_score;
    const theirScore = isHome ? m.away_score : m.home_score;
    if (myScore > theirScore) return "W";
    if (myScore < theirScore) return "L";
    return "D";
  });

  // Determine next action for the user
  const needsSquad = squadCount < 11;
  const needsTactics = !hasTactics;
  const needsLock = !squadLocked && !needsSquad && !needsTactics;
  const isReady = squadLocked;

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Onboarding prompt for new users */}
      {totalMatches === 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-md p-3">
          <p className="font-mono text-xs text-accent font-medium">Welcome to TacticsDuel</p>
          <p className="font-mono text-[10px] text-text-dim mt-1">
            {needsSquad
              ? "Start by building your squad of 11 players."
              : needsTactics
                ? "Great squad! Now set up your tactics."
                : needsLock
                  ? "Lock your squad to start ranked matches."
                  : "You're ready! Hit Play to start your first match."}
          </p>
        </div>
      )}

      {/* Division progress */}
      {profile && division && (
        <div className="bg-surface border border-border rounded-md p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
              {division.name}
            </span>
            <span className="font-mono text-xs text-text-mid tabular-nums">
              {(profile.division_points as number) ?? 0}
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
                  width: `${Math.min(100, Math.max(0, ((profile.division_points as number) ?? 0) / division.pointsToPromote * 100))}%`,
                }}
              />
            </div>
          )}

          {/* Season + Form + Record */}
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
              <span className="text-win">{profile.wins as number}W</span>{" "}
              <span className="text-draw">{profile.draws as number}D</span>{" "}
              <span className="text-loss">{profile.losses as number}L</span>
            </span>
            <span className="font-mono text-xs text-text-dim tabular-nums">
              ELO {profile.elo_rating as number}
            </span>
          </div>

          {/* Season progress */}
          {divMatchesPlayed > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono text-[10px] text-text-dim">
                Season: {divMatchesPlayed}/10 matches
              </span>
            </div>
          )}
        </div>
      )}

      {/* Cycle status */}
      {profile && (
        <div className={cn(
          "border rounded-md p-3 flex items-center gap-3",
          squadLocked
            ? "bg-accent/5 border-accent/20"
            : transfersRemaining > 0
              ? "bg-gold/5 border-gold/20"
              : "bg-surface border-border"
        )}>
          {squadLocked ? (
            <>
              <Lock size={14} className="text-accent shrink-0" />
              <div className="flex-1">
                <p className="font-mono text-[11px] text-accent">Squad Locked</p>
                <p className="font-mono text-[10px] text-text-dim">{rankedInCycle}/5 ranked matches</p>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn("w-2 h-2 rounded-sm", i < rankedInCycle ? "bg-accent" : "bg-border")} />
                ))}
              </div>
            </>
          ) : transfersRemaining > 0 ? (
            <>
              <ArrowRightLeft size={14} className="text-gold shrink-0" />
              <div>
                <p className="font-mono text-[11px] text-gold">Transfer Window</p>
                <p className="font-mono text-[10px] text-text-dim">{transfersRemaining} transfers remaining</p>
              </div>
            </>
          ) : (
            <>
              <Lock size={14} className="text-text-dim shrink-0" />
              <p className="font-mono text-[10px] text-text-dim">Lock your squad to play ranked</p>
            </>
          )}
        </div>
      )}

      {/* Play button */}
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
          {needsSquad ? "Build Squad" : "Edit Squad"}
        </Link>
        <Link
          href="/squad/tactics"
          className="flex-1 block h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Tactics
        </Link>
      </div>

      {/* Missions preview */}
      <Link
        href="/missions"
        className="bg-surface border border-border rounded-md p-3 flex items-center gap-3 hover:border-border-light transition-colors duration-100"
      >
        <Target size={16} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-xs text-text">Daily Missions</p>
          <p className="font-mono text-[10px] text-text-dim">Complete objectives to earn coins</p>
        </div>
        <span className="font-mono text-xs text-accent">View</span>
      </Link>

      {/* Recent matches */}
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
            Recent
          </span>
          {recentMatches.length > 0 && (
            <Link href="/history" className="font-mono text-xs text-accent">
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
                myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
              const eloChange = isHome ? m.home_elo_change : m.away_elo_change;

              return (
                <div key={m.id} className="flex items-center gap-2 h-8">
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
                  {eloChange != null && m.match_type === "ranked" && (
                    <span className={cn(
                      "font-mono text-[10px] tabular-nums",
                      eloChange > 0 ? "text-win" : eloChange < 0 ? "text-loss" : "text-draw"
                    )}>
                      {eloChange > 0 ? "+" : ""}{eloChange}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
