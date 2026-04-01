import { describe, expect, it } from "vitest";

import {
  STARTER_SLOT_COUNT,
  countSavedStarters,
  normalizePersistedSlotIds,
  resolveStarterIdsFromMatchSquad,
} from "./persisted-squad";

describe("persisted-squad helpers", () => {
  it("normalizes non-array slot payloads to empty slots", () => {
    expect(normalizePersistedSlotIds(null, 4)).toEqual([null, null, null, null]);
  });

  it("counts only non-empty starter ids", () => {
    const starterIds = ["a", " ", null, "b", undefined, "c"];
    expect(countSavedStarters({ player_ids: starterIds })).toBe(3);
  });

  it("resolves starter ids from new persisted row payload", () => {
    const starterIds = Array.from({ length: STARTER_SLOT_COUNT }, (_, index) => `p-${index + 1}`);
    const ids = resolveStarterIdsFromMatchSquad([{ player_ids: starterIds }]);
    expect(ids).toEqual(starterIds);
  });

  it("resolves starter ids from legacy row-per-player payload", () => {
    const ids = resolveStarterIdsFromMatchSquad([{ player_id: "x" }, { player_id: "y" }]);
    expect(ids).toEqual(["x", "y"]);
  });
});
