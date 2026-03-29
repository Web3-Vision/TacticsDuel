import { create } from "zustand";
import type { Player, Position } from "../types";
import { SALARY_CAP } from "../utils";
import { getFormation } from "../data/formations";

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
