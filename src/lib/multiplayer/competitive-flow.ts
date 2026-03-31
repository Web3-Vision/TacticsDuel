export const RANKED_MIN_STARTERS = 11;

export type RankedReadinessCode =
  | "ready"
  | "missing_local_players"
  | "missing_saved_squad"
  | "missing_tactics"
  | "squad_unlocked";

export interface RankedReadinessInput {
  localFilledCount: number;
  savedStarterCount: number;
  hasTactics: boolean;
  squadLocked: boolean;
}

export interface RankedReadiness {
  isReady: boolean;
  code: RankedReadinessCode;
  message: string;
}

export function evaluateRankedReadiness(input: RankedReadinessInput): RankedReadiness {
  if (input.localFilledCount < RANKED_MIN_STARTERS) {
    return {
      isReady: false,
      code: "missing_local_players",
      message: `Need ${RANKED_MIN_STARTERS} players (${input.localFilledCount}/${RANKED_MIN_STARTERS})`,
    };
  }

  if (input.savedStarterCount < RANKED_MIN_STARTERS) {
    return {
      isReady: false,
      code: "missing_saved_squad",
      message: "Save your squad first",
    };
  }

  if (!input.hasTactics) {
    return {
      isReady: false,
      code: "missing_tactics",
      message: "Save your tactics first",
    };
  }

  if (!input.squadLocked) {
    return {
      isReady: false,
      code: "squad_unlocked",
      message: "Lock squad for ranked first",
    };
  }

  return {
    isReady: true,
    code: "ready",
    message: "Climb the divisions",
  };
}

export type QueueJoinStatus = "queued" | "match_found";
export type QueuePollStatus = "searching" | "match_found" | "not_in_queue";

export type InviteCreateStatus = "invite_created";
export type InviteLookupStatus = "invite_ready";
export type InviteAcceptStatus = "match_ready" | "draft_ready";

export type CompetitiveErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_MODE"
  | "INVALID_INVITE_CODE"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_ALREADY_HANDLED"
  | "INVITE_SELF_ACCEPT"
  | "PROFILE_NOT_FOUND"
  | "SQUAD_NOT_READY"
  | "TACTICS_NOT_READY"
  | "SQUAD_NOT_LOCKED"
  | "ALREADY_IN_QUEUE"
  | "QUEUE_INSERT_FAILED"
  | "MATCH_CREATE_FAILED"
  | "INTERNAL_ERROR";

export interface CompetitiveError {
  code: CompetitiveErrorCode;
  message: string;
  retryable: boolean;
}

export function makeCompetitiveError(
  code: CompetitiveErrorCode,
  message: string,
  retryable = false,
): CompetitiveError {
  return { code, message, retryable };
}
