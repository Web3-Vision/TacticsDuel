"use client";

import type { Player } from "@/lib/types";
import { formatPrice, positionColor, cn } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";

interface PlayerDetailProps {
  player: Player | null;
  open: boolean;
  onClose: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  inSquad?: boolean;
  canAfford?: boolean;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-text-dim uppercase w-8">
        {label}
      </span>
      <div className="flex-1 h-[3px] bg-border rounded-sm overflow-hidden">
        <div
          className={cn(
            "h-full",
            value >= 85
              ? "bg-accent"
              : value >= 70
                ? "bg-gold"
                : "bg-text-dim"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums w-6 text-right text-text-mid">
        {value}
      </span>
    </div>
  );
}

export default function PlayerDetail({
  player,
  open,
  onClose,
  onAdd,
  onRemove,
  inSquad,
  canAfford,
}: PlayerDetailProps) {
  if (!player) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={player.name}>
      <div className="p-4 flex flex-col gap-4">
        {/* Header info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[4px] bg-surface-alt border border-border flex items-center justify-center">
            <span className="font-mono text-2xl font-semibold text-accent">
              {player.overall}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-mono text-md">{player.fullName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm">{player.nationality}</span>
              <span className="font-mono text-xs text-text-dim">
                {player.club}
              </span>
              <span
                className={cn(
                  "font-mono text-[10px] uppercase",
                  positionColor(player.position)
                )}
              >
                {player.position}
              </span>
              <span className="font-mono text-xs text-text-dim">
                Age {player.age}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-md text-gold">
              {formatPrice(player.marketValue)}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-2">
          <StatBar label="PAC" value={player.pace} />
          <StatBar label="SHO" value={player.shooting} />
          <StatBar label="PAS" value={player.passing} />
          <StatBar label="DRI" value={player.dribbling} />
          <StatBar label="DEF" value={player.defending} />
          <StatBar label="PHY" value={player.physical} />
          {player.position === "GK" && (
            <StatBar label="GK" value={player.goalkeeping} />
          )}
        </div>

        {/* Action button */}
        {inSquad ? (
          <button
            onClick={onRemove}
            className="w-full h-[44px] border border-danger text-danger font-mono text-sm uppercase tracking-wide rounded-[4px] hover:bg-danger-dim/20 transition-colors duration-100"
          >
            Remove from Squad
          </button>
        ) : (
          <button
            onClick={onAdd}
            disabled={!canAfford}
            className={cn(
              "w-full h-[44px] font-mono text-sm uppercase tracking-wide rounded-[4px] transition-colors duration-100",
              canAfford
                ? "bg-accent text-black hover:bg-accent-dim"
                : "bg-surface border border-border text-text-dim cursor-not-allowed"
            )}
          >
            {canAfford ? "Add to Squad" : "Can't Afford"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
