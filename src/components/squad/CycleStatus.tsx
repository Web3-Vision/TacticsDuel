"use client";

import type { Profile } from "@/lib/types";
import { Lock, Unlock, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface CycleStatusProps {
  profile: Profile;
}

export default function CycleStatus({ profile }: CycleStatusProps) {
  const { squad_locked, ranked_matches_in_cycle, transfers_remaining } = profile;

  if (!squad_locked && transfers_remaining > 0) {
    // Transfer window open
    return (
      <div className="bg-gold/10 border-b border-gold/30 px-4 py-2.5 flex items-center gap-2">
        <ArrowRightLeft size={14} strokeWidth={1.5} className="text-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-gold uppercase tracking-wide">
            Transfer Window
          </p>
          <p className="font-mono text-[10px] text-text-dim mt-0.5">
            {transfers_remaining} transfer{transfers_remaining !== 1 ? "s" : ""} remaining — lock squad to play ranked
          </p>
        </div>
      </div>
    );
  }

  if (!squad_locked) {
    // Not confirmed yet
    return (
      <div className="bg-surface-alt border-b border-border px-4 py-2.5 flex items-center gap-2">
        <Unlock size={14} strokeWidth={1.5} className="text-text-dim shrink-0" />
        <p className="font-mono text-[10px] text-text-dim">
          Build your squad and lock it to play ranked matches
        </p>
      </div>
    );
  }

  // Locked
  const matchesLeft = 5 - ranked_matches_in_cycle;
  return (
    <div className="bg-accent/5 border-b border-accent/20 px-4 py-2.5 flex items-center gap-2">
      <Lock size={14} strokeWidth={1.5} className="text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] text-accent uppercase tracking-wide">
          Squad Locked
        </p>
        <p className="font-mono text-[10px] text-text-dim mt-0.5">
          {ranked_matches_in_cycle}/5 ranked matches played — {matchesLeft} until transfer window
        </p>
      </div>
      {/* Progress dots */}
      <div className="flex gap-1 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-sm",
              i < ranked_matches_in_cycle
                ? "bg-accent"
                : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}
