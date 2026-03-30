"use client";

import { useSquadStore } from "@/lib/stores/squad-store";
import { SALARY_CAP, formatPrice, cn } from "@/lib/utils";

export default function BudgetBar() {
  const squadLoaded = useSquadStore((s) => s.squadLoaded);
  const totalSpent = useSquadStore((s) => s.totalSpent());
  const remaining = useSquadStore((s) => s.budgetRemaining());
  const avgPerSlot = useSquadStore((s) => s.avgBudgetPerSlot());
  const emptyCount = useSquadStore((s) => s.emptySlotCount());

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
    <div className="px-4 py-2 bg-surface border-b border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-text-dim">
          {formatPrice(totalSpent)} spent · {formatPrice(remaining)} left
        </span>
        {emptyCount > 0 && (
          <span className="font-mono text-xs text-text-dim">
            ~{formatPrice(avgPerSlot)}/slot
          </span>
        )}
      </div>
      <div className="h-1.5 bg-border rounded-sm overflow-hidden">
        <div
          className={cn("h-full transition-all duration-100", color)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
