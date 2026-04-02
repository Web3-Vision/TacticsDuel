import {
  ROOM_CODE_LENGTH,
  STALE_SESSION_MS,
  SessionError,
  closeSessionState,
  copySession,
  createRoomState,
  disconnectState,
  getSessionForUserState,
  joinRoomState,
  reconnectState,
  submitTurnState,
  type MatchPhase,
  type MatchSession,
  type SessionErrorCode,
  type SessionParticipant,
  type SessionSide,
  type SessionStatus,
  type SessionTurn,
} from "./session-domain";

export type {
  MatchPhase,
  MatchSession,
  SessionErrorCode,
  SessionParticipant,
  SessionSide,
  SessionStatus,
  SessionTurn,
} from "./session-domain";

export { SessionError } from "./session-domain";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRegistry() {
  const globalRegistry = globalThis as typeof globalThis & {
    __tacticsDuelSessionRegistry?: {
      byId: Map<string, MatchSession>;
      roomToId: Map<string, string>;
    };
  };

  if (!globalRegistry.__tacticsDuelSessionRegistry) {
    globalRegistry.__tacticsDuelSessionRegistry = {
      byId: new Map<string, MatchSession>(),
      roomToId: new Map<string, string>(),
    };
  }

  return globalRegistry.__tacticsDuelSessionRegistry;
}

function cleanupStaleSessions() {
  const registry = getRegistry();
  const cutoff = Date.now() - STALE_SESSION_MS;

  for (const [sessionId, session] of registry.byId.entries()) {
    if (new Date(session.updatedAt).getTime() < cutoff) {
      registry.byId.delete(sessionId);
      registry.roomToId.delete(session.roomCode);
    }
  }
}

function getById(sessionId: string): MatchSession {
  cleanupStaleSessions();
  const session = getRegistry().byId.get(sessionId);
  if (!session) {
    throw new SessionError("SESSION_NOT_FOUND", "Session not found");
  }

  return session;
}

function persistSession(session: MatchSession) {
  const registry = getRegistry();
  registry.byId.set(session.id, session);
  registry.roomToId.set(session.roomCode, session.id);
}

function roomCodeForNewSession(): string {
  const registry = getRegistry();
  let attempts = 0;

  while (attempts < 32) {
    const code = randomCode();
    if (!registry.roomToId.has(code)) {
      return code;
    }
    attempts += 1;
  }

  throw new Error("Failed to allocate room code");
}

export function createRoom(userId: string, matchId?: string | null): MatchSession {
  cleanupStaleSessions();
  const session = createRoomState({
    sessionId: crypto.randomUUID(),
    roomCode: roomCodeForNewSession(),
    userId,
    matchId: matchId ?? null,
  });
  persistSession(session);
  return copySession(session);
}

export function joinRoom(userId: string, roomCode: string): MatchSession {
  cleanupStaleSessions();
  const normalizedCode = roomCode.trim().toUpperCase();
  const sessionId = getRegistry().roomToId.get(normalizedCode);

  if (!sessionId) {
    throw new SessionError("ROOM_NOT_FOUND", "Room code does not exist");
  }

  const session = joinRoomState(getById(sessionId), userId);
  persistSession(session);
  return copySession(session);
}

export function reconnect(sessionId: string, userId: string): MatchSession {
  const session = reconnectState(getById(sessionId), userId);
  persistSession(session);
  return copySession(session);
}

export function disconnect(sessionId: string, userId: string): MatchSession {
  const session = disconnectState(getById(sessionId), userId);
  persistSession(session);
  return copySession(session);
}

export function submitTurn(
  sessionId: string,
  userId: string,
  turnNumber: number,
  payload: Record<string, unknown>,
): MatchSession {
  const session = submitTurnState(getById(sessionId), userId, turnNumber, payload);
  persistSession(session);
  return copySession(session);
}

export function getSessionForUser(sessionId: string, userId: string): MatchSession {
  return getSessionForUserState(getById(sessionId), userId);
}

export function closeSession(sessionId: string, userId: string): MatchSession {
  const session = closeSessionState(getById(sessionId), userId);
  persistSession(session);
  return copySession(session);
}
