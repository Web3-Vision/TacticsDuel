import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createTraceId, logDomainEvent, recordApiResult } from "../../../../lib/observability/realtime";
import { formatSessionStateHint, SessionError, type MatchSession } from "../../../../lib/multiplayer/session-domain";
import {
  getMultiplayerSessionStore,
} from "../../../../lib/multiplayer/session-store";

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

function formatSessionResponse(session: MatchSession, currentUserId: string) {
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

async function getSubmitTurnRecoveryHint(sessionId: string, currentUserId: string | null) {
  if (!sessionId || !currentUserId) {
    return null;
  }

  try {
    const store = await getMultiplayerSessionStore();
    const session = await store.getSessionForUser(sessionId, currentUserId);
    return formatSessionStateHint(session, currentUserId);
  } catch {
    return null;
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
    const store = await getMultiplayerSessionStore();
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const contextAction = action || "unknown";
    const contextSessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    observedAction = contextAction;
    observedSessionId = contextSessionId;

    if (action === "create_room") {
      const matchId = typeof body?.matchId === "string" ? body.matchId : null;
      const session = await store.createRoom(userId, matchId);
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

      const session = await store.joinRoom(userId, roomCode);
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

      const session = await store.reconnect(sessionId, userId);
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

      const session = await store.disconnect(sessionId, userId);
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

      const session = await store.submitTurn(sessionId, userId, turnNumber, payload);
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

      const session = await store.closeSession(sessionId, userId);
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
        ? await getSubmitTurnRecoveryHint(observedSessionId, userId)
        : null;

      if (shouldIncludeRecoveryHint) {
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
    const store = await getMultiplayerSessionStore();
    const session = await store.getSessionForUser(sessionId, userId);
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
