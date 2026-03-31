import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, cn, getEloRank } from "@/lib/utils";

export default async function ClubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const division = profile
    ? DIVISIONS.find((d) => d.id === profile.division) ?? null
    : null;

  const totalMatches = profile
    ? profile.wins + profile.draws + profile.losses
    : 0;
  const winRate =
    totalMatches > 0 ? Math.round((profile!.wins / totalMatches) * 100) : 0;
  const eloRank = profile ? getEloRank(profile.elo_rating) : null;

  // Get top 10 for a mini leaderboard
  const { data: leaderboard } = await supabase
    .from("profiles")
    .select("id, username, club_name, division, elo_rating, wins, draws, losses")
    .order("elo_rating", { ascending: false })
    .limit(10);

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Club header */}
      {profile && (
        <div className="bg-surface border border-border rounded-md p-4">
          <p className="font-mono text-lg font-semibold text-text">
            {profile.club_name}
          </p>
          <p className="font-mono text-xs text-text-dim mt-0.5">
            Manager: @{profile.username}
          </p>
          <div className="flex gap-4 mt-3">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-text-dim uppercase">ELO</span>
              <span className="font-mono text-md tabular-nums font-semibold" style={{ color: eloRank?.color }}>
                {profile.elo_rating}
              </span>
              {eloRank && (
                <span className="font-mono text-[8px] uppercase" style={{ color: eloRank.color }}>
                  {eloRank.label}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-text-dim uppercase">Record</span>
              <span className="font-mono text-xs tabular-nums">
                <span className="text-win">{profile.wins}W</span>{" "}
                <span className="text-draw">{profile.draws}D</span>{" "}
                <span className="text-loss">{profile.losses}L</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-text-dim uppercase">Win Rate</span>
              <span className="font-mono text-xs text-text tabular-nums">{winRate}%</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-text-dim uppercase">Streak</span>
              <span className="font-mono text-xs text-text tabular-nums">{profile.current_streak}</span>
            </div>
          </div>
        </div>
      )}

      {/* Full division track */}
      {profile && division && (
        <div className="bg-surface border border-border rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
              Division Progress
            </span>
            <span className="font-mono text-xs text-text-mid tabular-nums">
              {profile.division_points}
              {division.pointsToPromote ? ` / ${division.pointsToPromote}` : ""} pts
            </span>
          </div>
          {division.pointsToPromote && (
            <div className="h-1.5 bg-border rounded-sm overflow-hidden mb-3">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${Math.min(100, Math.max(0, (profile.division_points / division.pointsToPromote) * 100))}%`,
                }}
              />
            </div>
          )}
          {/* All divisions track */}
          <div className="flex flex-col gap-1">
            {[...DIVISIONS].reverse().map((d) => {
              const isCurrent = profile.division === d.id;
              const isAbove = d.id < profile.division;
              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex items-center gap-2 h-7 px-2 rounded-[3px]",
                    isCurrent && "bg-accent/10 border border-accent",
                    isAbove && "opacity-40",
                    !isCurrent && !isAbove && "border border-border"
                  )}
                >
                  <span className={cn(
                    "font-mono text-[10px] uppercase w-5 tabular-nums",
                    isCurrent ? "text-accent" : "text-text-dim"
                  )}>
                    {d.id}
                  </span>
                  <span className={cn(
                    "font-mono text-[11px] flex-1",
                    isCurrent ? "text-accent font-medium" : "text-text-mid"
                  )}>
                    {d.name}
                  </span>
                  {d.pointsToPromote && (
                    <span className="font-mono text-[9px] text-text-dim tabular-nums">
                      {d.pointsToPromote}pts
                    </span>
                  )}
                  <span className="font-mono text-[9px] text-gold tabular-nums">
                    {d.rewardCoins}c
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="bg-surface border border-border rounded-md p-3">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
          Achievements
        </span>
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-mid">First Victory</span>
            <span className={cn(
              "font-mono text-[10px]",
              profile && profile.wins > 0 ? "text-accent" : "text-text-dim"
            )}>
              {profile && profile.wins > 0 ? "Unlocked" : "Locked"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-mid">Win Streak x5</span>
            <span className={cn(
              "font-mono text-[10px]",
              profile && profile.best_streak >= 5 ? "text-accent" : "text-text-dim"
            )}>
              {profile && profile.best_streak >= 5 ? "Unlocked" : "Locked"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-mid">10 Matches Played</span>
            <span className={cn(
              "font-mono text-[10px]",
              totalMatches >= 10 ? "text-accent" : "text-text-dim"
            )}>
              {totalMatches >= 10 ? "Unlocked" : `${totalMatches}/10`}
            </span>
          </div>
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="bg-surface border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
            Top Players
          </span>
          <Link href="/club/leaderboard" className="font-mono text-[10px] text-accent">
            View all
          </Link>
        </div>
        {leaderboard?.slice(0, 5).map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "px-3 h-[36px] flex items-center border-b border-border last:border-b-0",
              p.id === user?.id && "bg-accent/5"
            )}
          >
            <span className="font-mono text-xs text-text-dim w-5 tabular-nums">
              {i + 1}
            </span>
            <span className="font-mono text-xs text-text flex-1 truncate">
              {p.club_name}
            </span>
            <span className="font-mono text-xs text-accent tabular-nums">
              {p.elo_rating}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
