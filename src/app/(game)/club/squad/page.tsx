"use client";

import { useState, useEffect, useCallback } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { getFormation } from "@/lib/data/formations";
import { FORMATIONS } from "@/lib/data/formations";
import { cn, formatPrice } from "@/lib/utils";
import PitchView from "@/components/pitch/PitchView";
import BudgetBar from "@/components/squad/BudgetBar";
import PlayerDetail from "@/components/squad/PlayerDetail";
import Link from "next/link";
import type { Player } from "@/lib/types";

export default function SquadPage() {
  const {
    formationId,
    setFormation,
    slots,
    bench,
    removePlayer,
    removeBenchPlayer,
    clearSquad,
    filledCount,
    benchFilledCount,
    isPlayerInSquad,
  } = useSquadStore();

  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [detailSource, setDetailSource] = useState<"starter" | "bench" | null>(null);
  const [detailIndex, setDetailIndex] = useState<number>(-1);
  const [showDetail, setShowDetail] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);

  useEffect(() => {
    import("@/lib/data/players").then((mod) => {
      setPlayers(mod.PLAYERS);
      setPlayersLoaded(true);
    });
  }, []);

  const formation = getFormation(formationId);

  const autoSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await useSquadStore.getState().saveToSupabase();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (e: unknown) {
      setSaveStatus(e instanceof Error ? e.message : "Save failed");
    }
  }, []);

  function handleBenchTap(player: Player, index: number) {
    setDetailPlayer(player);
    setDetailSource("bench");
    setDetailIndex(index);
    setShowDetail(true);
  }

  function handleRemove() {
    if (!detailPlayer) return;
    if (detailSource === "starter") {
      removePlayer(detailIndex);
    } else if (detailSource === "bench") {
      removeBenchPlayer(detailIndex);
    }
    setShowDetail(false);
    setDetailPlayer(null);
    autoSave();
  }

  function handleClear() {
    clearSquad();
    autoSave();
  }

  function handleFormationChange(id: string) {
    setFormation(id);
    autoSave();
  }

  function handleAutoFill() {
    if (!playersLoaded) return;
    const sortedPlayers = [...players].sort((a, b) => b.overall - a.overall);
    const priorityOrder: Record<string, number> = {
      GK: 0, CB: 1, LB: 1, RB: 1, CM: 2, LW: 3, RW: 3, ST: 3,
    };

    // Fill starters first
    const emptySlots = formation.slots
      .map((slot, i) => ({ slot, i }))
      .filter(({ i }) => useSquadStore.getState().slots[i] === null)
      .sort((a, b) => (priorityOrder[a.slot.position] ?? 2) - (priorityOrder[b.slot.position] ?? 2));

    const emptyBenchCount = useSquadStore.getState().bench.filter((p) => p === null).length;
    let remainingTotal = emptySlots.length + emptyBenchCount;

    // Fill starters
    emptySlots.forEach(({ slot, i }) => {
      const state = useSquadStore.getState();
      const remaining = state.budgetRemaining();
      const targetPerSlot = remaining / Math.max(1, remainingTotal);
      const maxSpend = Math.min(targetPerSlot * 1.5, remaining);
      const available = sortedPlayers.find(
        (p) =>
          p.position === slot.position &&
          !state.isPlayerInSquad(p.id) &&
          p.marketValue <= maxSpend
      );
      if (available) {
        state.addPlayer(i, available);
        remainingTotal--;
      }
    });

    // Fill bench
    const positions = ["GK", "CB", "LB", "RB", "CM", "LW", "RW", "ST"];
    for (const pos of positions) {
      const state = useSquadStore.getState();
      const emptyBench = state.bench.findIndex((p) => p === null);
      if (emptyBench === -1) break;
      const remaining = state.budgetRemaining();
      const emptyCount = state.bench.filter((p) => p === null).length;
      const targetPerSlot = remaining / Math.max(1, emptyCount);
      const maxSpend = Math.min(targetPerSlot * 1.5, remaining);
      const available = sortedPlayers.find(
        (p) =>
          p.position === pos &&
          !state.isPlayerInSquad(p.id) &&
          p.marketValue <= maxSpend
      );
      if (available) {
        state.addBenchPlayer(available);
      }
    }

    autoSave();
  }

  const benchPlayers = bench
    .map((p, i) => (p ? { player: p, index: i } : null))
    .filter((x): x is { player: Player; index: number } => x !== null);

  return (
    <div className="flex flex-col h-full">
      {/* Formation selector */}
      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border bg-surface">
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => handleFormationChange(f.id)}
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
          disabled={!playersLoaded}
          className="flex-1 h-9 border border-accent text-accent font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:bg-accent/10 transition-colors duration-100 disabled:opacity-40"
        >
          Auto-fill
        </button>
        <button
          onClick={handleClear}
          className="flex-1 h-9 border border-border text-text-dim font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Clear
        </button>
        <Link
          href="/club/players"
          className="flex-1 h-9 border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] flex items-center justify-center hover:border-border-light transition-colors duration-100"
        >
          Transfers
        </Link>
      </div>

      {/* Bench section */}
      <div className="flex-1 min-h-0 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">
            Bench ({benchFilledCount()}/10)
          </span>
        </div>
        {benchPlayers.length === 0 ? (
          <p className="font-mono text-xs text-text-dim">
            No bench players. <Link href="/club/players" className="text-accent">Add via Transfers</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {benchPlayers.map(({ player, index }) => (
              <button
                key={player.id}
                onClick={() => handleBenchTap(player, index)}
                className="flex items-center gap-2 h-9 px-2 rounded-[3px] hover:bg-surface-alt transition-colors duration-100 text-left w-full"
              >
                <span className="font-mono text-[10px] text-text-dim uppercase w-6">
                  {player.position}
                </span>
                <span className="font-mono text-xs text-text flex-1 truncate">
                  {player.name}
                </span>
                <span className="font-mono text-xs text-accent tabular-nums w-6 text-right">
                  {player.overall}
                </span>
                <span className="font-mono text-[10px] text-gold tabular-nums">
                  {formatPrice(player.marketValue)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-14 bg-surface border-t border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-mid">
            {filledCount()}/11 + {benchFilledCount()}/10
          </span>
          {saveStatus === "saving" && (
            <span className="font-mono text-[10px] text-text-dim">Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="font-mono text-[10px] text-accent">Saved</span>
          )}
          {saveStatus && saveStatus !== "saving" && saveStatus !== "saved" && (
            <span className="font-mono text-[10px] text-danger">{saveStatus}</span>
          )}
        </div>
        <button
          onClick={autoSave}
          disabled={saveStatus === "saving"}
          className="h-8 px-4 bg-accent text-black font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Player detail sheet */}
      <PlayerDetail
        player={detailPlayer}
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setDetailPlayer(null);
        }}
        onRemove={handleRemove}
        inSquad={true}
        canAfford={false}
      />
    </div>
  );
}
