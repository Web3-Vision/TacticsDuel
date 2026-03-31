"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Radio, RefreshCw, TimerReset, Users, Zap } from "lucide-react";
import {
  buildReconnectViewModel,
  buildTimeline,
  fixtureStatusSummary,
  nextPhase,
  tacticalCommandAvailability,
  tacticalCommandOptions,
  type MatchdaySessionView,
  type TacticalCommandType,
} from "@/lib/multiplayer/matchday-view-model";
import { cn } from "@/lib/utils";

interface SessionApiResponse {
  session?: MatchdaySessionView;
  error?: string;
  code?: string;
}

const SESSION_ID_STORAGE_KEY = "matchday.sessionId";
const COMMAND_TYPE_LABELS: Record<TacticalCommandType, string> = {
  mentality_shift: "Mentality Shift",
  tempo_shift: "Tempo Shift",
  pressing_line: "Pressing Line",
  width_shift: "Width Shift",
};

async function sessionPost(body: Record<string, unknown>) {
  const response = await fetch("/api/match/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as SessionApiResponse;
  if (!response.ok) {
    throw new Error(data.error || "Session request failed");
  }

  if (!data.session) {
    throw new Error("Missing session payload");
  }

  return data.session;
}

async function sessionGet(sessionId: string) {
  const response = await fetch(`/api/match/session?sessionId=${encodeURIComponent(sessionId)}`);
  const data = (await response.json()) as SessionApiResponse;

  if (!response.ok) {
    throw new Error(data.error || "Could not load session");
  }

  if (!data.session) {
    throw new Error("Missing session payload");
  }

  return data.session;
}

function saveSessionId(sessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
}

function readSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(SESSION_ID_STORAGE_KEY) ?? "";
}

