"use client";

import { useState, useEffect, useRef } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import Link from "next/link";

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
  const { stats, homeScore, awayScore, isFinished, homeTeam, awayTeam } =
    useMatchStore();

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
    homeScore > awayScore ? "HOME WIN" : homeScore < awayScore ? "AWAY WIN" : "DRAW";

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="text-center">
        <p className="font-mono text-xs text-text-dim uppercase tracking-wide">
          Full Time
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums mt-1">
          <span className="text-home">{homeScore}</span>
          <span className="text-text-dim mx-2">-</span>
          <span className="text-away">{awayScore}</span>
        </p>
        <p className="font-mono text-xs text-accent uppercase tracking-wide mt-1">
          {result}
        </p>
      </div>

      <div className="bg-surface border border-border rounded-md p-4 flex flex-col gap-3">
        <StatRow label="Possession" home={stats.homePossession} away={stats.awayPossession} />
        <StatRow label="Shots" home={stats.homeShots} away={stats.awayShots} />
        <StatRow label="On Target" home={stats.homeOnTarget} away={stats.awayOnTarget} />
        <StatRow label="Corners" home={stats.homeCorners} away={stats.awayCorners} />
        <StatRow label="Fouls" home={stats.homeFouls} away={stats.awayFouls} />
        <StatRow label="Yellows" home={stats.homeYellowCards} away={stats.awayYellowCards} />
        <StatRow label="Pass %" home={stats.homePassAccuracy} away={stats.awayPassAccuracy} />
      </div>

      <Link
        href="/home"
        className="block w-full h-[44px] leading-[44px] text-center bg-accent text-black font-mono text-sm uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
      >
        Back to Home
      </Link>
      <Link
        href="/club/squad"
        className="block w-full h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
      >
        Tweak Squad
      </Link>
      {saving && (
        <p className="font-mono text-[10px] text-text-dim text-center">Saving result...</p>
      )}
      {saved && (
        <p className="font-mono text-[10px] text-accent text-center">Result saved</p>
      )}
    </div>
  );
}
