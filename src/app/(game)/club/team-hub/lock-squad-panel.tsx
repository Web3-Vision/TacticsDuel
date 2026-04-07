"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { evaluateSquadLockState } from "@/lib/squad/squad-lock";

interface LockSquadPanelProps {
  squadLocked: boolean;
  savedStarterCount: number;
  hasTactics: boolean;
  rankedMatchesInCycle: number;
}

export default function LockSquadPanel({
  squadLocked,
  savedStarterCount,
  hasTactics,
  rankedMatchesInCycle,
}: LockSquadPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const lockState = useMemo(
    () =>
      evaluateSquadLockState({
        savedStarterCount,
        hasTactics,
        squadLocked,
        rankedMatchesInCycle,
      }),
    [hasTactics, rankedMatchesInCycle, savedStarterCount, squadLocked],
  );

  const nextLocked = !squadLocked;
  const actionDisabled = pending || (squadLocked ? !lockState.canUnlock : !lockState.canLock);

  async function handleToggle() {
    if (actionDisabled) {
      return;
    }

    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squad_locked: nextLocked }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update squad lock");
      }

      setSuccess(nextLocked ? "Squad locked for ranked matches." : "Squad unlocked. You can edit again.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update squad lock");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/65 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
            Ranked Lock
          </p>
          <p className="font-mono text-xs text-text">
            {lockState.reason}
          </p>
          <p className="font-mono text-[10px] text-text-dim">
            Saved starters: {savedStarterCount}/11 {hasTactics ? "• tactics saved" : "• tactics not saved"}
          </p>
          {error && <p className="font-mono text-[10px] text-danger">{error}</p>}
          {success && <p className="font-mono text-[10px] text-accent">{success}</p>}
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={actionDisabled}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-accent bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition-colors duration-150 hover:bg-accent-dim disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-dim"
        >
          {squadLocked ? <Unlock size={13} strokeWidth={1.8} /> : <Lock size={13} strokeWidth={1.8} />}
          {pending ? "Saving..." : squadLocked ? "Unlock Squad" : "Lock Squad"}
        </button>
      </div>
    </div>
  );
}
