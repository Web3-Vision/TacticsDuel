"use client";

import { useState } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { SALARY_CAP, formatPrice, cn } from "@/lib/utils";
import { Info } from "lucide-react";

export default function BudgetBar() {
  const squadLoaded = useSquadStore((s) => s.squadLoaded);
  const totalSpent = useSquadStore((s) => s.totalSpent());
  const remaining = useSquadStore((s) => s.budgetRemaining());
  const avgPerSlot = useSquadStore((s) => s.avgBudgetPerSlot());
  const emptyCount = useSquadStore((s) => s.emptySlotCount());
  const [showInfo, setShowInfo] = useState(false);

  if (!squadLoaded) {
    return (
      <div className="px-4 py-2 bg-surface border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="h-3 bg-border rounded-sm w-24 animate-pulse" />
          <div className="h-3 bg-border rounded-sm w-16 animate-pulse" />
        </div>
        <div className="h-1.5 bg-border rounded-sm" />
      </div>
    );
  }

  const pct = (totalSpent / SALARY_CAP) * 100;
  const color =
    remaining > SALARY_CAP * 0.4
      ? "bg-accent"
      : remaining > SALARY_CAP * 0.15
        ? "bg-gold"
        : remaining > SALARY_CAP * 0.05
          ? "bg-gold"
          : "bg-danger";

  return (
    <div className="px-4 py-2 bg-surface border-b border-border relative">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-text-dim">
          {formatPrice(totalSpent)} spent · {formatPrice(remaining)} left
        </span>
        <div className="flex items-center gap-2">
          {emptyCount > 0 && (
            <span className="font-mono text-xs text-text-dim">
              ~{formatPrice(avgPerSlot)}/slot
            </span>
          )}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-text-dim hover:text-accent transition-colors duration-100"
          >
            <Info size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div className="h-1.5 bg-border rounded-sm overflow-hidden">
        <div
          className={cn("h-full transition-all duration-100", color)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {showInfo && (
        <div className="mt-2 bg-bg border border-border rounded-[3px] p-2">
          <p className="font-mono text-[10px] text-text-mid">
            Earn coins by playing matches:
          </p>
          <p className="font-mono text-[10px] text-text-dim mt-1">
            Win = 300 · Draw = 150 · Loss = 50 + 50/goal
          </p>
        </div>
      )}
    </div>
  );
}
