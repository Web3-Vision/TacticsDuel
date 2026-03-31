import { describe, expect, it } from "vitest";
import {
  BENCH_SLOTS,
  STARTER_SLOTS,
  calculateAskPriceRange,
  hasPlayerInSquad,
  transferPlayerBetweenSquads,
  validateAskPrice,
  type SquadRow,
} from "./transfer-market";
import { getPlayerById } from "./data/players";

function makeSquad(userId: string, starterIds: Array<string | null>, benchIds: Array<string | null>): SquadRow {
  return {
    user_id: userId,
    formation: "4-3-3",
    player_ids: starterIds,
    bench_ids: benchIds,
    captain_id: null,
    total_cost: 0,
  };
}

describe("transfer-market helpers", () => {
  it("returns a bounded ask range from market value", () => {
    const range = calculateAskPriceRange(1200);
    expect(range.min).toBe(600);
    expect(range.max).toBe(3600);
  });

  it("validates ask price against known player value", () => {
    const player = getPlayerById("courtois_01");
    if (!player) {
      throw new Error("Expected fixture player to exist");
    }
    const range = calculateAskPriceRange(player.marketValue);
    const valid = validateAskPrice("courtois_01", range.min);
    expect(valid.ok).toBe(true);

    const invalid = validateAskPrice("courtois_01", 1);
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toContain("askPrice");
  });

  it("detects player ownership in squad", () => {
    const starters = Array(STARTER_SLOTS).fill(null);
    const bench = Array(BENCH_SLOTS).fill(null);
    starters[0] = "courtois_01";

    const squad = makeSquad("seller", starters, bench);
    expect(hasPlayerInSquad(squad, "courtois_01")).toBe(true);
    expect(hasPlayerInSquad(squad, "alisson_01")).toBe(false);
  });

  it("moves sold player from seller to buyer bench when space exists", () => {
    const sellerStarters = Array(STARTER_SLOTS).fill(null);
    const sellerBench = Array(BENCH_SLOTS).fill(null);
    const buyerStarters = Array(STARTER_SLOTS).fill(null);
    const buyerBench = Array(BENCH_SLOTS).fill(null);

    sellerStarters[0] = "courtois_01";

    const result = transferPlayerBetweenSquads(
      makeSquad("seller", sellerStarters, sellerBench),
      makeSquad("buyer", buyerStarters, buyerBench),
      "courtois_01",
    );

    expect(result.ok).toBe(true);
    expect(result.sellerPlayerIds?.includes("courtois_01")).toBe(false);
    expect(result.buyerBenchIds?.includes("courtois_01")).toBe(true);
  });

  it("fails transfer if buyer has no available squad slot", () => {
    const sellerStarters = Array(STARTER_SLOTS).fill(null);
    const sellerBench = Array(BENCH_SLOTS).fill(null);
    const buyerStarters = Array(STARTER_SLOTS).fill("alisson_01");
    const buyerBench = Array(BENCH_SLOTS).fill("oblak_01");

    sellerBench[0] = "courtois_01";

    const result = transferPlayerBetweenSquads(
      makeSquad("seller", sellerStarters, sellerBench),
      makeSquad("buyer", buyerStarters, buyerBench),
      "courtois_01",
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("no empty slot");
  });
});
