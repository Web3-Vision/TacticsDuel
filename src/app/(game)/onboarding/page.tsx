"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSquadStore } from "@/lib/stores/squad-store";
import { getFormation } from "@/lib/data/formations";
import { FORMATIONS } from "@/lib/data/formations";
import { cn, SALARY_CAP, formatPrice } from "@/lib/utils";
import type { Player, Position } from "@/lib/types";
import {
  MANAGER_ARCHETYPES,
  HAIR_STYLES,
  HAIR_COLORS,
  SKIN_TONES,
  BEARD_STYLES,
  type ManagerArchetype,
  type HairStyle,
  type HairColor,
  type SkinTone,
  type BeardStyle,
} from "@/lib/profile-options";

const TOP_CLUBS = [
  "Real Madrid", "Barcelona", "Man City", "Liverpool", "Arsenal",
  "Bayern", "PSG", "Inter", "AC Milan", "Juventus",
  "Atletico", "Dortmund", "Chelsea", "Man Utd", "Tottenham",
  "Napoli", "Benfica", "Porto", "Ajax", "Galatasaray",
  "Fenerbahce", "Besiktas", "Al Hilal", "Al Nassr", "Flamengo",
  "Boca Juniors", "River Plate", "Other",
];

const POSITION_ORDER: Position[] = ["GK", "CB", "LB", "RB", "CM", "LW", "RW", "ST"];

const TOTAL_SQUAD_SIZE = 21; // 11 starters + 10 bench

