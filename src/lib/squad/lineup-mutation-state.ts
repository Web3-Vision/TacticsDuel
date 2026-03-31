export type LineupMutationStatus = "idle" | "saving" | "saved" | "error";

export interface LineupMutationState {
  status: LineupMutationStatus;
  message: string;
}

export function idleLineupMutationState(): LineupMutationState {
  return { status: "idle", message: "" };
}

export function beginLineupMutation(message = "Saving..."): LineupMutationState {
  return { status: "saving", message };
}

export function resolveLineupMutation(ok: boolean, errorMessage?: string): LineupMutationState {
  if (ok) {
    return { status: "saved", message: "Saved" };
  }

  return {
    status: "error",
    message: errorMessage?.trim() ? errorMessage : "Save failed",
  };
}
