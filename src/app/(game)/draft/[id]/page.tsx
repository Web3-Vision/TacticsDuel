"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PLAYERS } from "@/lib/data/players";
import { cn } from "@/lib/utils";
import type { Player, Position } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface DraftPick {
  user_id: string;
  player_id: string;
  pick_number: number;
}

interface DraftSession {
  id: string;
  user_a: string;
  user_b: string;
  player_pool: string[];
  picks: DraftPick[];
  current_pick: number;
  current_picker: string | null;
  status: "drafting" | "completed" | "cancelled";
}

const TOTAL_PICKS = 22;
const PICK_TIMER_SECONDS = 30;

const POSITIONS: (Position | "ALL")[] = [
  "ALL",
  "GK",
  "CB",
  "LB",
  "RB",
  "CM",
  "LW",
  "RW",
  "ST",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getPlayer(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

function ovrColor(ovr: number): string {
  if (ovr >= 87) return "text-accent";
  if (ovr >= 80) return "text-text";
  return "text-text-mid";
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const draftId = params?.id;

  const [draft, setDraft] = useState<DraftSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPos, setFilterPos] = useState<Position | "ALL">("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [timer, setTimer] = useState(PICK_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supabase = useRef(createClient()).current;

  // ── Fetch user + draft on mount ────────────────────────────────────────

  useEffect(() => {
    if (!draftId) return;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error: fetchError } = await supabase
        .from("draft_sessions")
        .select("*")
        .eq("id", draftId)
        .single();

      if (fetchError || !data) {
        setError("Draft not found");
        setLoading(false);
        return;
      }

      setDraft(data as DraftSession);
      setLoading(false);
    }

    init();
  }, [draftId, supabase]);

  // ── Realtime subscription ──────────────────────────────────────────────

  useEffect(() => {
    if (!draftId) return;

    const channel = supabase
      .channel(`draft-${draftId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "draft_sessions",
          filter: `id=eq.${draftId}`,
        },
        (payload) => {
          setDraft(payload.new as DraftSession);
          setSelectedPlayer(null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftId, supabase]);

  // ── Pick timer ─────────────────────────────────────────────────────────

  const isMyTurn = draft?.current_picker === userId;
  const draftStatus = draft?.status;
  const currentPickNumber = draft?.current_pick;

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (draftStatus !== "drafting") return;

    setTimer(PICK_TIMER_SECONDS);

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPickNumber, draftStatus]);

  // ── Make pick ──────────────────────────────────────────────────────────

  const handlePick = useCallback(async () => {
    if (!selectedPlayer || !draftId || picking || !isMyTurn) return;

    setPicking(true);
    try {
      const res = await fetch("/api/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, playerId: selectedPlayer }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Pick failed");
      }
      setSelectedPlayer(null);
    } catch {
      setError("Network error");
    } finally {
      setPicking(false);
    }
  }, [selectedPlayer, draftId, picking, isMyTurn]);

  // ── Derived state ──────────────────────────────────────────────────────

  const picks = draft?.picks ?? [];
  const pickedIds = new Set(picks.map((p) => p.player_id));

  const myPicks = picks
    .filter((p) => p.user_id === userId)
    .sort((a, b) => a.pick_number - b.pick_number);
  const opponentPicks = picks
    .filter((p) => p.user_id !== userId)
    .sort((a, b) => a.pick_number - b.pick_number);

  const poolPlayers = (draft?.player_pool ?? [])
    .map(getPlayer)
    .filter((p): p is Player => p !== undefined)
    .filter((p) => !pickedIds.has(p.id))
    .filter((p) => filterPos === "ALL" || p.position === filterPos)
    .sort((a, b) => b.overall - a.overall);

  const isComplete = draft?.status === "completed";
  const currentPick = Math.min(draft?.current_pick ?? 1, TOTAL_PICKS);
  const progressPercent = Math.min(100, Math.max(0, (currentPick / TOTAL_PICKS) * 100));
  const picksRemaining = Math.max(0, TOTAL_PICKS - picks.length);
  const myPickSlotsRemaining = Math.max(0, 11 - myPicks.length);
  const opponentPickSlotsRemaining = Math.max(0, 11 - opponentPicks.length);

  // ── Loading / error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
        <div className="h-3 bg-border rounded-sm w-32 animate-pulse" />
        <div className="h-3 bg-border rounded-sm w-48 animate-pulse" />
        <div className="h-3 bg-border rounded-sm w-40 animate-pulse" />
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="font-mono text-sm text-danger">{error}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs uppercase tracking-wide text-text-dim">
            {isComplete ? "Draft Complete" : "Live Draft"}
          </span>
          {!isComplete && (
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                timer <= 10 ? "text-danger" : "text-text-mid"
              )}
            >
              {timer}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="font-mono text-sm text-accent">
              All picks are in!
            </span>
          ) : (
            <span
              className={cn(
                "font-mono text-sm",
                isMyTurn ? "text-accent" : "text-text-mid"
              )}
            >
              {isMyTurn ? "Your pick" : "Opponent picking..."}
            </span>
          )}
          <span className="font-mono text-xs text-text-dim ml-auto tabular-nums">
            Pick {currentPick}/
            {TOTAL_PICKS}
          </span>
        </div>

        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-bg/70">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isMyTurn && !isComplete ? "bg-accent" : "bg-text-mid/70",
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <div className="rounded-sm border border-border bg-bg/65 px-2 py-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wide text-text-dim">Remaining</p>
              <p className="mt-0.5 font-mono text-[11px] text-text tabular-nums">{picksRemaining}</p>
            </div>
            <div className="rounded-sm border border-border bg-bg/65 px-2 py-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wide text-text-dim">Your Slots</p>
              <p className="mt-0.5 font-mono text-[11px] text-accent tabular-nums">{myPickSlotsRemaining}</p>
            </div>
            <div className="rounded-sm border border-border bg-bg/65 px-2 py-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wide text-text-dim">Opp Slots</p>
              <p className="mt-0.5 font-mono text-[11px] text-text tabular-nums">{opponentPickSlotsRemaining}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/10 border-b border-danger/20">
          <p className="font-mono text-xs text-danger">{error}</p>
        </div>
      )}

      {/* Pick rows */}
      <div className="border-b border-border bg-surface">
        {/* My picks */}
        <div className="px-4 py-2 border-b border-border">
          <span className="font-mono text-[11px] uppercase tracking-wide text-accent mb-1 block">
            My Picks ({myPicks.length}/11)
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {myPicks.map((pick) => {
              const player = getPlayer(pick.player_id);
              if (!player) return null;
              return (
                <div
                  key={pick.player_id}
                  className="shrink-0 flex items-center gap-1.5 h-8 px-2 border border-border rounded-[4px] bg-bg"
                >
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold tabular-nums",
                      ovrColor(player.overall)
                    )}
                  >
                    {player.overall}
                  </span>
                  <span className="font-mono text-[10px] text-text-dim">
                    {player.position}
                  </span>
                  <span className="font-mono text-[11px] text-text truncate max-w-[80px]">
                    {player.name}
                  </span>
                </div>
              );
            })}
            {myPicks.length === 0 && (
              <span className="font-mono text-[11px] text-text-dim">
                No picks yet
              </span>
            )}
          </div>
        </div>

        {/* Opponent picks */}
        <div className="px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-text-dim mb-1 block">
            Opponent ({opponentPicks.length}/11)
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {opponentPicks.map((pick) => {
              const player = getPlayer(pick.player_id);
              if (!player) return null;
              return (
                <div
                  key={pick.player_id}
                  className="shrink-0 flex items-center gap-1.5 h-8 px-2 border border-border rounded-[4px] bg-bg"
                >
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold tabular-nums",
                      ovrColor(player.overall)
                    )}
                  >
                    {player.overall}
                  </span>
                  <span className="font-mono text-[10px] text-text-dim">
                    {player.position}
                  </span>
                  <span className="font-mono text-[11px] text-text truncate max-w-[80px]">
                    {player.name}
                  </span>
                </div>
              );
            })}
            {opponentPicks.length === 0 && (
              <span className="font-mono text-[11px] text-text-dim">
                No picks yet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Position filter */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-border bg-surface">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setFilterPos(pos)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
              filterPos === pos
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light"
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Available pool */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {poolPlayers.length === 0 ? (
          <div className="p-4">
            <span className="font-mono text-xs text-text-dim">
              No players available
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {poolPlayers.map((player) => {
              const isSelected = selectedPlayer === player.id;
              return (
                <button
                  key={player.id}
                  onClick={() =>
                    setSelectedPlayer(isSelected ? null : player.id)
                  }
                  disabled={!isMyTurn || isComplete}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-left transition-colors duration-100",
                    isSelected
                      ? "bg-accent/10 border-l-2 border-l-accent"
                      : "border-l-2 border-l-transparent",
                    isMyTurn && !isComplete
                      ? "hover:bg-surface-alt active:bg-surface-alt"
                      : "opacity-60"
                  )}
                >
                  {/* OVR */}
                  <span
                    className={cn(
                      "font-mono text-sm font-bold tabular-nums w-7 text-center",
                      ovrColor(player.overall)
                    )}
                  >
                    {player.overall}
                  </span>

                  {/* Position badge */}
                  <span className="font-mono text-[10px] text-text-dim uppercase w-6 text-center">
                    {player.position}
                  </span>

                  {/* Name + club */}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm text-text block truncate">
                      {player.name}
                    </span>
                    <span className="font-mono text-[10px] text-text-dim block truncate">
                      {player.club}
                    </span>
                  </div>

                  {/* Nationality */}
                  <span className="text-sm shrink-0">{player.nationality}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pick action bar */}
      <div className="sticky bottom-0 bg-surface border-t border-border px-4 py-3 pb-safe">
        {!isComplete && (
          <p
            className={cn(
              "mb-2 font-mono text-[10px]",
              isMyTurn ? "text-accent" : "text-text-dim",
            )}
          >
            {isMyTurn
              ? "You are on the clock. Select your player before the timer expires."
              : "Opponent is picking. Review options and pre-select your next target."}
          </p>
        )}
        {isComplete ? (
          <div className="flex items-center justify-center h-11">
            <span className="font-mono text-sm text-accent">
              Draft complete — {myPicks.length} players drafted
            </span>
          </div>
        ) : (
          <button
            onClick={handlePick}
            disabled={!selectedPlayer || !isMyTurn || picking}
            className={cn(
              "w-full h-11 rounded-[4px] font-mono text-sm uppercase tracking-wide transition-colors duration-100",
              selectedPlayer && isMyTurn && !picking
                ? "bg-accent text-bg hover:bg-accent/90"
                : "bg-border text-text-dim cursor-not-allowed"
            )}
          >
            {picking
              ? "Picking..."
              : selectedPlayer
                ? `Pick ${getPlayer(selectedPlayer)?.name ?? "Player"}`
                : isMyTurn
                  ? "Select a player"
                  : "Waiting for opponent"}
          </button>
        )}
      </div>
    </div>
  );
}