export default function MatchdayPage() {
  const [session, setSession] = useState<MatchdaySessionView | null>(null);
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [matchIdInput, setMatchIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("Enter room code to join, or create a new fixture room.");
  const [commandType, setCommandType] = useState<TacticalCommandType>("mentality_shift");
  const [commandValue, setCommandValue] = useState("Balanced");
  const [lastCommandAckMs, setLastCommandAckMs] = useState<number | null>(null);
  const [lastCommandTurn, setLastCommandTurn] = useState<number | null>(null);

  const hydrateFromStorage = useCallback(async () => {
    const storedSessionId = readSessionId();
    if (!storedSessionId) {
      return;
    }

    setSessionIdInput(storedSessionId);
    setLoading(true);
    setError("");

    try {
      const restoredSession = await sessionGet(storedSessionId);
      setSession(restoredSession);
      setInfo(`Restored fixture ${restoredSession.roomCode}.`);
    } catch {
      setInfo("Stored session id found but could not be loaded. You can reconnect manually.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const activeSessionId = session?.id || sessionIdInput.trim();
    if (!activeSessionId) {
      return;
    }

    setBusyAction("refresh");
    setError("");

    try {
      const refreshed = await sessionGet(activeSessionId);
      setSession(refreshed);
      saveSessionId(refreshed.id);
      setSessionIdInput(refreshed.id);
    } catch (refreshError) {
      setError((refreshError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [session?.id, sessionIdInput]);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }

    const interval = setInterval(() => {
      void refreshSession();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshSession, session?.id]);

  const onCreateRoom = useCallback(async () => {
    setBusyAction("create_room");
    setError("");

    try {
      const created = await sessionPost({
        action: "create_room",
        matchId: matchIdInput.trim() || null,
      });
      setSession(created);
      setRoomCodeInput(created.roomCode);
      setSessionIdInput(created.id);
      saveSessionId(created.id);
      setInfo(`Room ${created.roomCode} created. Share this code and monitor timeline here.`);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [matchIdInput]);

  const onJoinRoom = useCallback(async () => {
    const roomCode = roomCodeInput.trim();
    if (!roomCode) {
      setError("Room code is required");
      return;
    }

    setBusyAction("join_room");
    setError("");

    try {
      const joined = await sessionPost({ action: "join_room", roomCode });
      setSession(joined);
      setSessionIdInput(joined.id);
      saveSessionId(joined.id);
      setInfo(`Joined fixture room ${joined.roomCode}.`);
    } catch (joinError) {
      setError((joinError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [roomCodeInput]);

  const onReconnect = useCallback(async () => {
    const reconnectSessionId = session?.id || sessionIdInput.trim();
    if (!reconnectSessionId) {
      setError("Session id is required to reconnect");
      return;
    }

    setBusyAction("reconnect");
    setError("");

    try {
      const reconnected = await sessionPost({ action: "reconnect", sessionId: reconnectSessionId });
      setSession(reconnected);
      setSessionIdInput(reconnected.id);
      saveSessionId(reconnected.id);
      setInfo("Reconnected and synced with live phase state.");
    } catch (reconnectError) {
      setError((reconnectError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [session?.id, sessionIdInput]);

  const onDisconnect = useCallback(async () => {
    if (!session?.id) {
      return;
    }

    setBusyAction("disconnect");
    setError("");

    try {
      const disconnected = await sessionPost({ action: "disconnect", sessionId: session.id });
      setSession(disconnected);
      setInfo("Disconnected from fixture. Use reconnect to resume.");
    } catch (disconnectError) {
      setError((disconnectError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [session?.id]);

  const onAdvancePhase = useCallback(async () => {
    if (!session?.id || !session.you) {
      return;
    }

    const toPhase = nextPhase(session.phase);
    if (!toPhase) {
      return;
    }

    setBusyAction("advance_phase");
    setError("");

    try {
      const updated = await sessionPost({
        action: "submit_turn",
        sessionId: session.id,
        turnNumber: session.turnNumber,
        payload: {
          action: "phase_transition",
          transitionToPhase: toPhase,
        },
      });

      setSession(updated);
      setInfo(`Phase advanced to ${toPhase.replace("_", " ")}.`);
    } catch (phaseError) {
      setError((phaseError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [session]);

  const onCloseRoom = useCallback(async () => {
    if (!session?.id) {
      return;
    }

    setBusyAction("close_room");
    setError("");

    try {
      const closed = await sessionPost({ action: "close_room", sessionId: session.id });
      setSession(closed);
      setInfo("Fixture was closed and marked fulltime.");
    } catch (closeError) {
      setError((closeError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [session?.id]);

  const onSubmitCommand = useCallback(async () => {
    if (!session) {
      return;
    }

    setBusyAction("submit_command");
    setError("");

    const startedAt = performance.now();

    try {
      const updated = await sessionPost({
        action: "submit_turn",
        sessionId: session.id,
        turnNumber: session.turnNumber,
        payload: {
          action: "tactical_command",
          commandType,
          value: commandValue,
          phase: session.phase,
          sentAt: new Date().toISOString(),
        },
      });
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      setLastCommandAckMs(elapsedMs);
      setLastCommandTurn(session.turnNumber);
      setSession(updated);
      setInfo(`Command acknowledged in ${elapsedMs}ms.`);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [commandType, commandValue, session]);

  const timeline = useMemo(() => buildTimeline(session?.phase ?? "lobby"), [session?.phase]);
  const reconnectView = useMemo(
    () => buildReconnectViewModel(session, Boolean(sessionIdInput.trim())),
    [session, sessionIdInput],
  );
  const commandWindow = useMemo(() => tacticalCommandAvailability(session), [session]);
  const commandOptions = useMemo(() => tacticalCommandOptions(commandType), [commandType]);
  const latestCommandTurn = useMemo(() => {
    if (!session) {
      return null;
    }

    const tacticalTurns = session.turns.filter((turn) => turn.payload.action === "tactical_command");
    return tacticalTurns[tacticalTurns.length - 1] ?? null;
  }, [session]);

  useEffect(() => {
    const fallback = tacticalCommandOptions(commandType)[0]?.value ?? "";
    const hasCurrent = tacticalCommandOptions(commandType).some((option) => option.value === commandValue);
    if (!hasCurrent) {
      setCommandValue(fallback);
    }
  }, [commandType, commandValue]);

  const canAdvancePhase = Boolean(
    session &&
      session.status === "active" &&
      session.you &&
      session.activeSide === session.you.side &&
      nextPhase(session.phase),
  );

  return (
    <div className="p-4 space-y-4 pb-20">
      <section className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">Matchday Command Center</p>
            <h1 className="font-mono text-lg text-text mt-1">Live Fixture Control</h1>
            <p className="font-mono text-xs text-text-mid mt-2">{fixtureStatusSummary(session)}</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshSession()}
            disabled={busyAction === "refresh"}
            className="h-10 px-3 min-w-[44px] rounded-md border border-border text-text-mid hover:border-border-light transition-colors duration-100 disabled:opacity-50"
            aria-label="Refresh fixture state"
          >
            <RefreshCw size={14} className={cn(busyAction === "refresh" && "animate-spin")} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Session Id</span>
            <input
              value={sessionIdInput}
              onChange={(event) => setSessionIdInput(event.target.value)}
              placeholder="Paste session id"
              className="w-full h-10 bg-bg border border-border rounded-md px-3 font-mono text-xs text-text placeholder:text-text-dim"
            />
          </label>

          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Room Code</span>
            <input
              value={roomCodeInput}
              onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
              placeholder="Enter room code"
              className="w-full h-10 bg-bg border border-border rounded-md px-3 font-mono text-xs text-text uppercase placeholder:text-text-dim"
            />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Optional Match Id</span>
          <input
            value={matchIdInput}
            onChange={(event) => setMatchIdInput(event.target.value)}
            placeholder="Link to existing match record"
            className="w-full h-10 bg-bg border border-border rounded-md px-3 font-mono text-xs text-text placeholder:text-text-dim"
          />
        </label>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => void onCreateRoom()}
            disabled={busyAction !== null}
            className="h-10 rounded-md bg-accent text-black font-mono text-xs uppercase tracking-wide disabled:opacity-50"
          >
            {busyAction === "create_room" ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => void onJoinRoom()}
            disabled={busyAction !== null}
            className="h-10 rounded-md border border-border text-text font-mono text-xs uppercase tracking-wide hover:border-border-light disabled:opacity-50"
          >
            {busyAction === "join_room" ? "Joining..." : "Join"}
          </button>
          <button
            type="button"
            onClick={() => void onReconnect()}
            disabled={busyAction !== null || !reconnectView.canReconnect}
            className="h-10 rounded-md border border-border text-text font-mono text-xs uppercase tracking-wide hover:border-border-light disabled:opacity-50"
          >
            {busyAction === "reconnect" ? "Rejoining..." : "Reconnect"}
          </button>
          <button
            type="button"
            onClick={() => void onDisconnect()}
            disabled={busyAction !== null || !session}
            className="h-10 rounded-md border border-border text-text font-mono text-xs uppercase tracking-wide hover:border-border-light disabled:opacity-50"
          >
            {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>

        <p className="font-mono text-[11px] text-text-mid">{reconnectView.message}</p>

        {loading && (
          <div className="flex items-center gap-2 text-text-dim font-mono text-xs">
            <Loader2 size={14} className="animate-spin" />
            Loading stored fixture...
          </div>
        )}

        {!loading && !session && (
          <div className="rounded-md border border-dashed border-border p-3 font-mono text-xs text-text-dim">
            No fixture loaded. Create a room or join using room code.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3">
            <p className="font-mono text-xs text-danger">{error}</p>
            <button
              type="button"
              onClick={() => void refreshSession()}
              className="mt-2 h-8 px-3 rounded border border-danger/40 text-danger font-mono text-xs uppercase tracking-wide"
            >
              Retry
            </button>
          </div>
        )}

        <p className="font-mono text-[11px] text-text-mid">{info}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-accent" />
            <h2 className="font-mono text-sm uppercase tracking-wide">Live Action Timeline</h2>
          </div>

          <div className="space-y-2">
            {timeline.map((item) => (
              <div
                key={item.phase}
                className={cn(
                  "rounded-md border p-3",
                  item.state === "completed" && "border-accent/40 bg-accent/10",
                  item.state === "current" && "border-home/60 bg-home/10",
                  item.state === "upcoming" && "border-border bg-bg/40",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-wide">{item.label}</p>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-dim">{item.state}</span>
                </div>
                <p className="font-mono text-[11px] text-text-mid mt-1">{item.message}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => void onAdvancePhase()}
              disabled={busyAction !== null || !canAdvancePhase}
              className="h-10 rounded-md bg-home text-text font-mono text-xs uppercase tracking-wide disabled:opacity-50"
            >
              {busyAction === "advance_phase" ? "Applying..." : "Advance Phase"}
            </button>
            <button
              type="button"
              onClick={() => void onCloseRoom()}
              disabled={busyAction !== null || !session}
              className="h-10 rounded-md border border-border text-text font-mono text-xs uppercase tracking-wide hover:border-border-light disabled:opacity-50"
            >
              {busyAction === "close_room" ? "Closing..." : "Close Fixture"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-accent" />
            <h2 className="font-mono text-sm uppercase tracking-wide">Lineup + Bench Snapshot</h2>
          </div>

          {!session && (
            <div className="rounded-md border border-dashed border-border p-3 font-mono text-xs text-text-dim">
              No starter/bench data until a fixture session is loaded.
            </div>
          )}

          {session && (
            <>
              <div className="rounded-md border border-border bg-bg/50 p-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Fixture</p>
                  <p className="font-mono text-xs text-text mt-1 tabular-nums">Room {session.roomCode}</p>
                  <p className="font-mono text-[11px] text-text-mid mt-1">Turn {session.turnNumber}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Control</p>
                  <p className="font-mono text-xs text-text mt-1">{session.activeSide} side</p>
                  <p className="font-mono text-[11px] text-text-mid mt-1">Phase {session.phase.replace("_", " ")}</p>
                </div>
              </div>

              <div className="space-y-2">
                {session.participants.map((participant) => (
                  <div key={participant.userId} className="rounded-md border border-border bg-bg/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs text-text">{participant.side.toUpperCase()} starter</p>
                      <span
                        className={cn(
                          "font-mono text-[10px] uppercase tracking-wide",
                          participant.connected ? "text-accent" : "text-danger",
                        )}
                      >
                        {participant.connected ? "Connected" : "Offline"}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-text-mid mt-1 break-all">{participant.userId}</p>
                    <p className="font-mono text-[10px] text-text-dim mt-1">Last seen {new Date(participant.lastSeenAt).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-border bg-bg/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Bench / Options</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded border border-border p-2">
                    <p className="font-mono text-[11px] text-text">Resume session</p>
                    <p className="font-mono text-[10px] text-text-dim mt-1">Use reconnect to restore state after interruption.</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="font-mono text-[11px] text-text">Retry sync</p>
                    <p className="font-mono text-[10px] text-text-dim mt-1">Refresh fixture to resolve stale client phase data.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          <h2 className="font-mono text-sm uppercase tracking-wide">Tactical Command Window</h2>
        </div>

        <p className="font-mono text-[11px] text-text-mid">{commandWindow.reason}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Command Type</span>
            <select
              value={commandType}
              onChange={(event) => setCommandType(event.target.value as TacticalCommandType)}
              className="w-full h-10 bg-bg border border-border rounded-md px-3 font-mono text-xs text-text"
              disabled={busyAction !== null}
            >
              {(Object.keys(COMMAND_TYPE_LABELS) as TacticalCommandType[]).map((type) => (
                <option key={type} value={type}>
                  {COMMAND_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Command Value</span>
            <select
              value={commandValue}
              onChange={(event) => setCommandValue(event.target.value)}
              className="w-full h-10 bg-bg border border-border rounded-md px-3 font-mono text-xs text-text"
              disabled={busyAction !== null}
            >
              {commandOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onSubmitCommand()}
            disabled={busyAction !== null || !commandWindow.canSubmit}
            className="h-10 px-4 rounded-md bg-home text-text font-mono text-xs uppercase tracking-wide disabled:opacity-50"
          >
            {busyAction === "submit_command" ? "Submitting..." : "Submit Tactical Command"}
          </button>
          {busyAction === "submit_command" && (
            <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">Awaiting server acknowledgment...</span>
          )}
          {lastCommandAckMs !== null && lastCommandTurn !== null && (
            <span className="font-mono text-[10px] text-accent uppercase tracking-wide">
              Last ACK: turn {lastCommandTurn} in {lastCommandAckMs}ms
            </span>
          )}
        </div>

        {latestCommandTurn && (
          <div className="rounded-md border border-border bg-bg/50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-text-dim">Latest Authoritative Command</p>
            <p className="font-mono text-xs text-text mt-1">
              Turn {latestCommandTurn.turnNumber} by {latestCommandTurn.side.toUpperCase()} in {session?.phase.replace("_", " ")}
            </p>
            <p className="font-mono text-[11px] text-text-mid mt-1 break-all">
              {JSON.stringify(latestCommandTurn.payload)}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <TimerReset size={14} className="text-accent" />
          <h2 className="font-mono text-sm uppercase tracking-wide">Kickoff / Rejoin Checklist</h2>
        </div>
        <ul className="mt-3 space-y-2 font-mono text-xs text-text-mid list-disc list-inside">
          <li>Create room, share room code, and verify both participants show connected.</li>
          <li>Advance phase from lobby into first half, then validate timeline state moves to current.</li>
          <li>Disconnect one participant and use reconnect to verify session resumes without phase regression.</li>
          <li>Close fixture and ensure phase lands at fulltime.</li>
        </ul>
      </section>
    </div>
  );
}
