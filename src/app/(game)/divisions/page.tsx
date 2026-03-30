import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, cn } from "@/lib/utils";
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from "lucide-react";

export default async function DivisionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myProfile: Record<string, unknown> | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    myProfile = data;
  }

  const myDivision = myProfile?.division as number ?? 10;
  const divConfig = DIVISIONS.find((d) => d.id === myDivision);

  // Fetch players in my division
  const { data: divisionPlayers } = await supabase
    .from("profiles")
    .select("id, username, club_name, division, division_points, elo_rating, wins, draws, losses, current_streak, division_wins, division_draws, division_losses, division_matches_played")
    .eq("division", myDivision)
    .order("division_points", { ascending: false })
    .limit(50);

  // Fetch recent matches for form calculation (last 5 for current user)
  let myRecentForm: string[] = [];
  if (user) {
    const { data: recentMatches } = await supabase
      .from("matches")
      .select("home_user_id, home_score, away_score")
      .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
      .eq("status", "completed")
      .eq("match_type", "ranked")
      .order("completed_at", { ascending: false })
      .limit(5);

    myRecentForm = (recentMatches ?? []).map((m) => {
      const isHome = m.home_user_id === user?.id;
      const myScore = isHome ? m.home_score : m.away_score;
      const theirScore = isHome ? m.away_score : m.home_score;
      if (myScore > theirScore) return "W";
      if (myScore < theirScore) return "L";
      return "D";
    });
  }

  // Global top 25
  const { data: globalTop } = await supabase
    .from("profiles")
    .select("id, username, club_name, division, elo_rating, wins, draws, losses")
    .order("elo_rating", { ascending: false })
    .limit(25);

  const divisionMatchesPlayed = (myProfile?.division_matches_played as number) ?? 0;
  const divisionSeason = (myProfile?.division_season as number) ?? 1;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Division header */}
      {myProfile && divConfig && (
        <div className="bg-surface border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-gold" />
              <span className="font-mono text-md font-medium">{divConfig.name}</span>
              <span className="font-mono text-[10px] text-text-dim uppercase">Div {divConfig.id}</span>
            </div>
            <span className="font-mono text-xs text-text-dim">
              Season {divisionSeason}
            </span>
          </div>

          {/* Progress bar */}
          {divConfig.pointsToPromote && (
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[10px] text-text-dim">
                  {(myProfile.division_points as number) ?? 0} / {divConfig.pointsToPromote} pts
                </span>
                <span className="font-mono text-[10px] text-accent">
                  {divisionMatchesPlayed}/10 matches
                </span>
              </div>
              <div className="h-2 bg-border rounded-sm overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((myProfile.division_points as number) ?? 0) / divConfig.pointsToPromote * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Form */}
          {myRecentForm.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] text-text-dim uppercase">Form</span>
              <div className="flex gap-1">
                {myRecentForm.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-5 h-5 rounded-sm flex items-center justify-center font-mono text-[9px] font-bold",
                      r === "W" && "bg-win/20 text-win",
                      r === "D" && "bg-draw/20 text-draw",
                      r === "L" && "bg-loss/20 text-loss"
                    )}
                  >
                    {r}
                  </div>
                ))}
              </div>
              <div className="flex-1" />
              <span className="font-mono text-xs text-text-mid tabular-nums">
                <span className="text-win">{(myProfile.division_wins as number) ?? 0}W</span>{" "}
                <span className="text-draw">{(myProfile.division_draws as number) ?? 0}D</span>{" "}
                <span className="text-loss">{(myProfile.division_losses as number) ?? 0}L</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Division standings */}
      <div>
        <h2 className="font-mono text-xs text-text-dim uppercase tracking-wide mb-2">
          {divConfig?.name ?? "Division"} Standings
        </h2>
        <div className="bg-surface border border-border rounded-md overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border flex items-center bg-surface-alt">
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-7">#</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide flex-1">Club</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-12 text-right">Pts</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-14 text-right">W-D-L</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-10 text-right">ELO</span>
          </div>

          {divisionPlayers && divisionPlayers.length > 0 ? (
            divisionPlayers.map((p, i) => {
              const rank = i + 1;
              const isMe = p.id === user?.id;
              const inPromoZone = rank <= 3;
              const inRelegationZone = divisionPlayers.length > 6 && rank > divisionPlayers.length - 3;
              const dWins = (p.division_wins as number) ?? p.wins;
              const dDraws = (p.division_draws as number) ?? p.draws;
              const dLosses = (p.division_losses as number) ?? p.losses;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "px-3 h-[44px] flex items-center border-b border-border last:border-b-0",
                    isMe && "bg-accent/5",
                    inPromoZone && !isMe && "border-l-2 border-l-win",
                    inRelegationZone && !isMe && "border-l-2 border-l-loss",
                    isMe && inPromoZone && "border-l-2 border-l-win",
                    isMe && inRelegationZone && "border-l-2 border-l-loss"
                  )}
                >
                  <span className={cn(
                    "font-mono text-xs w-7 tabular-nums",
                    inPromoZone ? "text-win" : inRelegationZone ? "text-loss" : "text-text-dim"
                  )}>
                    {rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-mono text-xs truncate",
                      isMe ? "text-accent font-medium" : "text-text"
                    )}>
                      {p.club_name}
                      {isMe && <span className="text-accent ml-1">(you)</span>}
                    </p>
                    <p className="font-mono text-[10px] text-text-dim truncate">
                      @{p.username}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-gold w-12 text-right tabular-nums font-medium">
                    {p.division_points ?? 0}
                  </span>
                  <span className="font-mono text-[10px] text-text-dim w-14 text-right tabular-nums">
                    {dWins}-{dDraws}-{dLosses}
                  </span>
                  <span className="font-mono text-xs text-accent w-10 text-right tabular-nums">
                    {p.elo_rating}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-text-mid text-sm text-center py-6">
              No players in this division yet.
            </p>
          )}
        </div>

        {/* Zone legend */}
        <div className="flex gap-4 mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <ChevronUp size={12} className="text-win" />
            <span className="font-mono text-[10px] text-text-dim">Promotion (top 3)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ChevronDown size={12} className="text-loss" />
            <span className="font-mono text-[10px] text-text-dim">Relegation (bottom 3)</span>
          </div>
        </div>
      </div>

      {/* Global leaderboard */}
      <div>
        <h2 className="font-mono text-xs text-text-dim uppercase tracking-wide mb-2">
          Global Rankings
        </h2>
        <div className="bg-surface border border-border rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center bg-surface-alt">
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-7">#</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide flex-1">Club</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-10 text-right">Div</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-12 text-right">ELO</span>
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-16 text-right">W-D-L</span>
          </div>
          {globalTop?.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                "px-3 h-[40px] flex items-center border-b border-border last:border-b-0",
                p.id === user?.id && "bg-accent/5"
              )}
            >
              <span className="font-mono text-xs text-text-dim w-7 tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-text truncate">
                  {p.club_name}
                </p>
              </div>
              <span className="font-mono text-xs text-text-dim w-10 text-right">
                {p.division}
              </span>
              <span className="font-mono text-xs text-accent w-12 text-right tabular-nums">
                {p.elo_rating}
              </span>
              <span className="font-mono text-[10px] text-text-dim w-16 text-right tabular-nums">
                {p.wins}-{p.draws}-{p.losses}
              </span>
            </div>
          ))}
          {(!globalTop || globalTop.length === 0) && (
            <p className="text-text-mid text-sm text-center py-6">
              No players yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
