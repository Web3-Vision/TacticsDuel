import { describe, expect, it } from "vitest";

import {
  applyLiveDraftPick,
  LIVE_DRAFT_TOTAL_PICKS,
  pickerForPick,
  splitDraftedSides,
} from "./live-draft";

describe("live-draft helpers", () => {
  it("uses deterministic snake order", () => {
    const userA = "user-a";
    const userB = "user-b";
    const sequence = Array.from({ length: 8 }, (_, idx) => pickerForPick(idx + 1, userA, userB));
    expect(sequence).toEqual([userA, userB, userB, userA, userA, userB, userB, userA]);
  });

  it("transitions to completed on final pick", () => {
    const userA = "user-a";
    const userB = "user-b";
    const picks = Array.from({ length: LIVE_DRAFT_TOTAL_PICKS - 1 }, (_, index) => ({
      user_id: pickerForPick(index + 1, userA, userB),
      player_id: `p-${index + 1}`,
      pick_number: index + 1,
    }));
    const draft = {
      user_a: userA,
      user_b: userB,
      current_pick: LIVE_DRAFT_TOTAL_PICKS,
      current_picker: pickerForPick(LIVE_DRAFT_TOTAL_PICKS, userA, userB),
      status: "drafting" as const,
      picks,
    };

    const result = applyLiveDraftPick(draft, draft.current_picker, "p-22");
    expect(result.isComplete).toBe(true);
    expect(result.nextPicker).toBeNull();
    expect(result.picks).toHaveLength(LIVE_DRAFT_TOTAL_PICKS);
  });

  it("rejects out-of-turn picks", () => {
    const draft = {
      user_a: "user-a",
      user_b: "user-b",
      current_pick: 1,
      current_picker: "user-a",
      status: "drafting" as const,
      picks: [],
    };

    expect(() => applyLiveDraftPick(draft, "user-b", "p-1")).toThrow("Not your turn");
  });

  it("splits picks into both drafted squads", () => {
    const picks = [
      { user_id: "a", player_id: "1", pick_number: 1 },
      { user_id: "b", player_id: "2", pick_number: 2 },
      { user_id: "b", player_id: "3", pick_number: 3 },
      { user_id: "a", player_id: "4", pick_number: 4 },
    ];

    expect(splitDraftedSides(picks, "a", "b")).toEqual({
      homeStarterIds: ["1", "4"],
      awayStarterIds: ["2", "3"],
    });
  });
});
