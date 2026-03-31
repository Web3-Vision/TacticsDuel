"use client";

import { useMatchStore } from "@/lib/stores/match-store";
import { cn } from "@/lib/utils";

export default function Scoreboard() {
  const { homeTeam, awayTeam, homeScore, awayScore, currentMinute, stats, isFinished, visibleEvents, homeFormation, awayFormation } =
    useMatchStore();

  const homePoss = stats?.homePossession ?? 50;
  const awayPoss = stats?.awayPossession ?? 50;

  // Calculate recent momentum from last ~10 minutes of events
  const recentEvents = visibleEvents.filter(
    (e) => e.minute >= Math.max(0, currentMinute - 10)
  );
  const homeRecent = recentEvents.filter(
    (e) => e.team === "home" && (e.type === "goal" || e.type === "shot_saved" || e.type === "chance_created" || e.type === "corner")
  ).length;
  const awayRecent = recentEvents.filter(
    (e) => e.team === "away" && (e.type === "goal" || e.type === "shot_saved" || e.type === "chance_created" || e.type === "corner")
  ).length;
  const totalRecent = homeRecent + awayRecent || 1;
  const momentumHome = Math.round((homeRecent / totalRecent) * 100);

  // Goal scorers
  const goalEvents = visibleEvents.filter((e) => e.type === "goal");
  const homeGoals = goalEvents.filter((e) => e.team === "home");
  const awayGoals = goalEvents.filter((e) => e.team === "away");

  return (
    <div className="bg-surface border-b border-border">
      {/* Main scoreboard */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <span className="font-mono text-md text-text flex-1 text-right truncate">
            {homeTeam}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-home tabular-nums">
              {homeScore}
            </span>
            <span className="font-mono text-sm text-text-dim">-</span>
            <span className="font-mono text-2xl font-semibold text-away tabular-nums">
              {awayScore}
            </span>
          </div>
          <span className="font-mono text-md text-text flex-1 truncate">
            {awayTeam}
          </span>
        </div>

        {/* Formations */}
        <div className="flex items-center justify-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-text-dim tabular-nums">{homeFormation}</span>
          <span className="font-mono text-[10px] text-text-dim">vs</span>
          <span className="font-mono text-[10px] text-text-dim tabular-nums">{awayFormation}</span>
        </div>

        {/* Goal scorers */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="flex items-start justify-center gap-4 mt-1">
            <div className="flex-1 text-right">
              {homeGoals.map((g, i) => (
                <p key={i} className="font-mono text-[10px] text-text-dim">
                  {g.primaryPlayer} {g.minute}&apos;
                </p>
              ))}
            </div>
            <div className="w-8" />
            <div className="flex-1">
              {awayGoals.map((g, i) => (
                <p key={i} className="font-mono text-[10px] text-text-dim">
                  {g.primaryPlayer} {g.minute}&apos;
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Minute and stats row */}
        <div className="flex items-center justify-center gap-3 mt-1.5">
          <span className={cn(
            "font-mono text-xs tabular-nums",
            isFinished ? "text-text-dim" : "text-accent"
          )}>
            {isFinished ? "FT" : `${currentMinute}'`}
          </span>
          {stats && (
            <>
              <span className="font-mono text-[10px] text-text-dim">
                Poss
              </span>
              <div className="flex items-center gap-1 w-20">
                <span className="font-mono text-[10px] text-home tabular-nums">
                  {homePoss}
                </span>
                <div className="flex-1 h-[3px] flex">
                  <div
                    className="h-full bg-home"
                    style={{ width: `${homePoss}%` }}
                  />
                  <div
                    className="h-full bg-away"
                    style={{ width: `${awayPoss}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-away tabular-nums">
                  {awayPoss}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Momentum bar */}
      {!isFinished && currentMinute > 5 && (
        <div className="h-1 flex">
          <div
            className="h-full bg-home/60 transition-all duration-1000"
            style={{ width: `${momentumHome}%` }}
          />
          <div
            className="h-full bg-away/60 transition-all duration-1000"
            style={{ width: `${100 - momentumHome}%` }}
          />
        </div>
      )}
    </div>
  );
}
