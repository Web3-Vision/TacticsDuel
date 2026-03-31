import { describe, expect, it } from "vitest";
import {
  beginLineupMutation,
  idleLineupMutationState,
  resolveLineupMutation,
} from "./lineup-mutation-state";

describe("lineup mutation state", () => {
  it("starts idle", () => {
    expect(idleLineupMutationState()).toEqual({ status: "idle", message: "" });
  });

  it("transitions to saving and then saved", () => {
    const saving = beginLineupMutation();
    expect(saving.status).toBe("saving");

    const saved = resolveLineupMutation(true);
    expect(saved).toEqual({ status: "saved", message: "Saved" });
  });

  it("transitions to error with fallback message", () => {
    const failed = resolveLineupMutation(false);
    expect(failed).toEqual({ status: "error", message: "Save failed" });

    const failedWithReason = resolveLineupMutation(false, "Network timeout");
    expect(failedWithReason).toEqual({ status: "error", message: "Network timeout" });
  });
});
