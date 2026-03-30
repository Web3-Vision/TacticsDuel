"use client";

import { cn } from "@/lib/utils";
import { Shield, Swords, Brain, Zap, Flame } from "lucide-react";

export interface TacticalArchetype {
  name: string;
  description: string;
  icon: "shield" | "swords" | "brain" | "zap" | "flame";
  color: string;
}

// Infer tactical archetype from tactics usage
export function inferArchetype(tactics: {
  mentality: string;
  tempo: string;
  pressing: string;
  width: string;
  possession?: number;
}): TacticalArchetype {
  const { mentality, tempo, pressing, width } = tactics;

  if (pressing === "High" && tempo === "Fast") {
    return {
      name: "Press Monster",
      description: "Relentless high-energy pressing",
      icon: "flame",
      color: "text-danger",
    };
  }

  if ((mentality === "Defensive" || mentality === "Cautious") && tempo === "Slow") {
    return {
      name: "Counter King",
      description: "Patient defense, lethal counter-attacks",
      icon: "shield",
      color: "text-home",
    };
  }

  if (mentality === "Balanced" && tempo === "Normal" && (tactics.possession ?? 50) >= 55) {
    return {
      name: "Possession Architect",
      description: "Controls the game through passing",
      icon: "brain",
      color: "text-accent",
    };
  }

  if ((mentality === "All-out Attack" || mentality === "Attacking") && tempo === "Fast") {
    return {
      name: "Chaos Merchant",
      description: "All-out attack, high risk, high reward",
      icon: "zap",
      color: "text-gold",
    };
  }

  if (width === "Narrow" && tempo === "Slow") {
    return {
      name: "Bus Parker",
      description: "Compact, organized, hard to break down",
      icon: "shield",
      color: "text-text-mid",
    };
  }

  if (mentality === "Attacking" && width === "Wide") {
    return {
      name: "Wing Wizard",
      description: "Attacks through the flanks",
      icon: "swords",
      color: "text-accent",
    };
  }

  return {
    name: "Tactician",
    description: "Balanced and adaptable",
    icon: "brain",
    color: "text-text-mid",
  };
}

const ICONS = {
  shield: Shield,
  swords: Swords,
  brain: Brain,
  zap: Zap,
  flame: Flame,
};

export default function TacticalIdentityBadge({
  archetype,
  compact = false,
}: {
  archetype: TacticalArchetype;
  compact?: boolean;
}) {
  const Icon = ICONS[archetype.icon];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={archetype.color} />
        <span className={cn("font-mono text-[10px] uppercase tracking-wide", archetype.color)}>
          {archetype.name}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-md p-3 flex items-center gap-3">
      <div className={cn("w-8 h-8 rounded-sm bg-surface-alt flex items-center justify-center")}>
        <Icon size={18} className={archetype.color} />
      </div>
      <div>
        <p className={cn("font-mono text-xs font-medium uppercase tracking-wide", archetype.color)}>
          {archetype.name}
        </p>
        <p className="font-mono text-[10px] text-text-dim mt-0.5">
          {archetype.description}
        </p>
      </div>
    </div>
  );
}