function getNextSuggestedSlot(
  slots: (Player | null)[],
  formation: ReturnType<typeof getFormation>
): number | null {
  const priorityOrder: Record<string, number> = {
    GK: 0, CB: 1, LB: 1, RB: 1, CM: 2, LW: 3, RW: 3, ST: 3,
  };
  const emptySlots = formation.slots
    .map((s, i) => ({ position: s.position, index: i, priority: priorityOrder[s.position] ?? 2 }))
    .filter(({ index }) => slots[index] === null)
    .sort((a, b) => a.priority - b.priority);

  return emptySlots.length > 0 ? emptySlots[0].index : null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [managerName, setManagerName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [age, setAge] = useState("");
  const [managerArchetype, setManagerArchetype] = useState<ManagerArchetype>(MANAGER_ARCHETYPES[0]);
  const [hairStyle, setHairStyle] = useState<HairStyle>(HAIR_STYLES[0]);
  const [hairColor, setHairColor] = useState<HairColor>(HAIR_COLORS[0]);
  const [skinTone, setSkinTone] = useState<SkinTone>(SKIN_TONES[2]);
  const [beardStyle, setBeardStyle] = useState<BeardStyle>(BEARD_STYLES[0]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    import("@/lib/data/players").then((mod) => {
      setPlayers(mod.PLAYERS);
      setLoaded(true);
    });
  }, []);

  const {
    formationId, setFormation, slots, bench, activeSlotIndex, setActiveSlot,
    addPlayer, removePlayer, addBenchPlayer, removeBenchPlayer, clearSquad,
    filledCount, benchFilledCount, totalFilledCount, totalSpent,
    budgetRemaining, isPlayerInSquad, canAfford, captainId, setCaptain,
  } = useSquadStore();

  const formation = getFormation(formationId);
  const suggestedSlot = getNextSuggestedSlot(slots, formation);
  const suggestedPosition = suggestedSlot !== null ? formation.slots[suggestedSlot].position : null;
  const startersFull = filledCount() >= 11;

  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");

  useEffect(() => {
    if (step === 3 && suggestedPosition && posFilter === "ALL" && !startersFull) {
      setPosFilter(suggestedPosition);
    }
  }, [step, suggestedPosition]);

  // When starters are full, reset filter to ALL for bench picking
  useEffect(() => {
    if (startersFull && step === 3) {
      setPosFilter("ALL");
    }
  }, [startersFull]);

  const filteredPlayers = useMemo(() => {
    let list = players;
    if (posFilter !== "ALL") {
      list = list.filter((p) => p.position === posFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q) ||
          p.club.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.overall - a.overall);
  }, [players, posFilter, search]);

  function handleAutoFill() {
    if (!loaded) return;
    const sortedPlayers = [...players].sort((a, b) => b.overall - a.overall);
    const priorityOrder: Record<string, number> = {
      GK: 0, CB: 1, LB: 1, RB: 1, CM: 2, LW: 3, RW: 3, ST: 3,
    };

    // Fill starters first
    const emptySlots = formation.slots
      .map((slot, i) => ({ slot, i }))
      .filter(({ i }) => slots[i] === null)
      .sort((a, b) => (priorityOrder[a.slot.position] ?? 2) - (priorityOrder[b.slot.position] ?? 2));

    let remainingTotal = emptySlots.length + bench.filter((p) => p === null).length;

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
    const state = useSquadStore.getState();
    const emptyBenchCount = state.bench.filter((p) => p === null).length;
    for (let b = 0; b < emptyBenchCount; b++) {
      const currentState = useSquadStore.getState();
      const remaining = currentState.budgetRemaining();
      const benchEmpty = currentState.bench.filter((p) => p === null).length;
      const targetPerSlot = remaining / Math.max(1, benchEmpty);
      const maxSpend = Math.min(targetPerSlot * 1.5, remaining);
      const available = sortedPlayers.find(
        (p) =>
          !currentState.isPlayerInSquad(p.id) &&
          p.marketValue <= maxSpend
      );
      if (available) {
        currentState.addBenchPlayer(available);
      }
    }
  }

  function handleSelectPlayer(player: Player) {
    if (startersFull) {
      // Add to bench
      addBenchPlayer(player);
      return;
    }

    const targetSlot = activeSlotIndex ?? suggestedSlot;
    if (targetSlot !== null) {
      addPlayer(targetSlot, player);
      setActiveSlot(null);
    } else {
      const emptyIdx = formation.slots.findIndex(
        (s, i) => s.position === player.position && slots[i] === null
      );
      if (emptyIdx !== -1) addPlayer(emptyIdx, player);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setSaveError("");
    try {
      await useSquadStore.getState().saveToSupabase();

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manager_name: managerName.trim(),
          favorite_team: favoriteTeam || null,
          age: age ? parseInt(age) : null,
          manager_avatar_archetype: managerArchetype,
          manager_hair_style: hairStyle,
          manager_hair_color: hairColor,
          manager_skin_tone: skinTone,
          manager_beard_style: beardStyle,
          captain_player_id: captainId,
          onboarding_completed: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      router.push("/home");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }

  // All players for captain selection
  const allSquadPlayers = [
    ...slots.map((p, i) => p ? { player: p, label: formation.slots[i].label, type: "Starter" as const } : null),
    ...bench.map((p, i) => p ? { player: p, label: `Sub ${i + 1}`, type: "Bench" as const } : null),
  ].filter(Boolean) as { player: Player; label: string; type: "Starter" | "Bench" }[];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-7rem)]">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-200",
                s <= step ? "bg-accent" : "bg-border"
              )}
            />
          ))}
        </div>
        <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider mt-2">
          Step {step} of 5
        </p>
      </div>

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <h1 className="font-mono text-xl font-semibold tracking-wider uppercase mb-1">
            Welcome, Manager
          </h1>
          <p className="text-text-dim text-sm text-center mb-8">
            Tell us a bit about yourself
          </p>

          <div className="w-full max-w-[340px] flex flex-col gap-3">
            <div>
              <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                Manager Name
              </label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                minLength={2}
                maxLength={40}
                className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                Favorite Team
              </label>
              <select
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
                className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text focus:outline-none focus:border-accent transition-colors duration-100"
              >
                <option value="">Select a team...</option>
                {TOP_CLUBS.map((club) => (
                  <option key={club} value={club}>{club}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                Your Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 25"
                min={13}
                max={99}
                className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                  Character
                </label>
                <select
                  value={managerArchetype}
                  onChange={(e) => setManagerArchetype(e.target.value as ManagerArchetype)}
                  className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-2 font-mono text-xs text-text focus:outline-none focus:border-accent transition-colors duration-100"
                >
                  {MANAGER_ARCHETYPES.map((archetype) => (
                    <option key={archetype} value={archetype}>
                      {archetype}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                  Skin Tone
                </label>
                <select
                  value={skinTone}
                  onChange={(e) => setSkinTone(e.target.value as SkinTone)}
                  className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-2 font-mono text-xs text-text focus:outline-none focus:border-accent transition-colors duration-100"
                >
                  {SKIN_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                  Hair Style
                </label>
                <select
                  value={hairStyle}
                  onChange={(e) => setHairStyle(e.target.value as HairStyle)}
                  className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-2 font-mono text-xs text-text focus:outline-none focus:border-accent transition-colors duration-100"
                >
                  {HAIR_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                  Hair Color
                </label>
                <select
                  value={hairColor}
                  onChange={(e) => setHairColor(e.target.value as HairColor)}
                  className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-2 font-mono text-xs text-text focus:outline-none focus:border-accent transition-colors duration-100"
                >
                  {HAIR_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                Beard
              </label>
              <select
                value={beardStyle}
                onChange={(e) => setBeardStyle(e.target.value as BeardStyle)}
                className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text focus:outline-none focus:border-accent transition-colors duration-100"
              >
                {BEARD_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={managerName.trim().length < 2}
              className="w-full h-[44px] mt-4 bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
            >
              Continue
            </button>

            <button
              onClick={() => setStep(2)}
              className="font-mono text-xs text-text-dim hover:text-text-mid transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Formation */}
      {step === 2 && (
        <div className="flex-1 flex flex-col px-4 py-6">
          <h2 className="font-mono text-lg font-semibold tracking-wider uppercase text-center mb-1">
            Choose Formation
          </h2>
          <p className="text-text-dim text-sm text-center mb-6">
            Pick how your team lines up
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-[400px] mx-auto w-full">
            {FORMATIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormation(f.id)}
                className={cn(
                  "relative border rounded-md p-3 transition-colors duration-100",
                  formationId === f.id
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-border-light"
                )}
              >
                <div className="relative w-full aspect-[3/4] mb-2">
                  {f.slots.map((slot, i) => (
                    <div
                      key={i}
                      className={cn(
                        "absolute w-2.5 h-2.5 rounded-full transform -translate-x-1/2 -translate-y-1/2",
                        formationId === f.id ? "bg-accent" : "bg-text-dim"
                      )}
                      style={{
                        left: `${slot.x}%`,
                        top: `${(slot.y * 100) / 130}%`,
                      }}
                    />
                  ))}
                </div>
                <span className={cn(
                  "font-mono text-sm font-medium",
                  formationId === f.id ? "text-accent" : "text-text-mid"
                )}>
                  {f.name}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-6 max-w-[400px] mx-auto w-full">
            <button
              onClick={() => setStep(1)}
              className="flex-1 h-[44px] border border-border text-text-mid font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
            >
              Back
            </button>
            <button
              onClick={() => { clearSquad(); setFormation(formationId); setStep(3); }}
              className="flex-1 h-[44px] bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Build Squad */}
      {step === 3 && (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="px-4 py-2 border-b border-border">
            <h2 className="font-mono text-sm font-semibold tracking-wider uppercase">
              {startersFull ? "Pick Bench Players" : "Build Your Squad"}
            </h2>
            <p className="text-text-dim text-xs">
              {startersFull
                ? `${benchFilledCount()}/10 bench selected (${totalFilledCount()}/21 total)`
                : `${filledCount()}/11 starters selected`
              }
              {!startersFull && suggestedPosition && filledCount() < 11 && (
                <> — Pick a <span className="text-accent">{suggestedPosition}</span></>
              )}
            </p>
          </div>

          {/* Budget bar */}
          <div className="px-4 py-2 bg-surface border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-text-dim">
                {formatPrice(budgetRemaining())} left
              </span>
              {totalFilledCount() < TOTAL_SQUAD_SIZE && (
                <span className="font-mono text-xs text-text-dim">
                  ~{formatPrice(Math.round(budgetRemaining() / Math.max(1, TOTAL_SQUAD_SIZE - totalFilledCount())))}/slot
                </span>
              )}
            </div>
            <div className="h-1.5 bg-border rounded-sm overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-100",
                  budgetRemaining() > SALARY_CAP * 0.4 ? "bg-accent" : budgetRemaining() > SALARY_CAP * 0.15 ? "bg-gold" : "bg-danger"
                )}
                style={{ width: `${Math.min(100, (totalSpent() / SALARY_CAP) * 100)}%` }}
              />
            </div>
          </div>

          {/* Pitch — larger */}
          <div className="px-4 py-2">
            <div className="relative w-full aspect-[3/2] max-h-[240px] bg-pitch/20 border border-border rounded-md overflow-hidden">
              {formation.slots.map((slot, i) => {
                const player = slots[i];
                const isSuggested = i === suggestedSlot && !player;
                const isActive = activeSlotIndex === i;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (startersFull && player) return;
                      setActiveSlot(isActive ? null : i);
                      if (!isActive && !player) {
                        setPosFilter(slot.position);
                      }
                    }}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{
                      left: `${slot.x}%`,
                      top: `${(slot.y * 100) / 130}%`,
                    }}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-medium border",
                        player
                          ? "bg-accent/20 border-accent text-accent"
                          : isSuggested
                            ? "bg-accent/10 border-accent text-accent animate-pulse"
                            : isActive
                              ? "bg-surface-alt border-accent text-accent"
                              : "bg-surface border-border text-text-dim"
                      )}
                    >
                      {player ? player.overall : slot.label}
                    </div>
                    <span className="font-mono text-[8px] text-text-mid truncate max-w-[56px]">
                      {player ? player.name.split(" ").pop() : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bench display (when starters are full) */}
          {startersFull && (
            <div className="px-4 py-1.5 border-b border-border">
              <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                Bench ({benchFilledCount()}/10)
              </p>
              <div className="flex gap-1 flex-wrap">
                {bench.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-6 px-2 rounded-sm flex items-center gap-1 font-mono text-[10px] border",
                      p ? "border-accent/50 text-accent bg-accent/5" : "border-border text-text-dim"
                    )}
                  >
                    {p ? (
                      <>
                        <span>{p.overall}</span>
                        <span className="truncate max-w-[60px]">{p.name}</span>
                        <button
                          onClick={() => removeBenchPlayer(i)}
                          className="text-text-dim hover:text-danger ml-0.5"
                        >
                          x
                        </button>
                      </>
                    ) : (
                      <span>Empty</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="flex gap-2 px-4 py-1.5">
            <button
              onClick={handleAutoFill}
              disabled={totalFilledCount() === TOTAL_SQUAD_SIZE}
              className="flex-1 h-8 border border-border text-text-mid font-mono text-[10px] uppercase tracking-wide rounded-[4px] hover:border-accent hover:text-accent transition-colors duration-100 disabled:opacity-30"
            >
              Auto-Fill Remaining
            </button>
            <button
              onClick={clearSquad}
              className="h-8 px-3 border border-border text-text-dim font-mono text-[10px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
            >
              Clear
            </button>
          </div>

          {/* Position filter pills */}
          <div className="flex gap-1.5 px-4 py-1.5 overflow-x-auto border-b border-border">
            {(["ALL", ...POSITION_ORDER] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={cn(
                  "shrink-0 h-7 px-2 rounded-[3px] font-mono text-[10px] uppercase tracking-wide border transition-colors duration-100",
                  posFilter === pos
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-dim hover:border-border-light"
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-4 py-1.5 border-b border-border">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full h-8 bg-surface-alt border border-border rounded-[4px] pl-3 pr-3 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
            />
          </div>

          {/* Player list */}
          <div className="flex-1 overflow-y-auto min-h-0 pb-14">
            {filteredPlayers.length === 0 ? (
              <p className="text-text-dim text-xs text-center py-6">No players found.</p>
            ) : (
              filteredPlayers.map((player) => {
                const inSquad = isPlayerInSquad(player.id);
                const affordable = canAfford(player);
                return (
                  <button
                    key={player.id}
                    onClick={() => !inSquad && affordable && handleSelectPlayer(player)}
                    disabled={inSquad || !affordable}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2 border-b border-border/50 transition-colors duration-100",
                      inSquad
                        ? "opacity-30"
                        : !affordable
                          ? "opacity-40"
                          : "hover:bg-surface-alt"
                    )}
                  >
                    <span className={cn(
                      "font-mono text-sm font-semibold w-6 tabular-nums",
                      player.overall >= 85 ? "text-gold" : player.overall >= 75 ? "text-text" : "text-text-mid"
                    )}>
                      {player.overall}
                    </span>
                    <span className="font-mono text-[10px] text-text-dim uppercase w-6">
                      {player.position}
                    </span>
                    <span className="flex-1 font-mono text-sm text-text truncate">
                      {player.name}
                    </span>
                    <span className="font-mono text-xs text-text-dim">{player.club}</span>
                    <span className="font-mono text-xs text-accent tabular-nums w-14 text-right">
                      {formatPrice(player.marketValue)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Floating bottom nav */}
          <div className="sticky bottom-0 z-10 flex gap-2 px-4 py-3 border-t border-border bg-bg">
            <button
              onClick={() => setStep(2)}
              className="flex-1 h-[40px] border border-border text-text-mid font-mono text-xs uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={totalFilledCount() < TOTAL_SQUAD_SIZE}
              className="flex-1 h-[40px] bg-accent text-black font-mono text-xs font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-30"
            >
              {totalFilledCount() < TOTAL_SQUAD_SIZE
                ? `${totalFilledCount()}/${TOTAL_SQUAD_SIZE} Selected`
                : "Pick Captain"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Captain */}
      {step === 4 && (
        <div className="flex-1 flex flex-col px-4 py-6">
          <h2 className="font-mono text-lg font-semibold tracking-wider uppercase text-center mb-1">
            Choose Your Captain
          </h2>
          <p className="text-text-dim text-sm text-center mb-6">
            Tap a player to make them captain
          </p>

          <div className="flex flex-col gap-1.5 max-w-[400px] mx-auto w-full">
            {allSquadPlayers.map(({ player, label, type }) => {
              const isCaptain = captainId === player.id;
              return (
                <button
                  key={player.id}
                  onClick={() => setCaptain(player.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 border rounded-md transition-colors duration-100",
                    isCaptain
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-border-light"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-semibold",
                    isCaptain ? "bg-accent text-black" : "bg-surface-alt text-text-mid"
                  )}>
                    {isCaptain ? "C" : player.overall}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-mono text-sm text-text">{player.name}</span>
                    <span className="block font-mono text-[10px] text-text-dim uppercase">
                      {label} — {player.club}
                      {type === "Bench" && <span className="text-text-dim/60 ml-1">(Bench)</span>}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-text-dim">{player.position}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 mt-6 max-w-[400px] mx-auto w-full">
            <button
              onClick={() => setStep(3)}
              className="flex-1 h-[44px] border border-border text-text-mid font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
            >
              Back
            </button>
            <button
              onClick={() => setStep(5)}
              disabled={!captainId}
              className="flex-1 h-[44px] bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-30"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Ready */}
      {step === 5 && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-14 h-14 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center mb-4">
            <span className="font-mono text-lg font-bold text-accent">OK</span>
          </div>
          <h2 className="font-mono text-xl font-semibold tracking-wider uppercase mb-1">
            Squad Ready
          </h2>
          <p className="text-text-dim text-sm text-center mb-2">
            {totalFilledCount()} players selected — {formatPrice(totalSpent())} spent
          </p>
          {captainId && (() => {
            const captain = [...slots, ...bench].find((p) => p?.id === captainId);
            return captain ? (
              <p className="text-text-mid text-sm mb-6">
                Captain: <span className="text-accent font-medium">{captain.name}</span>
              </p>
            ) : null;
          })()}

          {/* Larger pitch preview */}
          <div className="relative w-full max-w-[380px] aspect-[3/4] max-h-[280px] bg-pitch/20 border border-border rounded-md overflow-hidden mb-6">
            {formation.slots.map((slot, i) => {
              const player = slots[i];
              const isCaptain = player && captainId === player.id;
              return (
                <div
                  key={i}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{
                    left: `${slot.x}%`,
                    top: `${(slot.y * 100) / 130}%`,
                  }}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-medium border",
                    isCaptain
                      ? "bg-accent border-accent text-black"
                      : player
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-surface border-border text-text-dim"
                  )}>
                    {isCaptain ? "C" : player ? player.overall : slot.label}
                  </div>
                  <span className="font-mono text-[8px] text-text-mid truncate max-w-[56px]">
                    {player ? player.name.split(" ").pop() : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bench summary */}
          {benchFilledCount() > 0 && (
            <div className="w-full max-w-[380px] mb-4">
              <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1">
                Bench ({benchFilledCount()})
              </p>
              <div className="flex gap-1 flex-wrap">
                {bench.filter(Boolean).map((p) => (
                  <span
                    key={p!.id}
                    className="h-5 px-2 rounded-sm font-mono text-[10px] border border-border text-text-mid bg-surface flex items-center"
                  >
                    {p!.overall} {p!.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <p className="text-danger text-xs font-mono mb-3 text-center max-w-[340px]">{saveError}</p>
          )}

          <div className="flex flex-col gap-2 w-full max-w-[340px]">
            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full h-[48px] bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Start Playing"}
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={saving}
              className="font-mono text-xs text-text-dim hover:text-text-mid transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
