"use client";

import { useState } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { FORMATIONS, getFormation } from "@/lib/data/formations";
import PitchView from "@/components/pitch/PitchView";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">
        {label}
      </span>
      <div className="flex gap-1.5 overflow-x-auto">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
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

export default function TacticsPage() {
  const { formationId, setFormation } = useSquadStore();
  const [mentality, setMentality] = useState<Mentality>("Balanced");
  const [tempo, setTempo] = useState<Tempo>("Normal");
  const [pressing, setPressing] = useState<Pressing>("Medium");
  const [width, setWidth] = useState<Width>("Normal");
  const [showHT, setShowHT] = useState(false);
  const [htLosingMentality, setHtLosingMentality] =
    useState<Mentality>("Attacking");
  const [htWinningMentality, setHtWinningMentality] =
    useState<Mentality>("Defensive");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: save to Supabase
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-20">
      <h1 className="font-mono text-lg uppercase tracking-wide">Tactics</h1>

      {/* Pitch */}
      <PitchView />

      {/* Formation */}
      <PillRow
        label="Formation"
        options={FORMATIONS.map((f) => ({ value: f.id, label: f.name }))}
        value={formationId}
        onChange={setFormation}
      />

      {/* Mentality */}
      <PillRow
        label="Mentality"
        options={MENTALITIES}
        value={mentality}
        onChange={setMentality}
      />

      {/* Tempo */}
      <PillRow
        label="Tempo"
        options={TEMPOS}
        value={tempo}
        onChange={setTempo}
      />

      {/* Pressing */}
      <PillRow
        label="Pressing"
        options={PRESSINGS}
        value={pressing}
        onChange={setPressing}
      />

      {/* Width */}
      <PillRow
        label="Width"
        options={WIDTHS}
        value={width}
        onChange={setWidth}
      />

      {/* Conditional HT */}
      <button
        onClick={() => setShowHT(!showHT)}
        className="font-mono text-xs text-text-dim uppercase tracking-wide text-left"
      >
        {showHT ? "- Hide" : "+"} Half-Time Conditions
      </button>
      {showHT && (
        <div className="flex flex-col gap-3 bg-surface border border-border rounded-md p-3">
          <PillRow
            label="If Losing → Mentality"
            options={MENTALITIES}
            value={htLosingMentality}
            onChange={setHtLosingMentality}
          />
          <PillRow
            label="If Winning → Mentality"
            options={MENTALITIES}
            value={htWinningMentality}
            onChange={setHtWinningMentality}
          />
        </div>
      )}

      {/* Save button - sticky */}
      <div className="fixed bottom-14 left-0 right-0 bg-surface border-t border-border p-4 max-w-[480px] mx-auto">
        <button
          onClick={handleSave}
          className={cn(
            "w-full h-[44px] font-mono text-sm uppercase tracking-wide rounded-[4px] transition-colors duration-100",
            saved
              ? "bg-accent/20 text-accent border border-accent"
              : "bg-accent text-black hover:bg-accent-dim"
          )}
        >
          {saved ? "Saved" : "Save Tactics"}
        </button>
      </div>
    </div>
  );
}
