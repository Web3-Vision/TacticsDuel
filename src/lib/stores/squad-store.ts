import { create } from "zustand";
import type { Player, Position } from "../types";
import { SALARY_CAP } from "../utils";
import { getFormation } from "../data/formations";
import { getPlayerById } from "../data/players";

const BENCH_SIZE = 10;

interface SquadState {
  formationId: string;
  slots: (Player | null)[];
  bench: (Player | null)[];
  activeSlotIndex: number | null;
  captainId: string | null;
  squadLoaded: boolean;

  setFormation: (id: string) => void;
  setActiveSlot: (index: number | null) => void;
  addPlayer: (slotIndex: number, player: Player) => void;
  removePlayer: (slotIndex: number) => void;
  addBenchPlayer: (player: Player) => void;
  removeBenchPlayer: (index: number) => void;
  clearSquad: () => void;
  setCaptain: (playerId: string | null) => void;
  loadSquad: (formationId: string, slots: (Player | null)[]) => void;
  saveToSupabase: () => Promise<void>;
  loadFromSupabase: () => Promise<void>;

  // Derived
  totalSpent: () => number;
  budgetRemaining: () => number;
  filledCount: () => number;
  benchFilledCount: () => number;
  totalFilledCount: () => number;
  emptySlotCount: () => number;
  avgBudgetPerSlot: () => number;
  positionForSlot: (index: number) => Position;
  isPlayerInSquad: (playerId: string) => boolean;
  canAfford: (player: Player) => boolean;
}

export const useSquadStore = create<SquadState>((set, get) => ({
  formationId: "4-3-3",
  slots: Array(11).fill(null),
  bench: Array(BENCH_SIZE).fill(null),
  activeSlotIndex: null,
  captainId: null,
  squadLoaded: false,

  setFormation: (id) => {
    set({ formationId: id, slots: Array(11).fill(null), bench: Array(BENCH_SIZE).fill(null), activeSlotIndex: null, captainId: null });
  },

  setActiveSlot: (index) => set({ activeSlotIndex: index }),

  addPlayer: (slotIndex, player) => {
    const state = get();
    if (!state.canAfford(player)) return;
    if (state.isPlayerInSquad(player.id)) return;

    const newSlots = [...state.slots];
    newSlots[slotIndex] = player;
    set({ slots: newSlots, activeSlotIndex: null });
  },

  removePlayer: (slotIndex) => {
    const newSlots = [...get().slots];
    newSlots[slotIndex] = null;
    set({ slots: newSlots });
  },

  addBenchPlayer: (player) => {
    const state = get();
    if (!state.canAfford(player)) return;
    if (state.isPlayerInSquad(player.id)) return;

    const newBench = [...state.bench];
    const emptyIdx = newBench.findIndex((p) => p === null);
    if (emptyIdx === -1) return;
    newBench[emptyIdx] = player;
    set({ bench: newBench });
  },

  removeBenchPlayer: (index) => {
    const newBench = [...get().bench];
    newBench[index] = null;
    set({ bench: newBench });
  },

  clearSquad: () => set({ slots: Array(11).fill(null), bench: Array(BENCH_SIZE).fill(null), activeSlotIndex: null, captainId: null }),

  setCaptain: (playerId) => set({ captainId: playerId }),

  loadSquad: (formationId, slots) => set({ formationId, slots }),

  saveToSupabase: async () => {
    const { ensureSquadEditable } = await import("../squad/ensure-squad-editable");
    const { supabase, user } = await ensureSquadEditable();

    const state = get();
    const playerIds = state.slots.map((p) => p?.id ?? null);
    const benchIds = state.bench.map((p) => p?.id ?? null);

    const row = {
      user_id: user.id,
      formation: state.formationId,
      player_ids: playerIds,
      bench_ids: benchIds,
      captain_id: state.captainId,
      total_cost: state.totalSpent(),
      updated_at: new Date().toISOString(),
    };

    // Try upsert first
    const { error } = await supabase.from("squads").upsert(row, { onConflict: "user_id" });

    if (error) {
      console.error("[squad-store] upsert failed:", error.message);
      // Fallback: delete existing + insert fresh
      const { error: delError } = await supabase.from("squads").delete().eq("user_id", user.id);
      if (delError) console.error("[squad-store] delete failed:", delError.message);
      const { error: insertError } = await supabase.from("squads").insert(row);
      if (insertError) throw new Error(`Save failed: ${error.message} → ${insertError.message}`);
    }

    // Verify save
    const { data: check } = await supabase
      .from("squads")
      .select("user_id")
      .eq("user_id", user.id)
      .single();
    if (!check) throw new Error("Save appeared to succeed but data was not found");
  },

  loadFromSupabase: async () => {
    const { createClient } = await import("../supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ squadLoaded: true });
      return;
    }

    const { data } = await supabase
      .from("squads")
      .select("formation, player_ids, bench_ids, captain_id")
      .eq("user_id", user.id)
      .single();

    if (!data) {
      set({ squadLoaded: true });
      return;
    }

    const playerIds = (data.player_ids as (string | null)[]) ?? [];
    const benchIds = (data.bench_ids as (string | null)[]) ?? [];
    const slots = playerIds.map((id) => (id ? getPlayerById(id) ?? null : null));
    const bench = benchIds.map((id) => (id ? getPlayerById(id) ?? null : null));
    // Pad bench to BENCH_SIZE
    while (bench.length < BENCH_SIZE) bench.push(null);

    set({ formationId: data.formation, slots, bench, captainId: data.captain_id ?? null, squadLoaded: true });
  },

  totalSpent: () => {
    const state = get();
    const starterCost = state.slots.reduce((sum, p) => sum + (p?.marketValue ?? 0), 0);
    const benchCost = state.bench.reduce((sum, p) => sum + (p?.marketValue ?? 0), 0);
    return starterCost + benchCost;
  },

  budgetRemaining: () => SALARY_CAP - get().totalSpent(),

  filledCount: () => get().slots.filter((p) => p !== null).length,

  benchFilledCount: () => get().bench.filter((p) => p !== null).length,

  totalFilledCount: () => get().filledCount() + get().benchFilledCount(),

  emptySlotCount: () => get().slots.filter((p) => p === null).length,

  avgBudgetPerSlot: () => {
    const totalEmpty = get().emptySlotCount() + get().bench.filter((p) => p === null).length;
    if (totalEmpty === 0) return 0;
    return Math.round(get().budgetRemaining() / totalEmpty);
  },

  positionForSlot: (index) => {
    const formation = getFormation(get().formationId);
    return formation.slots[index]?.position ?? "CM";
  },

  isPlayerInSquad: (playerId) => {
    const state = get();
    return state.slots.some((p) => p?.id === playerId) || state.bench.some((p) => p?.id === playerId);
  },

  canAfford: (player) => {
    return player.marketValue <= get().budgetRemaining();
  },
}));
