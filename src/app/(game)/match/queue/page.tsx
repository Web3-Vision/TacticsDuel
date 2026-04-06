"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMatchStore } from "@/lib/stores/match-store";
import { Loader2, Swords, AlertCircle } from "lucide-react";

type QueueState = "idle" | "joining" | "searching" | "found" | "simulating" | "error";

export default function QueuePage() {
  const router = useRouter();
  const loadMatch = useMatchStore((s) => s.loadMatch);
  const [state, setState] = useState<QueueState>("idle");
  const [waitTime, setWaitTime] = useState(0);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function viewMatch(matchId: string, liveMultiplayer: boolean) {
    if (liveMultiplayer) {
      router.push(`/matchday?matchId=${encodeURIComponent(matchId)}`);
      return;
    }

    await simulateAndView(matchId);
  }

  async function joinQueue() {
    setError("");
    setState("joining");
    try {
      const res = await fetch("/api/match/queue", { method: "POST" });
      const data = await res.json();

      if (data.status === "match_found" && data.matchId) {
        setState("found");
        await viewMatch(data.matchId, Boolean(data.liveMultiplayer));
        return;
      }

      if (data.status === "queued") {
        setState("searching");
        startPolling();
      } else {
        setError(data.error?.message || data.error || "Failed to join queue");
        setState("error");
      }
    } catch {
      setError("Network error");
      setState("error");
    }
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/match/queue");
        const data = await res.json();

        if (data.status === "match_found" && data.matchId) {
          clearInterval(pollRef.current!);
          setState("found");
          await viewMatch(data.matchId, Boolean(data.liveMultiplayer));
          return;
        }

        setWaitTime(data.waitTime || 0);

        if (data.status === "not_in_queue" || !data.inQueue) {
          clearInterval(pollRef.current!);
          setState("idle");
        }
      } catch {
        // Retry on next interval
      }
    }, 4000);
  }

  async function simulateAndView(matchId: string) {
    setState("simulating");
    try {
      const res = await fetch("/api/match/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Simulation failed");
        setState("error");
        return;
      }

      // Load match result into store
      loadMatch(
        {
          events: data.result.events,
          homeScore: data.result.homeScore,
          awayScore: data.result.awayScore,
          stats: data.result.stats,
          playerRatings: data.result.playerRatings ?? {},
          manOfTheMatch: data.result.manOfTheMatch ?? "",
        },
        "Your Team",
        "Opponent"
      );

      // Store match metadata for post-match display
      if (typeof window !== "undefined") {
        sessionStorage.setItem("lastRankedMatch", JSON.stringify({
          matchId,
          matchType: "ranked",
          homeEloChange: data.result.homeEloChange,
          awayEloChange: data.result.awayEloChange,
          homeDivPointsChange: data.result.homeDivPointsChange,
          awayDivPointsChange: data.result.awayDivPointsChange,
        }));
      }

      router.push("/match/live");
    } catch {
      setError("Failed to simulate match");
      setState("error");
    }
  }

  async function leaveQueue() {
    if (pollRef.current) clearInterval(pollRef.current);
    await fetch("/api/match/queue", { method: "DELETE" });
    setState("idle");
    setWaitTime(0);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {state === "idle" && (
        <>
          <Swords size={32} strokeWidth={1.5} className="text-accent" />
          <p className="font-mono text-lg uppercase tracking-wide">
            Ranked Match
          </p>
          <button
            onClick={joinQueue}
            className="w-full max-w-[280px] h-12 bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
          >
            Find Match
          </button>
        </>
      )}

      {state === "joining" && (
        <>
          <Loader2 size={32} strokeWidth={1.5} className="text-accent animate-spin" />
          <p className="font-mono text-sm text-text-dim uppercase tracking-wide">
            Joining queue...
          </p>
        </>
      )}

      {state === "searching" && (
        <>
          <Loader2 size={32} strokeWidth={1.5} className="text-accent animate-spin" />
          <div className="text-center">
            <p className="font-mono text-lg uppercase tracking-wide">
              Searching for opponent
            </p>
            <p className="font-mono text-xs text-text-dim mt-2 tabular-nums">
              {waitTime}s elapsed
            </p>
            {waitTime >= 20 && (
              <p className="font-mono text-[10px] text-text-dim mt-1">
                Expanding search range...
              </p>
            )}
          </div>
          <button
            onClick={leaveQueue}
            className="h-10 px-6 border border-border text-text-dim font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
          >
            Cancel
          </button>
        </>
      )}

      {state === "found" && (
        <>
          <Swords size={32} strokeWidth={1.5} className="text-accent" />
          <p className="font-mono text-lg uppercase tracking-wide text-accent">
            Opponent Found!
          </p>
          <p className="font-mono text-xs text-text-dim">
            Preparing match...
          </p>
        </>
      )}

      {state === "simulating" && (
        <>
          <Loader2 size={32} strokeWidth={1.5} className="text-accent animate-spin" />
          <p className="font-mono text-sm text-text-dim uppercase tracking-wide">
            Simulating match...
          </p>
        </>
      )}

      {state === "error" && (
        <>
          <AlertCircle size={32} strokeWidth={1.5} className="text-danger" />
          <p className="text-danger text-xs font-mono text-center">{error}</p>
          <button
            onClick={() => { setState("idle"); setError(""); }}
            className="h-10 px-6 border border-border text-text-mid font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
          >
            Try Again
          </button>
        </>
      )}
    </div>
  );
}
