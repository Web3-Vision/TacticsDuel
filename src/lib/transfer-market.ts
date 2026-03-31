import { getPlayerById } from "./data/players";

export const STARTER_SLOTS = 11;
export const BENCH_SLOTS = 10;

export interface SquadRow {
  user_id: string;
  formation: string;
  player_ids: Array<string | null> | null;
  bench_ids: Array<string | null> | null;
  captain_id: string | null;
  total_cost: number;
}

export interface ListingPriceRange {
  min: number;
  max: number;
}

export interface AskPriceValidation {
  ok: boolean;
  reason?: string;
  range?: ListingPriceRange;
}

export interface TransferResult {
  ok: boolean;
  reason?: string;
  sellerPlayerIds?: Array<string | null>;
  sellerBenchIds?: Array<string | null>;
  buyerPlayerIds?: Array<string | null>;
  buyerBenchIds?: Array<string | null>;
}

export function calculateAskPriceRange(marketValue: number): ListingPriceRange {
  const min = Math.max(50, Math.floor(marketValue * 0.5));
  const max = Math.max(min, Math.ceil(marketValue * 3));
  return { min, max };
}

export function validateAskPrice(playerId: string, askPrice: number): AskPriceValidation {
  const player = getPlayerById(playerId);
  if (!player) {
    return { ok: false, reason: "Unknown player" };
  }

  if (!Number.isInteger(askPrice) || askPrice <= 0) {
    return { ok: false, reason: "askPrice must be a positive integer" };
  }

  const range = calculateAskPriceRange(player.marketValue);
  if (askPrice < range.min || askPrice > range.max) {
    return {
      ok: false,
      reason: `askPrice must be within ${range.min}-${range.max}`,
      range,
    };
  }

  return { ok: true, range };
}

export function normalizeSlots(raw: unknown, size: number): Array<string | null> {
  if (!Array.isArray(raw)) {
    return Array(size).fill(null);
  }

  const output: Array<string | null> = Array(size).fill(null);
  for (let i = 0; i < size; i += 1) {
    const value = raw[i];
    output[i] = typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  return output;
}

export function hasPlayerInSquad(squad: SquadRow | null, playerId: string): boolean {
  if (!squad) {
    return false;
  }

  const starters = normalizeSlots(squad.player_ids, STARTER_SLOTS);
  const bench = normalizeSlots(squad.bench_ids, BENCH_SLOTS);
  return starters.includes(playerId) || bench.includes(playerId);
}

function removePlayerFromSlots(slots: Array<string | null>, playerId: string): Array<string | null> {
  return slots.map((entry) => (entry === playerId ? null : entry));
}

function insertPlayerIntoSlots(slots: Array<string | null>, playerId: string): Array<string | null> | null {
  const index = slots.findIndex((entry) => entry === null);
  if (index === -1) {
    return null;
  }

  const next = [...slots];
  next[index] = playerId;
  return next;
}

export function recalcTotalCost(
  starterIds: Array<string | null>,
  benchIds: Array<string | null>,
): number {
  const ids = [...starterIds, ...benchIds].filter((id): id is string => typeof id === "string");
  return ids.reduce((sum, id) => sum + (getPlayerById(id)?.marketValue ?? 0), 0);
}

export function transferPlayerBetweenSquads(
  sellerSquad: SquadRow | null,
  buyerSquad: SquadRow | null,
  playerId: string,
): TransferResult {
  if (!sellerSquad || !buyerSquad) {
    return { ok: false, reason: "Both squads must exist" };
  }

  const sellerStarters = normalizeSlots(sellerSquad.player_ids, STARTER_SLOTS);
  const sellerBench = normalizeSlots(sellerSquad.bench_ids, BENCH_SLOTS);
  const buyerStarters = normalizeSlots(buyerSquad.player_ids, STARTER_SLOTS);
  const buyerBench = normalizeSlots(buyerSquad.bench_ids, BENCH_SLOTS);

  if (!sellerStarters.includes(playerId) && !sellerBench.includes(playerId)) {
    return { ok: false, reason: "Seller does not own player" };
  }

  if (buyerStarters.includes(playerId) || buyerBench.includes(playerId)) {
    return { ok: false, reason: "Buyer already owns player" };
  }

  const nextSellerStarters = removePlayerFromSlots(sellerStarters, playerId);
  const nextSellerBench = removePlayerFromSlots(sellerBench, playerId);

  const buyerBenchWithPlayer = insertPlayerIntoSlots(buyerBench, playerId);
  if (!buyerBenchWithPlayer) {
    const buyerStartersWithPlayer = insertPlayerIntoSlots(buyerStarters, playerId);
    if (!buyerStartersWithPlayer) {
      return { ok: false, reason: "Buyer squad has no empty slot" };
    }

    return {
      ok: true,
      sellerPlayerIds: nextSellerStarters,
      sellerBenchIds: nextSellerBench,
      buyerPlayerIds: buyerStartersWithPlayer,
      buyerBenchIds: buyerBench,
    };
  }

  return {
    ok: true,
    sellerPlayerIds: nextSellerStarters,
    sellerBenchIds: nextSellerBench,
    buyerPlayerIds: buyerStarters,
    buyerBenchIds: buyerBenchWithPlayer,
  };
}
