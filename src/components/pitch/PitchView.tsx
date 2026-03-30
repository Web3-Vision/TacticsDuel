"use client";

import { getFormation } from "@/lib/data/formations";
import { useSquadStore } from "@/lib/stores/squad-store";
import { cn } from "@/lib/utils";

export default function PitchView() {
  const { formationId, slots, activeSlotIndex, setActiveSlot } =
    useSquadStore();
  const formation = getFormation(formationId);

  return (
    <div className="relative w-full aspect-[3/4] max-h-[300px] bg-pitch/20 border border-border rounded-md overflow-hidden">
      {/* Pitch markings */}
      <svg
        viewBox="0 0 100 130"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Center line */}
        <line
          x1="0" y1="65" x2="100" y2="65"
          stroke="rgba(34,197,94,0.15)" strokeWidth="0.3"
        />
        {/* Center circle */}
        <circle
          cx="50" cy="65" r="12"
          fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.3"
        />
        {/* Penalty boxes */}
        <rect
          x="25" y="0" width="50" height="18"
          fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.3"
        />
        <rect
          x="25" y="112" width="50" height="18"
          fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.3"
        />
      </svg>

      {/* Player slots */}
      {formation.slots.map((slot, i) => {
        const player = slots[i];
        const isActive = activeSlotIndex === i;

        return (
          <button
            key={i}
            onClick={() => setActiveSlot(isActive ? null : i)}
            className={cn(
              "absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5",
              "min-w-[44px] min-h-[44px] justify-center"
            )}
            style={{
              left: `${slot.x}%`,
              top: `${slot.y * 100 / 130}%`,
            }}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-medium border",
                player
                  ? "bg-accent/20 border-accent text-accent"
                  : isActive
                    ? "bg-surface-alt border-accent text-accent"
                    : "bg-surface border-border text-text-dim"
              )}
            >
              {player
                ? player.overall
                : slot.label}
            </div>
            <span className="font-mono text-[9px] text-text-mid truncate max-w-[56px]">
              {player ? player.name.split(" ").pop() : slot.position}
            </span>
          </button>
        );
      })}
    </div>
  );
}
