"use client";

import { useMatchStore } from "@/lib/stores/match-store";

export default function Scoreboard() {
  const { homeTeam, awayTeam, homeScore, awayScore, currentMinute, stats, isFinished } =
    useMatchStore();

  const homePoss = stats?.homePossession ?? 50;
  const awayPoss = stats?.awayPossession ?? 50;

  return (
    <div className="bg-surface border-b border-border px-4 py-3">
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
      <div className="flex items-center justify-center gap-3 mt-1">
        <span className="font-mono text-xs text-text-dim tabular-nums">
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
  );
}
