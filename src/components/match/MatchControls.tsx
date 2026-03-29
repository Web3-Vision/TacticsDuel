"use client";

import { useMatchStore } from "@/lib/stores/match-store";
import { cn } from "@/lib/utils";
import { SkipForward, Filter } from "lucide-react";

export default function MatchControls() {
  const { speed, setSpeed, keyEventsOnly, toggleKeyOnly, skipToEnd, isFinished } =
    useMatchStore();

  if (isFinished) return null;

  return (
    <div className="bg-surface border-t border-border px-4 py-2 flex items-center gap-2">
      {/* Speed buttons */}
      {([1, 2, 3] as const).map((s) => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          className={cn(
            "h-8 px-3 rounded-[3px] font-mono text-[11px] border transition-colors duration-100",
            speed === s
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-dim"
          )}
        >
          {s}x
        </button>
      ))}

      {/* Key events toggle */}
      <button
        onClick={toggleKeyOnly}
        className={cn(
          "h-8 px-3 rounded-[3px] font-mono text-[11px] border flex items-center gap-1.5 transition-colors duration-100",
          keyEventsOnly
            ? "border-accent text-accent bg-accent/10"
            : "border-border text-text-dim"
        )}
      >
        <Filter size={12} strokeWidth={1.5} />
        Key
      </button>

      <div className="flex-1" />

      {/* Skip */}
      <button
        onClick={skipToEnd}
        className="h-8 px-3 rounded-[3px] font-mono text-[11px] border border-border text-text-dim flex items-center gap-1.5 hover:border-border-light transition-colors duration-100"
      >
        <SkipForward size={12} strokeWidth={1.5} />
        Skip
      </button>
    </div>
  );
}
