"use client";

import { useState, useEffect } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { FORMATIONS } from "@/lib/data/formations";
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

interface TacticsFormProps {
  showFormation?: boolean;
  stickyButton?: boolean;
}

export default function TacticsForm({ showFormation = true, stickyButton = true }: TacticsFormProps) {
  const { formationId, setFormation } = useSquadStore();
  const [mentality, setMentality] = useState<Mentality>("Balanced");
  const [tempo, setTempo] = useState<Tempo>("Normal");
  const [pressing, setPressing] = useState<Pressing>("Medium");
  const [width, setWidth] = useState<Width>("Normal");
  const [showHT, setShowHT] = useState(false);
  const [htLosingMentality, setHtLosingMentality] = useState<Mentality>("Attacking");
  const [htWinningMentality, setHtWinningMentality] = useState<Mentality>("Defensive");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function loadTactics() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("tactics")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        if (data.formation) setFormation(data.formation);
        if (data.mentality) setMentality(data.mentality as Mentality);
        if (data.tempo) setTempo(data.tempo as Tempo);
        if (data.pressing) setPressing(data.pressing as Pressing);
        if (data.width) setWidth(data.width as Width);
        if (data.ht_if_losing_mentality) {
          setShowHT(true);
          setHtLosingMentality(data.ht_if_losing_mentality as Mentality);
        }
        if (data.ht_if_winning_mentality) {
          setHtWinningMentality(data.ht_if_winning_mentality as Mentality);
        }
      }
    }
    loadTactics();
  }, [setFormation]);

  async function handleSave() {
    setSaveError("");
    const { ensureSquadEditable } = await import("@/lib/squad/ensure-squad-editable");
    const editable = await (async () => {
      try {
        return await ensureSquadEditable();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to save tactics");
        return null;
      }
    })();

    if (!editable) {
      return;
    }

    const { supabase, user } = editable;

    const { error } = await supabase.from("tactics").upsert({
      user_id: user.id,
      formation: formationId,
      mentality,
      tempo,
      pressing,
      width,
      ht_if_losing_mentality: showHT ? htLosingMentality : null,
      ht_if_winning_mentality: showHT ? htWinningMentality : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      setSaveError(error.message);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {showFormation && (
        <PillRow
          label="Formation"
          options={FORMATIONS.map((f) => ({ value: f.id, label: f.name }))}
          value={formationId}
          onChange={setFormation}
        />
      )}

      <PillRow label="Mentality" options={MENTALITIES} value={mentality} onChange={setMentality} />
      <PillRow label="Tempo" options={TEMPOS} value={tempo} onChange={setTempo} />
      <PillRow label="Pressing" options={PRESSINGS} value={pressing} onChange={setPressing} />
      <PillRow label="Width" options={WIDTHS} value={width} onChange={setWidth} />

      <button
        onClick={() => setShowHT(!showHT)}
        className="font-mono text-xs text-text-dim uppercase tracking-wide text-left"
      >
        {showHT ? "- Hide" : "+"} Half-Time Conditions
      </button>
      {showHT && (
        <div className="flex flex-col gap-3 bg-surface border border-border rounded-md p-3">
          <PillRow
            label="If Losing -> Mentality"
            options={MENTALITIES}
            value={htLosingMentality}
            onChange={setHtLosingMentality}
          />
          <PillRow
            label="If Winning -> Mentality"
            options={MENTALITIES}
            value={htWinningMentality}
            onChange={setHtWinningMentality}
          />
        </div>
      )}

      {saveError && (
        <p className="font-mono text-xs text-danger">{saveError}</p>
      )}

      {stickyButton ? (
        <div className="fixed bottom-14 left-0 right-0 bg-surface border-t border-border p-4 max-w-[640px] mx-auto">
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
      ) : (
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
      )}
    </div>
  );
}
