import { describe, expect, it } from "vitest";
import { computeRankedProgression } from "./progression";

describe("computeRankedProgression", () => {
  const baseProfile = {
    division: 10,
    division_points: 27,
    division_season: 3,
    division_wins: 6,
    division_draws: 1,
    division_losses: 2,
    division_matches_played: 9,
    ranked_matches_in_cycle: 4,
    squad_locked: true,
    transfers_remaining: 0,
    wins: 20,
    draws: 5,
    losses: 11,
    current_streak: 2,
    best_streak: 4,
  } as const;

  it("resets the season and emits a reward grant on promotion", () => {
    const result = computeRankedProgression(baseProfile, "win", 3, "2026-04-02T20:00:00.000Z");

    expect(result.patch.division).toBe(9);
    expect(result.patch.division_points).toBe(0);
    expect(result.patch.division_season).toBe(4);
    expect(result.patch.division_matches_played).toBe(0);
    expect(result.patch.ranked_matches_in_cycle).toBe(0);
    expect(result.patch.squad_locked).toBe(false);
    expect(result.seasonReward).toEqual({
      season: 3,
      highestDivision: 10,
      coinsEarned: 100,
    });
  });

  it("relegates without creating a reward when the season ends at zero points", () => {
    const result = computeRankedProgression(
      {
        ...baseProfile,
        division: 7,
        division_points: 1,
      },
      "loss",
      -2,
      "2026-04-02T20:00:00.000Z",
    );

    expect(result.patch.division).toBe(8);
    expect(result.patch.division_points).toBe(0);
    expect(result.patch.division_season).toBe(4);
    expect(result.seasonReward).toBeNull();
  });
});
