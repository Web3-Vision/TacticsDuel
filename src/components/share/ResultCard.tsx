"use client";

import { cn } from "@/lib/utils";

interface ResultCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  eloChange?: number;
  divPointsChange?: number;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  matchType?: string;
  division?: string;
}

export default function ResultCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  eloChange,
  divPointsChange,
  possession,
  shots,
  matchType,
  division,
}: ResultCardProps) {
  const result = homeScore > awayScore ? "VICTORY" : homeScore < awayScore ? "DEFEAT" : "DRAW";
  const resultColor = homeScore > awayScore ? "text-win" : homeScore < awayScore ? "text-loss" : "text-draw";

  return (
    <div className="w-[340px] bg-bg border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="bg-surface-alt px-4 py-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">
          {matchType === "ranked" ? "Ranked Match" : "Match Result"}
        </span>
        {division && (
          <span className="font-mono text-[10px] text-gold uppercase">{division}</span>
        )}
      </div>

      {/* Score */}
      <div className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-sm text-text flex-1 text-right truncate">{homeTeam}</span>
          <span className="font-mono text-3xl font-semibold text-home tabular-nums">{homeScore}</span>
          <span className="font-mono text-lg text-text-dim">-</span>
          <span className="font-mono text-3xl font-semibold text-away tabular-nums">{awayScore}</span>
          <span className="font-mono text-sm text-text flex-1 text-left truncate">{awayTeam}</span>
        </div>
        <p className={cn("font-mono text-xs uppercase tracking-wide mt-1 font-medium", resultColor)}>
          {result}
        </p>
      </div>

      {/* Stats */}
      <div className="px-4 pb-3 flex justify-center gap-6">
        <div className="text-center">
          <p className="font-mono text-[10px] text-text-dim uppercase">Poss</p>
          <p className="font-mono text-xs tabular-nums">
            <span className="text-home">{possession.home}%</span>
            <span className="text-text-dim mx-1">-</span>
            <span className="text-away">{possession.away}%</span>
          </p>
        </div>
        <div className="text-center">
          <p className="font-mono text-[10px] text-text-dim uppercase">Shots</p>
          <p className="font-mono text-xs tabular-nums">
            <span className="text-home">{shots.home}</span>
            <span className="text-text-dim mx-1">-</span>
            <span className="text-away">{shots.away}</span>
          </p>
        </div>
        {eloChange != null && (
          <div className="text-center">
            <p className="font-mono text-[10px] text-text-dim uppercase">ELO</p>
            <p className={cn(
              "font-mono text-xs tabular-nums font-medium",
              eloChange > 0 ? "text-win" : eloChange < 0 ? "text-loss" : "text-draw"
            )}>
              {eloChange > 0 ? "+" : ""}{eloChange}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-surface-alt px-4 py-1.5 text-center">
        <span className="font-mono text-[9px] text-text-dim uppercase tracking-widest">
          TacticsDuel
        </span>
      </div>
    </div>
  );
}
