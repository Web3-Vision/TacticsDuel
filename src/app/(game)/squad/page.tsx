"use client";

import { useState, useEffect } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { getFormation } from "@/lib/data/formations";
import { FORMATIONS } from "@/lib/data/formations";
import { cn, SALARY_CAP, formatPrice } from "@/lib/utils";
import PitchView from "@/components/pitch/PitchView";
import PositionGuide from "@/components/squad/PositionGuide";
import BudgetBar from "@/components/squad/BudgetBar";
import PlayerMarket from "@/components/squad/PlayerMarket";
import PlayerDetail from "@/components/squad/PlayerDetail";
import type { Player, Position } from "@/lib/types";

// Lazy import players to avoid blocking initial render
let PLAYERS: Player[] = [];

export default function SquadPage() {
  const {
    formationId,
    setFormation,
    slots,
    activeSlotIndex,
    setActiveSlot,
    addPlayer,
    removePlayer,
    clearSquad,
    filledCount,
    totalSpent,
    budgetRemaining,
    positionForSlot,
    isPlayerInSquad,
    canAfford,
  } = useSquadStore();

  const [players, setPlayers] = useState<Player[]>([]);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    import("@/lib/data/players").then((mod) => {
      setPlayers(mod.PLAYERS);
      PLAYERS = mod.PLAYERS;
      setLoaded(true);
    });
  }, []);

  const formation = getFormation(formationId);

  // Filter position based on active slot
  const filterPos =
    activeSlotIndex !== null
      ? formation.slots[activeSlotIndex]?.position ?? null
      : null;

  function handleSelectPlayer(player: Player) {
    setDetailPlayer(player);
    setShowDetail(true);
  }

  function handleAddPlayer() {
    if (!detailPlayer) return;

    if (activeSlotIndex !== null) {
      addPlayer(activeSlotIndex, detailPlayer);
    } else {
      // Find first empty slot matching this player's position
      const emptySlotIdx = formation.slots.findIndex(
        (s, i) => s.position === detailPlayer.position && slots[i] === null
      );
      if (emptySlotIdx !== -1) {
        addPlayer(emptySlotIdx, detailPlayer);
      } else {
        // Find any empty slot
        const anyEmpty = slots.findIndex((s) => s === null);
        if (anyEmpty !== -1) {
          addPlayer(anyEmpty, detailPlayer);
        }
      }
    }
    setShowDetail(false);
    setDetailPlayer(null);
  }

  function handleRemovePlayer() {
    if (!detailPlayer) return;
    const idx = slots.findIndex((p) => p?.id === detailPlayer.id);
    if (idx !== -1) removePlayer(idx);
    setShowDetail(false);
    setDetailPlayer(null);
  }

  function handleAutoFill() {
    if (!loaded) return;
    const sortedPlayers = [...players].sort((a, b) => b.overall - a.overall);

    formation.slots.forEach((slot, i) => {
      if (slots[i] !== null) return;
      const remaining = useSquadStore.getState().budgetRemaining();
      const available = sortedPlayers.find(
        (p) =>
          p.position === slot.position &&
          !useSquadStore.getState().isPlayerInSquad(p.id) &&
          p.marketValue <= remaining
      );
      if (available) {
        useSquadStore.getState().addPlayer(i, available);
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Formation selector */}
      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border bg-surface">
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFormation(f.id)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
              formationId === f.id
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light"
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Position needs */}
      <PositionGuide />

      {/* Budget */}
      <BudgetBar />

      {/* Pitch */}
      <div className="px-4 py-3">
        <PitchView />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-2">
        <button
          onClick={handleAutoFill}
          className="flex-1 h-9 border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Auto-fill
        </button>
        <button
          onClick={clearSquad}
          className="flex-1 h-9 border border-border text-text-dim font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Clear
        </button>
      </div>

      {/* Player market */}
      <div className="flex-1 min-h-0 border-t border-border">
        {loaded ? (
          <PlayerMarket
            players={players}
            onSelectPlayer={handleSelectPlayer}
            filterPosition={filterPos}
          />
        ) : (
          <div className="p-4">
            <div className="h-3 bg-border rounded-sm w-32 mb-2" />
            <div className="h-3 bg-border rounded-sm w-48 mb-2" />
            <div className="h-3 bg-border rounded-sm w-40" />
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-14 bg-surface border-t border-border px-4 py-2 flex items-center justify-between">
        <span className="font-mono text-xs text-text-mid">
          Squad {filledCount()}/11
        </span>
        <span className="font-mono text-xs text-gold tabular-nums">
          {formatPrice(totalSpent())} spent
        </span>
      </div>

      {/* Player detail sheet */}
      <PlayerDetail
        player={detailPlayer}
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setDetailPlayer(null);
        }}
        onAdd={handleAddPlayer}
        onRemove={handleRemovePlayer}
        inSquad={detailPlayer ? isPlayerInSquad(detailPlayer.id) : false}
        canAfford={detailPlayer ? canAfford(detailPlayer) : false}
      />
    </div>
  );
}
