import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createTraceId, logDomainEvent, recordApiResult } from "@/lib/observability/realtime";
import { persistSessionSnapshot } from "@/lib/multiplayer/durable-session-store";
import {
  type MatchSession,
  SessionError,
  closeSession,
  createRoom,
  disconnect,
  getSessionForUser,
  joinRoom,
  reconnect,
  submitTurn,
} from "@/lib/multiplayer/session-service";

const actionErrors: Record<string, number> = {
  SESSION_NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  NOT_A_PARTICIPANT: 403,
  PARTICIPANT_DISCONNECTED: 409,
  INVALID_TURN: 409,
  NOT_YOUR_TURN: 409,
  SESSION_NOT_ACTIVE: 409,
  INVALID_ACTION: 400,
};

function formatSessionResponse(session: {
  id: string;
  roomCode: string;
  matchId: string | null;
  status: "waiting" | "active" | "completed";
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  turnNumber: number;
  activeSide: "home" | "away";
  phase: "lobby" | "first_half" | "halftime" | "second_half" | "fulltime";
  participants: Array<{ userId: string; side: "home" | "away"; connected: boolean; joinedAt: string; lastSeenAt: string }>;
  turns: Array<{ side: "home" | "away"; turnNumber: number; payload: Record<string, unknown>; submittedAt: string }>;
}, currentUserId: string) {
  return {
    id: session.id,
    roomCode: session.roomCode,
    matchId: session.matchId,
    status: session.status,
    createdByUserId: session.createdByUserId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turnNumber: session.turnNumber,
    activeSide: session.activeSide,
    phase: session.phase,
    you: session.participants.find((p) => p.userId === currentUserId) ?? null,
    participants: session.participants,
    turns: session.turns,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSessionStateHint(session: {
  id: string;
  status: "waiting" | "active" | "completed";
  updatedAt: string;
  turnNumber: number;
  activeSide: "home" | "away";
  phase: "lobby" | "first_half" | "halftime" | "second_half" | "fulltime";
  participants: Array<{ userId: string; side: "home" | "away"; connected: boolean }>;
}, currentUserId: string) {
  return {
    id: session.id,
    status: session.status,
    updatedAt: session.updatedAt,
    turnNumber: session.turnNumber,
    activeSide: session.activeSide,
    phase: session.phase,
    you: session.participants.find((participant) => participant.userId === currentUserId) ?? null,
  };
}

function getSubmitTurnRecoveryHint(sessionId: string, currentUserId: string | null) {
  if (!sessionId || !currentUserId) {
    return null;
  }

  try {
    const session = getSessionForUser(sessionId, currentUserId);
    return formatSessionStateHint(session, currentUserId);
  } catch {
    return null;
  }
}

function getSubmitTurnRecoverySession(sessionId: string, currentUserId: string | null): MatchSession | null {
  if (!sessionId || !currentUserId) {
    return null;
  }

  try {
    return getSessionForUser(sessionId, currentUserId);
  } catch {
    return null;
  }
}

async function persistSessionChange(session: MatchSession, eventType: string, eventPayload: Record<string, unknown> = {}) {
  try {
    const serviceClient = await createServiceClient();
    await persistSessionSnapshot(serviceClient, session, eventType, eventPayload);
  } catch (error) {
    console.error(`Failed to persist durable session event: ${eventType}`, error);
  }
}

async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function POST(request: Request) {
  const traceId = createTraceId();
  const startedAtMs = Date.now();
  const respond = (payload: unknown, status: number, context?: Record<string, string | number>, errorCode?: string) => {
    recordApiResult({
      service: "match.session",
      operation: "POST",
      traceId,
      startedAtMs,
      status,
      context,
      errorCode,
    });
    const response = NextResponse.json(payload, { status });
    response.headers.set("x-trace-id", traceId);
    return response;
  };

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return respond({ error: "Unauthorized" }, 401);
  }

  let observedAction = "unknown";
  let observedSessionId = "";

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const contextAction = action || "unknown";
    const contextSessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    observedAction = contextAction;
    observedSessionId = contextSessionId;

    if (action === "create_room") {
      const matchId = typeof body?.matchId === "string" ? body.matchId : null;
      const session = createRoom(userId, matchId);
      await persistSessionChange(session, "session_created", { action: contextAction, userId });
      logDomainEvent({
        service: "match.session",
        event: "session_created",
        traceId,
        context: { action: contextAction, sessionId: session.id, matchId: session.matchId ?? "", userId },
      });
      return respond({ session: formatSessionResponse(session, userId) }, 201, {
        action: contextAction,
        sessionId: session.id,
        matchId: session.matchId ?? "",
      });
    }

    if (action === "join_room") {
      const roomCode = typeof body?.roomCode === "string" ? body.roomCode : "";
      if (!roomCode.trim()) {
        return respond({ error: "Missing roomCode" }, 400, { action: contextAction });
      }

      const session = joinRoom(userId, roomCode);
      await persistSessionChange(session, "participant_joined", { action: contextAction, userId });
      return respond({ session: formatSessionResponse(session, userId) }, 200, {
        action: contextAction,
        sessionId: session.id,
        roomCode: session.roomCode,
      });
    }

    if (action === "reconnect") {
      const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return respond({ error: "Missing sessionId" }, 400, { action: contextAction });
      }

      const session = reconnect(sessionId, userId);
      await persistSessionChange(session, "participant_reconnected", { action: contextAction, userId });
      logDomainEvent({
        service: "match.session",
        event: "participant_reconnected",
        traceId,
        context: { action: contextAction, sessionId, userId },
      });
      return respond({ session: formatSessionResponse(session, userId) }, 200, { action: contextAction, sessionId });
    }

    if (action === "disconnect") {
      const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return respond({ error: "Missing sessionId" }, 400, { action: contextAction });
      }

      const session = disconnect(sessionId, userId);
      await persistSessionChange(session, "participant_disconnected", { action: contextAction, userId });
      logDomainEvent({
        service: "match.session",
        event: "participant_disconnected",
        traceId,
        context: { action: contextAction, sessionId, userId },
      });
      return respond({ session: formatSessionResponse(session, userId) }, 200, { action: contextAction, sessionId });
    }

    if (action === "submit_turn") {
      const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
      const turnNumber = Number(body?.turnNumber);
      const payload = isRecord(body?.payload) ? body.payload : null;

      if (!sessionId) {
        return respond({ error: "Missing sessionId" }, 400, { action: contextAction });
      }

      if (!Number.isInteger(turnNumber) || turnNumber < 1) {
        return respond({ error: "Invalid turnNumber" }, 400, { action: contextAction, sessionId: sessionId || "" });
      }

      if (!payload) {
        return respond({ error: "Missing payload" }, 400, { action: contextAction, sessionId });
      }

      const session = submitTurn(sessionId, userId, turnNumber, payload);
      await persistSessionChange(session, "turn_submitted", { action: contextAction, userId, turnNumber });
      return respond({ session: formatSessionResponse(session, userId) }, 200, {
        action: contextAction,
        sessionId,
        turnNumber,
      });
    }

    if (action === "close_room") {
      const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return respond({ error: "Missing sessionId" }, 400, { action: contextAction });
      }

      const session = closeSession(sessionId, userId);
      await persistSessionChange(session, "session_closed", { action: contextAction, userId });
      return respond({ session: formatSessionResponse(session, userId) }, 200, { action: contextAction, sessionId });
    }

    return respond({ error: "Unknown action" }, 400, { action: contextAction, sessionId: contextSessionId });
  } catch (error) {
    if (error instanceof SessionError) {
      const context: Record<string, string | number> = { action: observedAction };
      if (observedSessionId) {
        context.sessionId = observedSessionId;
      }

      const shouldIncludeRecoveryHint =
        observedAction === "submit_turn" &&
        (error.code === "INVALID_TURN" ||
          error.code === "NOT_YOUR_TURN" ||
          error.code === "PARTICIPANT_DISCONNECTED" ||
          error.code === "SESSION_NOT_ACTIVE");

      const sessionState = shouldIncludeRecoveryHint
        ? getSubmitTurnRecoveryHint(observedSessionId, userId)
        : null;
      const recoverySession = shouldIncludeRecoveryHint
        ? getSubmitTurnRecoverySession(observedSessionId, userId)
        : null;

      if (shouldIncludeRecoveryHint) {
        if (recoverySession) {
          await persistSessionChange(recoverySession, "turn_rejected", {
            action: observedAction,
            userId,
            reason: error.code,
            authoritativeTurnNumber: recoverySession.turnNumber,
            authoritativePhase: recoverySession.phase,
            authoritativeActiveSide: recoverySession.activeSide,
          });
        }
        logDomainEvent({
          service: "match.session",
          event: "turn_submission_rejected",
          traceId,
          context: {
            action: observedAction,
            sessionId: observedSessionId,
            userId,
            reason: error.code,
            authoritativeTurnNumber: sessionState?.turnNumber,
            authoritativePhase: sessionState?.phase,
            authoritativeActiveSide: sessionState?.activeSide,
          },
        });
      }

      const responseBody: Record<string, unknown> = {
        error: error.message,
        code: error.code,
      };

      if (sessionState) {
        responseBody.sessionState = sessionState;
      }

      return respond(
        responseBody,
        actionErrors[error.code] ?? 400,
        context,
        error.code
      );
    }

    console.error("Match session POST error", error);
    return respond({ error: "Internal server error" }, 500, undefined, "INTERNAL_ERROR");
  }
}

export async function GET(request: Request) {
  const traceId = createTraceId();
  const startedAtMs = Date.now();
  const respond = (payload: unknown, status: number, context?: Record<string, string | number>, errorCode?: string) => {
    recordApiResult({
      service: "match.session",
      operation: "GET",
      traceId,
      startedAtMs,
      status,
      context,
      errorCode,
    });
    const response = NextResponse.json(payload, { status });
    response.headers.set("x-trace-id", traceId);
    return response;
  };

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return respond({ error: "Missing sessionId" }, 400);
  }

  try {
    const session = getSessionForUser(sessionId, userId);
    return respond({ session: formatSessionResponse(session, userId) }, 200, { sessionId });
  } catch (error) {
    if (error instanceof SessionError) {
      return respond(
        {
          error: error.message,
          code: error.code,
        },
        actionErrors[error.code] ?? 400,
        { sessionId },
        error.code
      );
    }

    console.error("Match session GET error", error);
    return respond({ error: "Internal server error" }, 500, { sessionId }, "INTERNAL_ERROR");
  }
}
