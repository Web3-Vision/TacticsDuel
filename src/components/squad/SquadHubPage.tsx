"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PitchView from "@/components/pitch/PitchView";
import BudgetBar from "@/components/squad/BudgetBar";
import PlayerDetail from "@/components/squad/PlayerDetail";
import TacticsForm from "@/components/squad/TacticsForm";
import { FORMATIONS, getFormation } from "@/lib/data/formations";
import { PLAYERS } from "@/lib/data/players";
import type { Player } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";
import {
  beginLineupMutation,
  idleLineupMutationState,
  resolveLineupMutation,
  type LineupMutationState,
} from "@/lib/squad/lineup-mutation-state";
import { buildSquadHubViewModel } from "@/lib/squad/squad-hub-view-model";
import { useSquadStore } from "@/lib/stores/squad-store";

type DetailSource = "starter" | "bench" | null;

interface SquadSnapshot {
  formationId: string;
  slots: (Player | null)[];
  bench: (Player | null)[];
  captainId: string | null;
  activeSlotIndex: number | null;
}

interface MarketListing {
  player_id: string;
  status: string;
}

function cloneSnapshot(): SquadSnapshot {
  const state = useSquadStore.getState();
  return {
    formationId: state.formationId,
    slots: [...state.slots],
    bench: [...state.bench],
    captainId: state.captainId,
    activeSlotIndex: state.activeSlotIndex,
  };
}

function chemistryChipClass(label: "isolated" | "linked" | "strong" | "elite") {
  if (label === "elite") return "text-accent border-accent/60 bg-accent/10";
  if (label === "strong") return "text-home border-home/50 bg-home/10";
  if (label === "linked") return "text-gold border-gold/50 bg-gold/10";
  return "text-text-dim border-border bg-surface-alt";
}

