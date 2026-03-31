"use client";

import type { Player } from "@/lib/types";
import { formatPrice, positionColor, cn, getCardTier } from "@/lib/utils";
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

function StatCell({ label, value, tierColor }: { label: string; value: number; tierColor: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-mono text-md font-semibold tabular-nums"
        style={{ color: value >= 85 ? "#22c55e" : value >= 70 ? tierColor : "#6b7280" }}
      >
        {value}
      </span>
      <span className="font-mono text-[9px] text-text-dim uppercase tracking-wide">
        {label}
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

  const tier = getCardTier(player.overall);

  return (
    <BottomSheet open={open} onClose={onClose} title={player.name}>
      <div className="p-4 flex flex-col gap-4">
        {/* FUT-style card */}
        <div
          className={cn(
            "rounded-md border-2 p-4 flex flex-col gap-3",
            tier.tier === "elite" && "card-elite"
          )}
          style={{
            borderColor: tier.border,
            backgroundColor: tier.bg,
          }}
        >
          {/* Top row: OVR + Position */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-center">
              <span
                className="font-mono text-3xl font-bold tabular-nums leading-none"
                style={{ color: tier.text }}
              >
                {player.overall}
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-wide mt-0.5"
                style={{ color: tier.text }}
              >
                {tier.tier}
              </span>
            </div>
            <span
              className={cn(
                "font-mono text-sm font-semibold uppercase px-2 py-0.5 rounded-[3px] border",
                positionColor(player.position)
              )}
              style={{ borderColor: `${tier.border}40` }}
            >
              {player.position}
            </span>
          </div>

          {/* Player name */}
          <p
            className="font-mono text-lg font-bold uppercase tracking-wide text-center"
            style={{ color: tier.text }}
          >
            {player.name}
          </p>

          {/* Stats 2x3 grid */}
          <div className="grid grid-cols-3 gap-y-2 gap-x-4">
            <StatCell label="PAC" value={player.pace} tierColor={tier.text} />
            <StatCell label="SHO" value={player.shooting} tierColor={tier.text} />
            <StatCell label="PAS" value={player.passing} tierColor={tier.text} />
            <StatCell label="DRI" value={player.dribbling} tierColor={tier.text} />
            <StatCell label="DEF" value={player.defending} tierColor={tier.text} />
            <StatCell label="PHY" value={player.physical} tierColor={tier.text} />
          </div>

          {/* Bottom row: nationality + club + price */}
          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: `${tier.border}30` }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{player.nationality}</span>
              <span className="font-mono text-[10px] text-text-dim">{player.club}</span>
            </div>
            <span className="font-mono text-xs tabular-nums" style={{ color: tier.text }}>
              {formatPrice(player.marketValue)}
            </span>
          </div>
        </div>

        {/* Full name + details */}
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-xs text-text-mid">{player.fullName}</span>
          <span className="font-mono text-[10px] text-text-dim">Age {player.age}</span>
        </div>

        {/* GK stat if goalkeeper */}
        {player.position === "GK" && (
          <div className="flex items-center gap-2 px-1">
            <span className="font-mono text-[10px] text-text-dim uppercase w-8">GK</span>
            <div className="flex-1 h-[3px] bg-border rounded-sm overflow-hidden">
              <div
                className={cn(
                  "h-full",
                  player.goalkeeping >= 85 ? "bg-accent" : player.goalkeeping >= 70 ? "bg-gold" : "bg-text-dim"
                )}
                style={{ width: `${player.goalkeeping}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums w-6 text-right text-text-mid">
              {player.goalkeeping}
            </span>
          </div>
        )}

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
