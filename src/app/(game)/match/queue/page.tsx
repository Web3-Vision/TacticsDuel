"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function QueuePage() {
  const router = useRouter();
  const [inQueue, setInQueue] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function joinQueue() {
    setError("");
    try {
      const res = await fetch("/api/match/queue", { method: "POST" });
      const data = await res.json();

      if (data.matchFound) {
        router.push(`/match/${data.matchId}`);
        return;
      }

      if (data.queued) {
        setInQueue(true);
        startPolling();
      } else {
        setError(data.error || "Failed to join queue");
      }
    } catch {
      setError("Network error");
    }
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/match/queue");
        const data = await res.json();

        if (data.matchFound) {
          clearInterval(pollRef.current!);
          router.push(`/match/${data.matchId}`);
          return;
        }

        setWaitTime(data.waitTime || 0);

        if (!data.inQueue) {
          clearInterval(pollRef.current!);
          setInQueue(false);
        }
      } catch {
        // Retry on next interval
      }
    }, 5000);
  }

  async function leaveQueue() {
    if (pollRef.current) clearInterval(pollRef.current);
    await fetch("/api/match/queue", { method: "DELETE" });
    setInQueue(false);
    setWaitTime(0);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {inQueue ? (
        <>
          <Loader2
            size={32}
            strokeWidth={1.5}
            className="text-accent animate-spin"
          />
          <div className="text-center">
            <p className="font-mono text-lg uppercase tracking-wide">
              Searching for opponent
            </p>
            <p className="font-mono text-xs text-text-dim mt-2 tabular-nums">
              {waitTime}s elapsed
            </p>
          </div>
          <button
            onClick={leaveQueue}
            className="h-10 px-6 border border-border text-text-dim font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="font-mono text-lg uppercase tracking-wide">
            Ranked Match
          </p>
          <button
            onClick={joinQueue}
            className="w-full max-w-[280px] h-12 bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
          >
            Find Match
          </button>
          {error && (
            <p className="text-danger text-xs font-mono">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
