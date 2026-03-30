import { create } from "zustand";
import type { Player, Position } from "../types";
import { SALARY_CAP } from "../utils";
import { getFormation } from "../data/formations";
import { getPlayerById } from "../data/players";

interface SquadState {
  formationId: string;
  slots: (Player | null)[];
  activeSlotIndex: number | null;

  setFormation: (id: string) => void;
  setActiveSlot: (index: number | null) => void;
  addPlayer: (slotIndex: number, player: Player) => void;
  removePlayer: (slotIndex: number) => void;
  clearSquad: () => void;
  loadSquad: (formationId: string, slots: (Player | null)[]) => void;
  saveToSupabase: () => Promise<void>;
  loadFromSupabase: () => Promise<void>;

  // Derived
  totalSpent: () => number;
  budgetRemaining: () => number;
  filledCount: () => number;
  emptySlotCount: () => number;
  avgBudgetPerSlot: () => number;
  positionForSlot: (index: number) => Position;
  isPlayerInSquad: (playerId: string) => boolean;
  canAfford: (player: Player) => boolean;
}

export const useSquadStore = create<SquadState>((set, get) => ({
  formationId: "4-3-3",
  slots: Array(11).fill(null),
  activeSlotIndex: null,

  setFormation: (id) => {
    set({ formationId: id, slots: Array(11).fill(null), activeSlotIndex: null });
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

  clearSquad: () => set({ slots: Array(11).fill(null), activeSlotIndex: null }),

  loadSquad: (formationId, slots) => set({ formationId, slots }),

  saveToSupabase: async () => {
    const { createClient } = await import("../supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const state = get();
    const playerIds = state.slots.map((p) => p?.id ?? null);

    await supabase.from("squads").upsert({
      user_id: user.id,
      formation: state.formationId,
      player_ids: playerIds,
      total_cost: state.totalSpent(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  },

  loadFromSupabase: async () => {
    const { createClient } = await import("../supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("squads")
      .select("formation, player_ids")
      .eq("user_id", user.id)
      .single();

    if (!data) return;

    const playerIds = data.player_ids as (string | null)[];
    const slots = playerIds.map((id) => (id ? getPlayerById(id) ?? null : null));
    set({ formationId: data.formation, slots });
  },

  totalSpent: () => {
    return get().slots.reduce(
      (sum, p) => sum + (p?.marketValue ?? 0),
      0
    );
  },

  budgetRemaining: () => SALARY_CAP - get().totalSpent(),

  filledCount: () => get().slots.filter((p) => p !== null).length,

  emptySlotCount: () => get().slots.filter((p) => p === null).length,

  avgBudgetPerSlot: () => {
    const empty = get().emptySlotCount();
    if (empty === 0) return 0;
    return Math.round(get().budgetRemaining() / empty);
  },

  positionForSlot: (index) => {
    const formation = getFormation(get().formationId);
    return formation.slots[index]?.position ?? "CM";
  },

  isPlayerInSquad: (playerId) => {
    return get().slots.some((p) => p?.id === playerId);
  },

  canAfford: (player) => {
    return player.marketValue <= get().budgetRemaining();
  },
}));
