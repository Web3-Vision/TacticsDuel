import { describe, expect, it } from "vitest";
import {
  evaluateSquadLockState,
  getSquadLockTransitionError,
} from "./squad-lock";

describe("squad lock rules", () => {
  it("requires a saved starting eleven before locking", () => {
    const state = evaluateSquadLockState({
      savedStarterCount: 10,
      hasTactics: true,
      squadLocked: false,
      rankedMatchesInCycle: 0,
    });

    expect(state.canLock).toBe(false);
    expect(state.reason).toContain("10/11");
  });

  it("requires tactics before locking", () => {
    const state = evaluateSquadLockState({
      savedStarterCount: 11,
      hasTactics: false,
      squadLocked: false,
      rankedMatchesInCycle: 0,
    });

    expect(state.canLock).toBe(false);
    expect(state.reason).toBe("Save your tactics before locking the squad.");
  });

  it("allows locking when the squad is ready", () => {
    const state = evaluateSquadLockState({
      savedStarterCount: 11,
      hasTactics: true,
      squadLocked: false,
      rankedMatchesInCycle: 0,
    });

    expect(state).toEqual({
      canLock: true,
      canUnlock: false,
      reason: "Squad is ready to lock for ranked matches.",
    });
  });

  it("allows unlocking only before a ranked cycle starts", () => {
    const beforeKickoff = evaluateSquadLockState({
      savedStarterCount: 11,
      hasTactics: true,
      squadLocked: true,
      rankedMatchesInCycle: 0,
    });
    expect(beforeKickoff.canUnlock).toBe(true);

    const afterKickoff = getSquadLockTransitionError(
      {
        savedStarterCount: 11,
        hasTactics: true,
        squadLocked: true,
        rankedMatchesInCycle: 1,
      },
      false,
    );
    expect(afterKickoff).toBe("Squad stays locked until the current ranked cycle is finished.");
  });
});
