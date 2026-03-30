"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TACTICAL_PRESETS, type TacticalOverride } from "@/lib/engine/match-engine";
import type { Mentality, Tempo, Pressing, Width } from "@/lib/types";

const MENTALITIES: { value: Mentality; label: string }[] = [
  { value: "Defensive", label: "DEF" },
  { value: "Cautious", label: "CAU" },
  { value: "Balanced", label: "BAL" },
  { value: "Attacking", label: "ATT" },
  { value: "All-out Attack", label: "ALL" },
];

const TEMPOS: { value: Tempo; label: string }[] = [
  { value: "Slow", label: "SLOW" },
  { value: "Normal", label: "NOR" },
  { value: "Fast", label: "FAST" },
];

const PRESSINGS: { value: Pressing; label: string }[] = [
  { value: "Low", label: "LOW" },
  { value: "Medium", label: "MED" },
  { value: "High", label: "HIGH" },
];

const WIDTHS: { value: Width; label: string }[] = [
  { value: "Narrow", label: "NAR" },
  { value: "Normal", label: "NOR" },
  { value: "Wide", label: "WIDE" },
];

function PillRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">
        {label}
      </span>
      <div className="flex gap-1 overflow-x-auto">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 h-7 px-2.5 rounded-[3px] font-mono text-[10px] uppercase tracking-wide border transition-colors duration-100",
              value === opt.value
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TacticalInterventionProps {
  homeScore: number;
  awayScore: number;
  possession: number;
  shots: { home: number; away: number };
  onConfirm: (override: TacticalOverride | null) => void;
}

export default function TacticalIntervention({
  homeScore,
  awayScore,
  possession,
  shots,
  onConfirm,
}: TacticalInterventionProps) {
  const [mentality, setMentality] = useState<Mentality>("Balanced");
  const [tempo, setTempo] = useState<Tempo>("Normal");
  const [pressing, setPressing] = useState<Pressing>("Medium");
  const [width, setWidth] = useState<Width>("Normal");
  const [showCustom, setShowCustom] = useState(false);

  function applyPreset(preset: typeof TACTICAL_PRESETS[keyof typeof TACTICAL_PRESETS]) {
    setMentality(preset.mentality);
    setTempo(preset.tempo);
    setPressing(preset.pressing);
    setWidth(preset.width);
    onConfirm({
      mentality: preset.mentality,
      tempo: preset.tempo,
      pressing: preset.pressing,
      width: preset.width,
    });
  }

  function handleConfirmCustom() {
    onConfirm({ mentality, tempo, pressing, width });
  }

  const isLosing = homeScore < awayScore;
  const isWinning = homeScore > awayScore;

  return (
    <div className="bg-bg/95 backdrop-blur-sm absolute inset-0 z-40 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {/* Score summary */}
        <div className="text-center">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide">Half Time</p>
          <p className="font-mono text-3xl font-semibold tabular-nums mt-1">
            <span className="text-home">{homeScore}</span>
            <span className="text-text-dim mx-2">-</span>
            <span className="text-away">{awayScore}</span>
          </p>
          <div className="flex justify-center gap-4 mt-2">
            <span className="font-mono text-[10px] text-text-dim">
              Poss {possession}%
            </span>
            <span className="font-mono text-[10px] text-text-dim">
              Shots {shots.home}-{shots.away}
            </span>
          </div>
        </div>

        {/* Tactical header */}
        <div className="w-full max-w-[360px]">
          <p className="font-mono text-xs text-accent uppercase tracking-wide text-center mb-3">
            Tactical Adjustment
          </p>

          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => applyPreset(TACTICAL_PRESETS.protectLead)}
              className={cn(
                "h-10 px-3 rounded-[4px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
                isWinning
                  ? "border-accent/40 text-accent hover:border-accent hover:bg-accent/10"
                  : "border-border text-text-dim hover:border-border-light"
              )}
            >
              Protect Lead
            </button>
            <button
              onClick={() => applyPreset(TACTICAL_PRESETS.chaseGoal)}
              className={cn(
                "h-10 px-3 rounded-[4px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
                isLosing
                  ? "border-accent/40 text-accent hover:border-accent hover:bg-accent/10"
                  : "border-border text-text-dim hover:border-border-light"
              )}
            >
              Chase Goal
            </button>
            <button
              onClick={() => applyPreset(TACTICAL_PRESETS.controlGame)}
              className="h-10 px-3 rounded-[4px] font-mono text-[11px] uppercase tracking-wide border border-border text-text-dim hover:border-border-light transition-colors duration-100"
            >
              Control Game
            </button>
            <button
              onClick={() => applyPreset(TACTICAL_PRESETS.overloadMidfield)}
              className="h-10 px-3 rounded-[4px] font-mono text-[11px] uppercase tracking-wide border border-border text-text-dim hover:border-border-light transition-colors duration-100"
            >
              Overload Mid
            </button>
          </div>

          {/* Custom toggle */}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-full text-center mb-2"
          >
            {showCustom ? "- Hide Custom" : "+ Custom Tactics"}
          </button>

          {showCustom && (
            <div className="flex flex-col gap-2.5 bg-surface border border-border rounded-md p-3 mb-3">
              <PillRow label="Mentality" options={MENTALITIES} value={mentality} onChange={setMentality} />
              <PillRow label="Tempo" options={TEMPOS} value={tempo} onChange={setTempo} />
              <PillRow label="Pressing" options={PRESSINGS} value={pressing} onChange={setPressing} />
              <PillRow label="Width" options={WIDTHS} value={width} onChange={setWidth} />
              <button
                onClick={handleConfirmCustom}
                className="w-full h-10 bg-accent text-black font-mono text-sm uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
              >
                Apply Changes
              </button>
            </div>
          )}

          {/* No change */}
          <button
            onClick={() => onConfirm(null)}
            className="w-full h-10 border border-border text-text-dim font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
          >
            No Changes
          </button>
        </div>
      </div>
    </div>
  );
}
