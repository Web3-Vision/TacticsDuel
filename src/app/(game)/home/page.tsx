import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, getEloRank } from "@/lib/utils";
import DivisionProgress from "@/components/home/DivisionProgress";
import RecentResults from "@/components/home/RecentResults";
import SquadPreview from "@/components/home/SquadPreview";

export default async function HomePage() {
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
    ? DIVISIONS.find((d) => d.id === profile.division) ?? null
    : null;

  const last5 = recentMatches.map((m) => {
    const isHome = m.home_user_id === user?.id;
    const myScore = isHome ? m.home_score : m.away_score;
    const theirScore = isHome ? m.away_score : m.home_score;
    const result = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
    return { result, score: `${myScore}-${theirScore}` };
  });

  const totalMatches = profile
    ? profile.wins + profile.draws + profile.losses
    : 0;
  const winRate =
    totalMatches > 0 ? Math.round((profile!.wins / totalMatches) * 100) : 0;
  const eloRank = profile ? getEloRank(profile.elo_rating) : null;

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Division progress */}
      {profile && division && (
        <DivisionProgress
          profile={profile}
          division={division}
          last5={last5}
        />
      )}

      {/* Quick stats row */}
      {profile && (
        <div className="bg-surface border border-border rounded-md p-3 flex items-center justify-between">
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-dim uppercase">ELO</span>
            <span className="font-mono text-xs tabular-nums font-semibold" style={{ color: eloRank?.color }}>
              {profile.elo_rating}
            </span>
            {eloRank && (
              <span className="font-mono text-[8px] uppercase" style={{ color: eloRank.color }}>
                {eloRank.label}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-dim uppercase">Record</span>
            <span className="font-mono text-[11px] tabular-nums">
              <span className="text-win">{profile.wins}W</span>{" "}
              <span className="text-draw">{profile.draws}D</span>{" "}
              <span className="text-loss">{profile.losses}L</span>
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-dim uppercase">Win %</span>
            <span className="font-mono text-xs text-text tabular-nums">{winRate}%</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-dim uppercase">Coins</span>
            <span className="font-mono text-xs text-gold tabular-nums font-semibold">
              {profile.coins}
            </span>
          </div>
        </div>
      )}

      {/* Quick Play CTA */}
      <Link
        href="/play"
        className="block w-full h-14 leading-[56px] text-center bg-accent text-black font-mono text-md font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
      >
        Play Match
      </Link>

      {/* Squad Preview */}
      <SquadPreview />

      {/* Season stats */}
      {profile && (
        <div className="bg-surface border border-border rounded-md p-3">
          <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
            Season Stats
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-text-mid">Matches</span>
              <span className="font-mono text-xs text-text tabular-nums">{totalMatches}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-text-mid">Win Rate</span>
              <span className="font-mono text-xs text-text tabular-nums">{winRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-text-mid">Current Streak</span>
              <span className="font-mono text-xs text-accent tabular-nums">{profile.current_streak}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-text-mid">Best Streak</span>
              <span className="font-mono text-xs text-gold tabular-nums">{profile.best_streak}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent matches */}
      {user && <RecentResults matches={recentMatches} userId={user.id} />}

      {/* Objectives placeholder */}
      <div className="bg-surface border border-border rounded-md p-3">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
          Objectives
        </span>
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-mid">
              Play 3 ranked matches
            </span>
            <span className="font-mono text-[10px] text-text-dim">0/3</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-mid">
              Win a match with 60%+ possession
            </span>
            <span className="font-mono text-[10px] text-text-dim">0/1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
