import { describe, expect, it } from "vitest";
import {
  evaluateRankedReadiness,
  makeCompetitiveError,
  RANKED_MIN_STARTERS,
} from "./competitive-flow";

describe("competitive flow readiness", () => {
  it("requires full local lineup first", () => {
    const readiness = evaluateRankedReadiness({
      localFilledCount: RANKED_MIN_STARTERS - 1,
      savedStarterCount: RANKED_MIN_STARTERS,
      hasTactics: true,
      squadLocked: true,
    });

    expect(readiness.isReady).toBe(false);
    expect(readiness.code).toBe("missing_local_players");
  });

  it("requires saved starters and tactics before squad lock check", () => {
    const noSavedSquad = evaluateRankedReadiness({
      localFilledCount: RANKED_MIN_STARTERS,
      savedStarterCount: 9,
      hasTactics: true,
      squadLocked: true,
    });
    expect(noSavedSquad.code).toBe("missing_saved_squad");

    const noTactics = evaluateRankedReadiness({
      localFilledCount: RANKED_MIN_STARTERS,
      savedStarterCount: RANKED_MIN_STARTERS,
      hasTactics: false,
      squadLocked: true,
    });
    expect(noTactics.code).toBe("missing_tactics");
  });

  it("is ready only when all ranked prerequisites are met", () => {
    const readiness = evaluateRankedReadiness({
      localFilledCount: RANKED_MIN_STARTERS,
      savedStarterCount: RANKED_MIN_STARTERS,
      hasTactics: true,
      squadLocked: true,
    });

    expect(readiness).toEqual({
      isReady: true,
      code: "ready",
      message: "Climb the divisions",
    });
  });
});

describe("competitive flow errors", () => {
  it("creates machine-readable errors with retry metadata", () => {
    expect(makeCompetitiveError("ALREADY_IN_QUEUE", "Already in queue", true)).toEqual({
      code: "ALREADY_IN_QUEUE",
      message: "Already in queue",
      retryable: true,
    });
  });
});
