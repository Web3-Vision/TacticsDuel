"use client";

import { useState, useEffect, useCallback } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { cn, formatPrice, positionColor } from "@/lib/utils";
import PlayerDetail from "@/components/squad/PlayerDetail";
import BudgetBar from "@/components/squad/BudgetBar";
import type { Player, Position } from "@/lib/types";

type Tab = "market" | "my-players";

const POSITION_FILTERS: { value: Position | "ALL"; label: string }[] = [
  { value: "ALL", label: "ALL" },
  { value: "GK", label: "GK" },
  { value: "CB", label: "CB" },
  { value: "LB", label: "LB" },
  { value: "RB", label: "RB" },
  { value: "CM", label: "CM" },
  { value: "LW", label: "LW" },
  { value: "RW", label: "RW" },
  { value: "ST", label: "ST" },
];

export default function TransfersPage() {
  const {
    slots,
    bench,
    addPlayer,
    addBenchPlayer,
    removePlayer,
    removeBenchPlayer,
    isPlayerInSquad,
    canAfford,
    filledCount,
    benchFilledCount,
  } = useSquadStore();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("market");
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | string>("");

  useEffect(() => {
    import("@/lib/data/players").then((mod) => {
      setAllPlayers(mod.PLAYERS);
      setLoaded(true);
    });
  }, []);

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

  // Owned players = starters + bench
  const ownedPlayers: { player: Player; source: "starter" | "bench"; index: number }[] = [];
  slots.forEach((p, i) => {
    if (p) ownedPlayers.push({ player: p, source: "starter", index: i });
  });
  bench.forEach((p, i) => {
    if (p) ownedPlayers.push({ player: p, source: "bench", index: i });
  });

  // Market players = all players not in squad
  const marketPlayers = allPlayers.filter((p) => !isPlayerInSquad(p.id));

  // Apply position filter
  const filteredMarket =
    posFilter === "ALL" ? marketPlayers : marketPlayers.filter((p) => p.position === posFilter);
  const filteredOwned =
    posFilter === "ALL" ? ownedPlayers : ownedPlayers.filter((o) => o.player.position === posFilter);

  function handleBuy(player: Player) {
    if (!canAfford(player)) return;
    // Try starter slot first
    const emptyStarter = slots.findIndex((s) => s === null);
    if (emptyStarter !== -1) {
      addPlayer(emptyStarter, player);
    } else {
      addBenchPlayer(player);
    }
    autoSave();
  }

  function handleSell(source: "starter" | "bench", index: number) {
    if (source === "starter") {
      removePlayer(index);
    } else {
      removeBenchPlayer(index);
    }
    autoSave();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Budget */}
      <BudgetBar />

      {/* Tab toggle */}
      <div className="flex gap-1.5 px-4 py-2 border-b border-border">
        <button
          onClick={() => setTab("market")}
          className={cn(
            "flex-1 h-9 rounded-[4px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
            tab === "market"
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-dim hover:border-border-light"
          )}
        >
          Market ({loaded ? filteredMarket.length : "..."})
        </button>
        <button
          onClick={() => setTab("my-players")}
          className={cn(
            "flex-1 h-9 rounded-[4px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
            tab === "my-players"
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-dim hover:border-border-light"
          )}
        >
          My Players ({ownedPlayers.length})
        </button>
      </div>

      {/* Position filter */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto">
        {POSITION_FILTERS.map((pf) => (
          <button
            key={pf.value}
            onClick={() => setPosFilter(pf.value)}
            className={cn(
              "shrink-0 h-7 px-2.5 rounded-[3px] font-mono text-[10px] uppercase tracking-wide border transition-colors duration-100",
              posFilter === pf.value
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light"
            )}
          >
            {pf.label}
          </button>
        ))}
      </div>

      {/* Player list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-20">
        {tab === "market" ? (
          !loaded ? (
            <div className="py-4">
              <div className="h-3 bg-border rounded-sm w-32 mb-2 animate-pulse" />
              <div className="h-3 bg-border rounded-sm w-48 mb-2 animate-pulse" />
              <div className="h-3 bg-border rounded-sm w-40 animate-pulse" />
            </div>
          ) : filteredMarket.length === 0 ? (
            <p className="font-mono text-xs text-text-dim py-4">No players available.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filteredMarket
                .sort((a, b) => b.overall - a.overall)
                .slice(0, 50)
                .map((player) => {
                  const affordable = canAfford(player);
                  const squadFull = filledCount() >= 11 && benchFilledCount() >= 10;

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 h-10 px-2 rounded-[3px] hover:bg-surface-alt transition-colors duration-100"
                    >
                      <span className={cn("font-mono text-[10px] uppercase w-6", positionColor(player.position))}>
                        {player.position}
                      </span>
                      <button
                        onClick={() => { setDetailPlayer(player); setShowDetail(true); }}
                        className="flex-1 text-left truncate font-mono text-xs text-text hover:text-accent transition-colors duration-100"
                      >
                        {player.name}
                      </button>
                      <span className="font-mono text-xs text-accent tabular-nums w-6 text-right">
                        {player.overall}
                      </span>
                      <span className="font-mono text-[10px] text-gold tabular-nums w-12 text-right">
                        {formatPrice(player.marketValue)}
                      </span>
                      <button
                        onClick={() => handleBuy(player)}
                        disabled={!affordable || squadFull}
                        className={cn(
                          "shrink-0 h-7 px-2.5 rounded-[3px] font-mono text-[10px] uppercase tracking-wide transition-colors duration-100",
                          affordable && !squadFull
                            ? "bg-accent text-black hover:bg-accent-dim"
                            : "bg-border text-text-dim cursor-not-allowed"
                        )}
                      >
                        Buy
                      </button>
                    </div>
                  );
                })}
              {filteredMarket.length > 50 && (
                <p className="font-mono text-[10px] text-text-dim text-center py-2">
                  Showing top 50 of {filteredMarket.length}. Use position filters to narrow.
                </p>
              )}
            </div>
          )
        ) : filteredOwned.length === 0 ? (
          <p className="font-mono text-xs text-text-dim py-4">No players owned{posFilter !== "ALL" ? ` at ${posFilter}` : ""}.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredOwned
              .sort((a, b) => b.player.overall - a.player.overall)
              .map(({ player, source, index }) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 h-10 px-2 rounded-[3px] hover:bg-surface-alt transition-colors duration-100"
                >
                  <span className={cn("font-mono text-[10px] uppercase w-6", positionColor(player.position))}>
                    {player.position}
                  </span>
                  <button
                    onClick={() => { setDetailPlayer(player); setShowDetail(true); }}
                    className="flex-1 text-left truncate font-mono text-xs text-text hover:text-accent transition-colors duration-100"
                  >
                    {player.name}
                  </button>
                  <span className="font-mono text-[10px] text-text-dim uppercase">
                    {source === "starter" ? "XI" : "SUB"}
                  </span>
                  <span className="font-mono text-xs text-accent tabular-nums w-6 text-right">
                    {player.overall}
                  </span>
                  <span className="font-mono text-[10px] text-gold tabular-nums w-12 text-right">
                    {formatPrice(player.marketValue)}
                  </span>
                  <button
                    onClick={() => handleSell(source, index)}
                    className="shrink-0 h-7 px-2.5 rounded-[3px] font-mono text-[10px] uppercase tracking-wide border border-danger text-danger hover:bg-danger/10 transition-colors duration-100"
                  >
                    Sell
                  </button>
                </div>
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
      />
    </div>
  );
}
