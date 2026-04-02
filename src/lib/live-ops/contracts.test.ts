import { describe, expect, it } from "vitest";
import {
  buildLiveOpsEventCards,
  decodeOffsetCursor,
  encodeOffsetCursor,
  getCadenceSnapshot,
  getMissionInsertMetadata,
  sortMissionRows,
} from "./contracts";

describe("live ops contracts", () => {
  it("derives reset times from a shared UTC cadence", () => {
    const cadence = getCadenceSnapshot(new Date("2026-04-02T12:30:00.000Z"));

    expect(cadence.dailyResetAt).toBe("2026-04-03T00:00:00.000Z");
    expect(cadence.weeklyResetAt).toBe("2026-04-05T00:00:00.000Z");
  });

  it("round-trips ladder cursors", () => {
    const cursor = encodeOffsetCursor(24);
    expect(decodeOffsetCursor(cursor)).toBe(24);
    expect(decodeOffsetCursor("invalid")).toBe(0);
  });

  it("prioritizes featured missions and emits dedicated live ops cards", () => {
    const missions = sortMissionRows([
      {
        id: "b",
        mission_type: "daily",
        description: "Win any match",
        target: 1,
        progress: 0,
        reward_coins: 30,
        expires_at: "2026-04-03T00:00:00.000Z",
        claimed: false,
        is_featured: false,
        priority_weight: 40,
      },
      {
        id: "a",
        mission_type: "weekly",
        description: "Win 5 ranked matches",
        target: 5,
        progress: 3,
        reward_coins: 200,
        expires_at: "2026-04-05T00:00:00.000Z",
        claimed: false,
        is_featured: true,
        priority_weight: 70,
      },
    ]);

    expect(missions[0]?.id).toBe("a");

    const cards = buildLiveOpsEventCards({
      now: new Date("2026-04-02T12:30:00.000Z"),
      cadence: getCadenceSnapshot(new Date("2026-04-02T12:30:00.000Z")),
      missions,
      inbox: [],
      news: [],
    });

    expect(cards[0]?.id).toBe("mission-a");
    expect(cards.some((card) => card.id === "ranked-queue")).toBe(true);
  });

  it("assigns consistent mission metadata at insert time", () => {
    expect(getMissionInsertMetadata("weekly", "win_5_ranked", 0)).toEqual({
      is_featured: true,
      recommended_mode: "ranked",
      priority_weight: 70,
    });
  });
});
