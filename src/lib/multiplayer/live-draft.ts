export const LIVE_DRAFT_TOTAL_PICKS = 22;
export const LIVE_DRAFT_PICKS_PER_SIDE = LIVE_DRAFT_TOTAL_PICKS / 2;

export interface DraftPick {
  user_id: string;
  player_id: string;
  pick_number: number;
}

export interface LiveDraftSessionLike {
  user_a: string;
  user_b: string | null;
  current_pick: number;
  current_picker: string | null;
  status: "waiting" | "drafting" | "completed";
  picks: DraftPick[];
}

export interface LiveDraftTransition {
  pick: DraftPick;
  picks: DraftPick[];
  currentPick: number;
  nextPicker: string | null;
  isComplete: boolean;
}

export function pickerForPick(pickNumber: number, userA: string, userB: string): string {
  if (pickNumber <= 1) {
    return userA;
  }

  // Pattern: 1=A, 2-3=B, 4-5=A, 6-7=B...
  const pairIndexFromPickTwo = Math.floor((pickNumber - 2) / 2);
  return pairIndexFromPickTwo % 2 === 0 ? userB : userA;
}

export function nextPickerAfter(pickNumber: number, userA: string, userB: string): string | null {
  const nextPick = pickNumber + 1;
  if (nextPick > LIVE_DRAFT_TOTAL_PICKS) {
    return null;
  }

  return pickerForPick(nextPick, userA, userB);
}

export function applyLiveDraftPick(
  draft: LiveDraftSessionLike,
  pickerId: string,
  playerId: string,
): LiveDraftTransition {
  if (draft.status !== "drafting") {
    throw new Error("Draft is not active");
  }

  if (!draft.user_b) {
    throw new Error("Draft opponent is missing");
  }

  if (draft.current_picker !== pickerId) {
    throw new Error("Not your turn");
  }

  if (draft.current_pick > LIVE_DRAFT_TOTAL_PICKS) {
    throw new Error("Draft is already complete");
  }

  const pick: DraftPick = {
    user_id: pickerId,
    player_id: playerId,
    pick_number: draft.current_pick,
  };
  const picks = [...draft.picks, pick];
  const isComplete = pick.pick_number >= LIVE_DRAFT_TOTAL_PICKS;
  const currentPick = draft.current_pick + 1;
  const nextPicker = isComplete ? null : nextPickerAfter(pick.pick_number, draft.user_a, draft.user_b);

  return {
    pick,
    picks,
    currentPick,
    nextPicker,
    isComplete,
  };
}

export function splitDraftedSides(
  picks: DraftPick[],
  userA: string,
  userB: string,
): { homeStarterIds: string[]; awayStarterIds: string[] } {
  const ordered = [...picks].sort((left, right) => left.pick_number - right.pick_number);
  const homeStarterIds = ordered.filter((pick) => pick.user_id === userA).map((pick) => pick.player_id);
  const awayStarterIds = ordered.filter((pick) => pick.user_id === userB).map((pick) => pick.player_id);

  return { homeStarterIds, awayStarterIds };
}
