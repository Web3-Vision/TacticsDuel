"use client";

import { useSquadStore } from "@/lib/stores/squad-store";
import { getFormation } from "@/lib/data/formations";
import { cn } from "@/lib/utils";
import type { Position } from "@/lib/types";

export default function PositionGuide() {
  const { formationId, slots, activeSlotIndex, setActiveSlot } =
    useSquadStore();
  const formation = getFormation(formationId);

  // Count how many of each position are needed and filled
  const needs: { position: Position; slotIndex: number; filled: boolean }[] =
    formation.slots.map((s, i) => ({
      position: s.position,
      slotIndex: i,
      filled: slots[i] !== null,
    }));

  return (
    <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border bg-surface">
      {needs.map((n, i) => (
        <button
          key={i}
          onClick={() => setActiveSlot(n.filled ? null : n.slotIndex)}
          className={cn(
            "shrink-0 h-7 px-2 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
            n.filled
              ? "border-accent/30 text-accent bg-accent/5"
              : activeSlotIndex === n.slotIndex
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light"
          )}
        >
          {n.position}
        </button>
      ))}
    </div>
  );
}