export default function SquadHubPage() {
  const {
    formationId,
    setFormation,
    slots,
    bench,
    activeSlotIndex,
    setActiveSlot,
    removePlayer,
    removeBenchPlayer,
    clearSquad,
    setCaptain,
    filledCount,
    benchFilledCount,
    isPlayerInSquad,
  } = useSquadStore();

  const [view, setView] = useState<"squad" | "tactics">("squad");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [detailSource, setDetailSource] = useState<DetailSource>(null);
  const [detailIndex, setDetailIndex] = useState<number>(-1);
  const [showDetail, setShowDetail] = useState(false);
  const [mutation, setMutation] = useState<LineupMutationState>(idleLineupMutationState());
  const [listedPlayerIds, setListedPlayerIds] = useState<Set<string>>(new Set());
  const [marketError, setMarketError] = useState<string>("");

  const viewModel = useMemo(
    () =>
      buildSquadHubViewModel({
        starters: slots,
        bench,
        captainId: useSquadStore.getState().captainId,
        listedPlayerIds,
      }),
    [slots, bench, listedPlayerIds],
  );

  const syncMutation = useCallback(async (mutate: () => void) => {
    const snapshot = cloneSnapshot();
    mutate();
    setMutation(beginLineupMutation());

    try {
      await useSquadStore.getState().saveToSupabase();
      await useSquadStore.getState().loadFromSupabase();
      setMutation(resolveLineupMutation(true));
      setTimeout(() => {
        setMutation(idleLineupMutationState());
      }, 1800);
    } catch (error) {
      useSquadStore.setState(snapshot);
      setMutation(
        resolveLineupMutation(
          false,
          error instanceof Error ? error.message : "Save failed and local changes were rolled back",
        ),
      );
    }
  }, []);

  const loadListings = useCallback(async () => {
    setMarketError("");
    try {
      const response = await fetch("/api/market/listings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load listing state");
      }

      const ids = new Set<string>();
      for (const listing of (payload?.listings as MarketListing[] | undefined) ?? []) {
        if (listing.status === "open") {
          ids.add(listing.player_id);
        }
      }
      setListedPlayerIds(ids);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Failed to load listing state");
    }
  }, []);

  useEffect(() => {
    loadListings().catch(() => undefined);
    const timer = setInterval(() => {
      loadListings().catch(() => undefined);
    }, 45_000);

    return () => clearInterval(timer);
  }, [loadListings]);

  function openStarterDetail(slotIndex: number) {
    const player = useSquadStore.getState().slots[slotIndex];
    if (!player) {
      setActiveSlot(activeSlotIndex === slotIndex ? null : slotIndex);
      return;
    }

    setDetailPlayer(player);
    setDetailSource("starter");
    setDetailIndex(slotIndex);
    setShowDetail(true);
  }

  function openBenchDetail(player: Player, index: number) {
    setDetailPlayer(player);
    setDetailSource("bench");
    setDetailIndex(index);
    setShowDetail(true);
  }

  function handleSwapWithStarter(benchIndex: number) {
    if (activeSlotIndex === null) {
      const player = bench[benchIndex];
      if (player) openBenchDetail(player, benchIndex);
      return;
    }

    syncMutation(() => {
      const state = useSquadStore.getState();
      const nextSlots = [...state.slots];
      const nextBench = [...state.bench];
      const starter = nextSlots[activeSlotIndex];
      nextSlots[activeSlotIndex] = nextBench[benchIndex];
      nextBench[benchIndex] = starter;
      useSquadStore.setState({ slots: nextSlots, bench: nextBench, activeSlotIndex: null });
    }).catch(() => undefined);
  }

  function handleRemoveFromDetail() {
    if (!detailPlayer) return;

    syncMutation(() => {
      if (detailSource === "starter") {
        removePlayer(detailIndex);
      } else if (detailSource === "bench") {
        removeBenchPlayer(detailIndex);
      }
    }).catch(() => undefined);

    setShowDetail(false);
    setDetailPlayer(null);
    setDetailSource(null);
    setDetailIndex(-1);
  }

  function handleSetCaptain() {
    if (!detailPlayer) return;

    syncMutation(() => {
      setCaptain(detailPlayer.id);
    }).catch(() => undefined);

    setShowDetail(false);
    setDetailPlayer(null);
    setDetailSource(null);
    setDetailIndex(-1);
  }

  function handleClear() {
    syncMutation(() => {
      clearSquad();
    }).catch(() => undefined);
  }

  function handleFormationChange(id: string) {
    syncMutation(() => {
      setFormation(id);
    }).catch(() => undefined);
  }

  function handleAutoFill() {
    syncMutation(() => {
      const sortedPlayers = [...PLAYERS].sort((a, b) => b.overall - a.overall);
      const priorityOrder: Record<string, number> = {
        GK: 0,
        CB: 1,
        LB: 1,
        RB: 1,
        CM: 2,
        LW: 3,
        RW: 3,
        ST: 3,
      };

      const currentFormation = getFormation(useSquadStore.getState().formationId);
      const emptySlots = currentFormation.slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ index }) => useSquadStore.getState().slots[index] === null)
        .sort((a, b) => (priorityOrder[a.slot.position] ?? 2) - (priorityOrder[b.slot.position] ?? 2));

      let remaining = emptySlots.length + useSquadStore.getState().bench.filter((player) => player === null).length;

      for (const { slot, index } of emptySlots) {
        const state = useSquadStore.getState();
        const budgetRemaining = state.budgetRemaining();
        const maxSpend = Math.min((budgetRemaining / Math.max(1, remaining)) * 1.5, budgetRemaining);
        const candidate = sortedPlayers.find(
          (player) =>
            player.position === slot.position &&
            !state.isPlayerInSquad(player.id) &&
            player.marketValue <= maxSpend,
        );

        if (candidate) {
          state.addPlayer(index, candidate);
          remaining -= 1;
        }
      }

      for (const position of ["GK", "CB", "LB", "RB", "CM", "LW", "RW", "ST"] as const) {
        const state = useSquadStore.getState();
        const nextEmpty = state.bench.findIndex((player) => player === null);
        if (nextEmpty === -1) break;

        const budgetRemaining = state.budgetRemaining();
        const maxSpend = Math.min(
          (budgetRemaining / Math.max(1, state.bench.filter((player) => player === null).length)) * 1.5,
          budgetRemaining,
        );

        const candidate = sortedPlayers.find(
          (player) =>
            player.position === position &&
            !state.isPlayerInSquad(player.id) &&
            player.marketValue <= maxSpend,
        );

        if (candidate) {
          state.addBenchPlayer(candidate);
        }
      }
    }).catch(() => undefined);
  }

  const benchPlayers = bench
    .map((player, index) => (player ? { player, index } : null))
    .filter((entry): entry is { player: Player; index: number } => entry !== null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-4 py-2 border-b border-border bg-surface">
        <button
          onClick={() => setView("squad")}
          className={cn(
            "h-8 px-4 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
            view === "squad"
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-dim hover:border-border-light",
          )}
        >
          Squad
        </button>
        <button
          onClick={() => setView("tactics")}
          className={cn(
            "h-8 px-4 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
            view === "tactics"
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-dim hover:border-border-light",
          )}
        >
          Tactics
        </button>
      </div>

      {view === "tactics" ? (
        <div className="flex-1 p-4 pb-20 overflow-y-auto">
          <PitchView />
          <div className="mt-4">
            <TacticsForm showFormation={true} stickyButton={true} />
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-border bg-surface grid grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
              <p className="font-mono text-[9px] text-text-dim uppercase">Starters</p>
              <p className="font-mono text-xs text-text tabular-nums mt-0.5">{viewModel.startersFilled}/11</p>
            </div>
            <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
              <p className="font-mono text-[9px] text-text-dim uppercase">Bench</p>
              <p className="font-mono text-xs text-text tabular-nums mt-0.5">{viewModel.benchFilled}/10</p>
            </div>
            <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
              <p className="font-mono text-[9px] text-text-dim uppercase">Chemistry</p>
              <p
                className={cn(
                  "font-mono text-xs tabular-nums mt-0.5 uppercase",
                  viewModel.chemistrySummary.label === "hot"
                    ? "text-accent"
                    : viewModel.chemistrySummary.label === "steady"
                      ? "text-gold"
                      : "text-text-mid",
                )}
              >
                {viewModel.chemistrySummary.score}%
              </p>
            </div>
            <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
              <p className="font-mono text-[9px] text-text-dim uppercase">Linked</p>
              <p className="font-mono text-xs text-text tabular-nums mt-0.5">{viewModel.chemistrySummary.linkedPlayers}/11</p>
            </div>
            <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2 col-span-2 lg:col-span-1">
              <p className="font-mono text-[9px] text-text-dim uppercase">Readiness</p>
              <p className={cn("font-mono text-xs tabular-nums mt-0.5", viewModel.isReady ? "text-accent" : "text-text")}>{viewModel.isReady ? "Ready" : "Incomplete"}</p>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-border bg-surface">
            <div className="rounded-md border border-accent/45 bg-[linear-gradient(120deg,rgba(0,255,65,0.12),rgba(0,255,65,0.02))] px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Transfer Window</p>
                <p className="font-mono text-xs text-text-mid mt-1">
                  Fill weak chemistry links and replace listed players in one tap.
                </p>
                {marketError && (
                  <p className="mt-1 font-mono text-[10px] text-gold">
                    Market listings are unavailable right now. Squad saving still works.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/club/market?view=squad-needs"
                  className="h-8 px-3 rounded-[4px] border border-accent text-accent font-mono text-[10px] uppercase tracking-wide flex items-center hover:bg-accent/10"
                >
                  Find Fits
                </Link>
                <Link
                  href="/club/market"
                  className="h-8 px-3 rounded-[4px] bg-accent text-black font-mono text-[10px] uppercase tracking-wide flex items-center hover:bg-accent-dim"
                >
                  Open Market
                </Link>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border bg-surface">
            {FORMATIONS.map((nextFormation) => (
              <button
                key={nextFormation.id}
                onClick={() => handleFormationChange(nextFormation.id)}
                className={cn(
                  "shrink-0 h-8 px-3 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
                  formationId === nextFormation.id
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-dim hover:border-border-light",
                )}
              >
                {nextFormation.name}
              </button>
            ))}
          </div>

          <BudgetBar />

          <div className="px-4 py-3">
            <PitchView />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <p className="font-mono text-[10px] text-text-dim">Tap a starter to inspect details.</p>
              <p className="font-mono text-[10px] text-text-dim">Pick a bench player to swap instantly.</p>
              <p className="font-mono text-[10px] text-text-dim">Use chemistry tags to optimize links.</p>
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="bg-surface border border-border rounded-md p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">Starter lines</span>
                {viewModel.captain && (
                  <span className="font-mono text-[10px] text-accent uppercase tracking-wide">C: {viewModel.captain.name}</span>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {viewModel.lines.map((line) => (
                  <div key={line.key}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-mono text-[10px] text-text-dim uppercase">{line.label}</p>
                      <span
                        className={cn(
                          "font-mono text-[10px] uppercase",
                          line.chemistryAvg >= 7 ? "text-accent" : line.chemistryAvg >= 4 ? "text-gold" : "text-text-mid",
                        )}
                      >
                        Chem {line.chemistryAvg}
                      </span>
                    </div>
                    {line.players.length === 0 ? (
                      <p className="font-mono text-[10px] text-text-dim">No players assigned.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {line.players.map((player) => {
                          const slotIndex = slots.findIndex((slotPlayer) => slotPlayer?.id === player.id);
                          const isSelected = slotIndex === activeSlotIndex;
                          const chemistry = viewModel.chemistryByPlayerId[player.id];
                          return (
                            <div
                              key={player.id}
                              className={cn(
                                "rounded-[5px] border p-2.5",
                                isSelected ? "border-accent bg-accent/10" : "border-border bg-bg",
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => openStarterDetail(slotIndex)}
                                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                                >
                                  <div className="w-8 shrink-0">
                                    <span className="font-mono text-sm text-accent tabular-nums">{player.overall}</span>
                                    <span className="block font-mono text-[9px] text-text-dim uppercase">{player.position}</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-mono text-xs text-text truncate">{player.name}</p>
                                    <p className="font-mono text-[10px] text-text-dim truncate">{player.club}</p>
                                  </div>
                                </button>
                                <Link
                                  href={`/club/market?playerId=${player.id}`}
                                  className="h-7 px-2.5 rounded-[3px] border border-accent/70 text-accent font-mono text-[10px] uppercase flex items-center hover:bg-accent/10"
                                >
                                  Replace
                                </Link>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={cn(
                                    "h-5 px-1.5 rounded-[3px] border font-mono text-[9px] uppercase tracking-wide inline-flex items-center",
                                    chemistryChipClass(chemistry?.label ?? "isolated"),
                                  )}
                                >
                                  {chemistry?.label ?? "isolated"}
                                </span>
                                {chemistry && chemistry.clubLinks > 0 && (
                                  <span className="font-mono text-[9px] text-text-mid uppercase">Club x{chemistry.clubLinks}</span>
                                )}
                                {chemistry && chemistry.nationLinks > 0 && (
                                  <span className="font-mono text-[9px] text-text-mid uppercase">Nation x{chemistry.nationLinks}</span>
                                )}
                                {listedPlayerIds.has(player.id) && (
                                  <span className="font-mono text-[9px] text-gold uppercase">Listed</span>
                                )}
                                <span className="font-mono text-[9px] text-text-mid tabular-nums ml-auto">
                                  {formatPrice(player.marketValue)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 px-4 pb-2">
            <button
              onClick={handleAutoFill}
              className="flex-1 h-9 border border-accent text-accent font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:bg-accent/10 transition-colors duration-100"
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
              href="/club/market"
              className="flex-1 h-9 border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] flex items-center justify-center hover:border-border-light transition-colors duration-100"
            >
              Transfers
            </Link>
          </div>

          <div className="flex-1 min-h-0 border-t border-border px-4 py-3 pb-20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-text-dim uppercase tracking-widest">
                Bench ({benchFilledCount()}/10)
              </span>
            </div>
            {benchPlayers.length === 0 ? (
              <p className="font-mono text-xs text-text-dim">
                No bench players. <Link href="/club/market" className="text-accent">Add via Transfers</Link>
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {benchPlayers.map(({ player, index }) => {
                  const chemistry = viewModel.chemistryByPlayerId[player.id];
                  return (
                    <div key={player.id} className="flex items-center gap-2 min-h-9 px-2 rounded-[3px] border border-border">
                      <button
                        onClick={() => handleSwapWithStarter(index)}
                        className="flex items-center gap-2 flex-1 text-left min-w-0 py-1.5"
                      >
                        <span className="font-mono text-[10px] text-text-dim uppercase w-6">{player.position}</span>
                        <span className="font-mono text-xs text-text truncate">{player.name}</span>
                        {chemistry && (
                          <span className={cn("font-mono text-[9px] uppercase", chemistry.label === "elite" ? "text-accent" : chemistry.label === "strong" ? "text-gold" : "text-text-dim")}>
                            {chemistry.label}
                          </span>
                        )}
                        {listedPlayerIds.has(player.id) && (
                          <span className="font-mono text-[9px] text-gold uppercase">Listed</span>
                        )}
                      </button>
                      <span className="font-mono text-xs text-accent tabular-nums w-6 text-right">{player.overall}</span>
                      <span className="font-mono text-[10px] text-gold tabular-nums">{formatPrice(player.marketValue)}</span>
                      <Link
                        href={`/club/market?playerId=${player.id}`}
                        className="font-mono text-[10px] text-accent uppercase"
                      >
                        Market
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sticky bottom-14 bg-surface border-t border-border px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-mid">{filledCount()}/11 + {benchFilledCount()}/10</span>
              {mutation.status === "saving" && <span className="font-mono text-[10px] text-text-dim">Saving...</span>}
              {mutation.status === "saved" && <span className="font-mono text-[10px] text-accent">Saved</span>}
              {mutation.status === "error" && <span className="font-mono text-[10px] text-danger">{mutation.message}</span>}
            </div>
            <button
              onClick={() => {
                syncMutation(() => {}).catch(() => undefined);
              }}
              disabled={mutation.status === "saving"}
              className="h-8 px-4 bg-accent text-black font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-50"
            >
              {mutation.status === "saving" ? "Saving..." : "Save"}
            </button>
          </div>

          <PlayerDetail
            player={detailPlayer}
            open={showDetail}
            onClose={() => {
              setShowDetail(false);
              setDetailPlayer(null);
              setDetailSource(null);
              setDetailIndex(-1);
            }}
            onRemove={handleRemoveFromDetail}
            inSquad={isPlayerInSquad(detailPlayer?.id ?? "")}
            canAfford={false}
          />

          {showDetail && detailPlayer && isPlayerInSquad(detailPlayer.id) && (
            <div className="fixed inset-x-0 bottom-0 z-[61] px-4 pb-6 pointer-events-none">
              <div className="pointer-events-auto max-w-md mx-auto bg-surface border border-border rounded-md p-3">
                <button
                  onClick={handleSetCaptain}
                  className="w-full h-9 border border-accent text-accent rounded-[4px] font-mono text-[11px] uppercase tracking-wide"
                >
                  Assign Captain
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
