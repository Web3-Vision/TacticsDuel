import { RANKED_MIN_STARTERS } from "../multiplayer/competitive-flow";

export interface SquadLockContext {
  savedStarterCount: number;
  hasTactics: boolean;
  squadLocked: boolean;
  rankedMatchesInCycle: number;
}

export interface SquadLockState {
  canLock: boolean;
  canUnlock: boolean;
  reason: string;
}

export function evaluateSquadLockState(context: SquadLockContext): SquadLockState {
  if (context.squadLocked) {
    if (context.rankedMatchesInCycle > 0) {
      return {
        canLock: false,
        canUnlock: false,
        reason: "Squad stays locked until the current ranked cycle is finished.",
      };
    }

    return {
      canLock: false,
      canUnlock: true,
      reason: "Squad is locked. Unlock it first if you still want to make changes.",
    };
  }

  if (context.savedStarterCount < RANKED_MIN_STARTERS) {
    return {
      canLock: false,
      canUnlock: false,
      reason: `Save a full starting XI first (${context.savedStarterCount}/${RANKED_MIN_STARTERS}).`,
    };
  }

  if (!context.hasTactics) {
    return {
      canLock: false,
      canUnlock: false,
      reason: "Save your tactics before locking the squad.",
    };
  }

  return {
    canLock: true,
    canUnlock: false,
    reason: "Squad is ready to lock for ranked matches.",
  };
}

export function getSquadLockTransitionError(
  context: SquadLockContext,
  nextLocked: boolean,
): string | null {
  const state = evaluateSquadLockState(context);

  if (nextLocked) {
    return state.canLock ? null : state.reason;
  }

  if (!context.squadLocked) {
    return null;
  }

  return state.canUnlock ? null : state.reason;
}
