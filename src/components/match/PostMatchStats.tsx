"use client";

import { useState, useEffect, useRef } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Trophy, Star } from "lucide-react";

interface RankedMeta {
  matchId: string;
  matchType: string;
  homeEloChange: number;
  awayEloChange: number;
  homeDivPointsChange: number;
  awayDivPointsChange: number;
}

function StatRow({
  label,
  home,
  away,
}: {
  label: string;
  home: number;
  away: number;
}) {
  const total = home + away || 1;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-home tabular-nums">{home}</span>
        <span className="font-mono text-[10px] text-text-dim uppercase">
          {label}
        </span>
        <span className="font-mono text-xs text-away tabular-nums">{away}</span>
      </div>
      <div className="flex h-[3px] gap-px">
        <div
          className="h-full bg-home"
          style={{ width: `${(home / total) * 100}%` }}
        />
        <div
          className="h-full bg-away"
          style={{ width: `${(away / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function PostMatchStats() {
  const { stats, homeScore, awayScore, isFinished, homeTeam, awayTeam, playerRatings, manOfTheMatch } =
    useMatchStore();
  const [rankedMeta, setRankedMeta] = useState<RankedMeta | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("lastRankedMatch");
      if (stored) {
        try {
          setRankedMeta(JSON.parse(stored));
          sessionStorage.removeItem("lastRankedMatch");
        } catch { /* ignore */ }
      }
    }
  }, []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const didSave = useRef(false);

  useEffect(() => {
    if (!isFinished || !stats || didSave.current) return;
    didSave.current = true;

    async function persistResult() {
      setSaving(true);
      try {
        const res = await fetch("/api/match/record-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            homeScore,
            awayScore,
            stats,
            events: useMatchStore.getState().events,
          }),
        });
        if (res.ok) setSaved(true);
      } catch {
        // silent fail — match still shows locally
      } finally {
        setSaving(false);
      }
    }
    persistResult();
  }, [isFinished, stats, homeScore, awayScore]);

  if (!isFinished || !stats) return null;

  const result =
    homeScore > awayScore ? "VICTORY" : homeScore < awayScore ? "DEFEAT" : "DRAW";
  const resultColor =
    homeScore > awayScore ? "text-win" : homeScore < awayScore ? "text-loss" : "text-draw";

  const eloChange = rankedMeta?.homeEloChange ?? 0;
  const divPointsChange = rankedMeta?.homeDivPointsChange ?? 0;
  const isRanked = rankedMeta?.matchType === "ranked";

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Result header */}
      <div className="text-center">
        <p className="font-mono text-xs text-text-dim uppercase tracking-wide">
          Full Time
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums mt-1">
          <span className="text-home">{homeScore}</span>
          <span className="text-text-dim mx-2">-</span>
          <span className="text-away">{awayScore}</span>
        </p>
        <p className={cn("font-mono text-sm uppercase tracking-wide mt-1 font-medium", resultColor)}>
          {result}
        </p>
      </div>

      {/* Ranked impact */}
      {isRanked && (
        <div className="bg-surface-alt border border-border rounded-md p-3 flex items-center gap-4">
          <div className="flex-1 flex flex-col items-center gap-0.5">
            <span className="font-mono text-[10px] text-text-dim uppercase">ELO</span>
            <div className="flex items-center gap-1">
              {eloChange > 0 ? (
                <TrendingUp size={14} className="text-win" />
              ) : eloChange < 0 ? (
                <TrendingDown size={14} className="text-loss" />
              ) : (
                <Minus size={14} className="text-draw" />
              )}
              <span className={cn(
                "font-mono text-md font-semibold tabular-nums",
                eloChange > 0 ? "text-win" : eloChange < 0 ? "text-loss" : "text-draw"
              )}>
                {eloChange > 0 ? "+" : ""}{eloChange}
              </span>
            </div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex-1 flex flex-col items-center gap-0.5">
            <span className="font-mono text-[10px] text-text-dim uppercase">Division Pts</span>
            <div className="flex items-center gap-1">
              <Trophy size={14} className={divPointsChange > 0 ? "text-gold" : "text-text-dim"} />
              <span className={cn(
                "font-mono text-md font-semibold tabular-nums",
                divPointsChange > 0 ? "text-gold" : divPointsChange < 0 ? "text-loss" : "text-draw"
              )}>
                {divPointsChange > 0 ? "+" : ""}{divPointsChange}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Match stats */}
      <div className="bg-surface border border-border rounded-md p-4 flex flex-col gap-3">
        <StatRow label="Possession" home={stats.homePossession} away={stats.awayPossession} />
        <StatRow label="Shots" home={stats.homeShots} away={stats.awayShots} />
        <StatRow label="On Target" home={stats.homeOnTarget} away={stats.awayOnTarget} />
        <StatRow label="Corners" home={stats.homeCorners} away={stats.awayCorners} />
        <StatRow label="Fouls" home={stats.homeFouls} away={stats.awayFouls} />
        <StatRow label="Yellows" home={stats.homeYellowCards} away={stats.awayYellowCards} />
        {(stats.homeRedCards > 0 || stats.awayRedCards > 0) && (
          <StatRow label="Reds" home={stats.homeRedCards} away={stats.awayRedCards} />
        )}
        <StatRow label="Pass %" home={stats.homePassAccuracy} away={stats.awayPassAccuracy} />
      </div>

      {/* Man of the Match */}
      {manOfTheMatch && (
        <div className="bg-surface border border-gold/30 rounded-md p-3 flex items-center gap-3">
          <Star size={16} className="text-gold shrink-0" />
          <div>
            <p className="font-mono text-[10px] text-gold uppercase tracking-wide">Man of the Match</p>
            <p className="font-mono text-xs text-text">{manOfTheMatch}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <Link
        href="/home"
        className="block w-full h-[44px] leading-[44px] text-center bg-accent text-black font-mono text-sm uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
      >
        Back to Home
      </Link>
      <div className="flex gap-2">
        <Link
          href="/club/tactics"
          className="flex-1 block h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Tactics
        </Link>
        <Link
          href="/play"
          className="flex-1 block h-10 leading-[40px] text-center border border-accent/40 text-accent font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-accent transition-colors duration-100"
        >
          Play Again
        </Link>
      </div>
      {saving && (
        <p className="font-mono text-[10px] text-text-dim text-center">Saving result...</p>
      )}
      {saved && (
        <p className="font-mono text-[10px] text-accent text-center">Result saved</p>
      )}
    </div>
  );
}
