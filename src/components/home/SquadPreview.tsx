"use client";

import Link from "next/link";
import { useSquadStore } from "@/lib/stores/squad-store";
import { getFormation } from "@/lib/data/formations";

export default function SquadPreview() {
  const { formationId, slots, filledCount } = useSquadStore();
  const formation = getFormation(formationId);
  const filled = filledCount();

  return (
    <Link
      href="/club/squad"
      className="block bg-surface border border-border rounded-md p-3 hover:border-border-light transition-colors duration-100"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
          Your Squad
        </span>
        <span className="font-mono text-[11px] text-text-mid">
          {formation.name} -- {filled}/11
        </span>
      </div>

      {/* Mini pitch */}
      <div className="relative w-full aspect-[2/1.3] bg-pitch/30 rounded-[4px] overflow-hidden">
        {/* Pitch markings */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-white/10" />
        </div>

        {/* Player dots */}
        {formation.slots.map((slot, i) => {
          const player = slots[i];
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x}%`, top: `${100 - slot.y}%` }}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-mono font-semibold ${
                  player
                    ? "bg-accent/80 text-black"
                    : "bg-border text-text-dim"
                }`}
              >
                {player ? player.overall : slot.label.slice(0, 2)}
              </div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
