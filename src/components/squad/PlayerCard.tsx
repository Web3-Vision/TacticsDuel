"use client";

import type { Player } from "@/lib/types";
import { cn, formatPrice, positionColor } from "@/lib/utils";

interface PlayerCardProps {
  player: Player;
  onSelect: (player: Player) => void;
  disabled?: boolean;
  inSquad?: boolean;
}

export default function PlayerCard({
  player,
  onSelect,
  disabled,
  inSquad,
}: PlayerCardProps) {
  return (
    <button
      onClick={() => onSelect(player)}
      disabled={disabled}
      className={cn(
        "w-full h-[44px] flex items-center gap-2 px-3 border-b border-border",
        "hover:bg-surface-alt active:bg-surface-alt transition-colors duration-100",
        disabled && "opacity-40",
        inSquad && "bg-accent/5"
      )}
    >
      <span className="font-mono text-md font-medium text-accent tabular-nums w-7 shrink-0">
        {player.overall}
      </span>
      <span
        className={cn(
          "font-mono text-[10px] uppercase w-5 shrink-0",
          positionColor(player.position)
        )}
      >
        {player.position}
      </span>
      <span className="shrink-0 text-sm">{player.nationality}</span>
      <span className="font-mono text-[13px] text-text truncate flex-1 text-left">
        {player.name}
      </span>
      <span className="font-mono text-[10px] text-text-dim truncate shrink-0 max-w-[60px]">
        {player.club}
      </span>
      <span className="font-mono text-xs text-gold tabular-nums shrink-0 w-11 text-right">
        {formatPrice(player.marketValue)}
      </span>
    </button>
  );
}
