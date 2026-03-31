export type SessionSide = "home" | "away";
export type SessionStatus = "waiting" | "active" | "completed";
export type MatchPhase = "lobby" | "first_half" | "halftime" | "second_half" | "fulltime";

export interface SessionParticipant {
  userId: string;
  side: SessionSide;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface SessionTurn {
  side: SessionSide;
  turnNumber: number;
  payload: Record<string, unknown>;
  submittedAt: string;
}

export interface MatchSession {
  id: string;
  roomCode: string;
  matchId: string | null;
  status: SessionStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  turnNumber: number;
  activeSide: SessionSide;
  phase: MatchPhase;
  participants: SessionParticipant[];
  turns: SessionTurn[];
}

export type SessionErrorCode =
  | "SESSION_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "NOT_A_PARTICIPANT"
  | "INVALID_TURN"
  | "NOT_YOUR_TURN"
  | "SESSION_NOT_ACTIVE"
  | "INVALID_ACTION";

export class SessionError extends Error {
  code: SessionErrorCode;

  constructor(code: SessionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const MAX_TURNS = 200;
const ROOM_CODE_LENGTH = 6;
const STALE_SESSION_MS = 2 * 60 * 60 * 1000;
const RESERVED_PAYLOAD_KEYS = new Set(["status", "activeSide", "turnNumber", "phase", "participants"]);
const ALLOWED_PHASE_TRANSITIONS: Record<MatchPhase, MatchPhase[]> = {
  lobby: ["first_half"],
  first_half: ["halftime"],
  halftime: ["second_half"],
  second_half: ["fulltime"],
  fulltime: [],
};

function nowIso() {
  return new Date().toISOString();
}

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

function copySession(session: MatchSession): MatchSession {
  return {
    ...session,
    participants: session.participants.map((p) => ({ ...p })),
    turns: session.turns.map((t) => ({ ...t, payload: { ...t.payload } })),
  };
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

function ensureParticipant(session: MatchSession, userId: string): SessionParticipant {
  const participant = session.participants.find((p) => p.userId === userId);
  if (!participant) {
    throw new SessionError("NOT_A_PARTICIPANT", "User is not a session participant");
  }
  return participant;
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
  const registry = getRegistry();
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const roomCode = roomCodeForNewSession();

  const session: MatchSession = {
    id,
    roomCode,
    matchId: matchId ?? null,
    status: "waiting",
    createdByUserId: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    turnNumber: 1,
    activeSide: "home",
    phase: "lobby",
    participants: [
      {
        userId,
        side: "home",
        connected: true,
        joinedAt: timestamp,
        lastSeenAt: timestamp,
      },
    ],
    turns: [],
  };

  registry.byId.set(id, session);
  registry.roomToId.set(roomCode, id);

  return copySession(session);
}

export function joinRoom(userId: string, roomCode: string): MatchSession {
  cleanupStaleSessions();
  const registry = getRegistry();
  const normalizedCode = roomCode.trim().toUpperCase();
  const sessionId = registry.roomToId.get(normalizedCode);

  if (!sessionId) {
    throw new SessionError("ROOM_NOT_FOUND", "Room code does not exist");
  }

  const session = getById(sessionId);
  if (session.status === "completed") {
    throw new SessionError("INVALID_ACTION", "Session is completed");
  }
  const existing = session.participants.find((p) => p.userId === userId);
  const timestamp = nowIso();

  if (existing) {
    existing.connected = true;
    existing.lastSeenAt = timestamp;
    session.updatedAt = timestamp;
    return copySession(session);
  }

  if (session.participants.length >= 2) {
    throw new SessionError("ROOM_FULL", "Room is full");
  }

  session.participants.push({
    userId,
    side: "away",
    connected: true,
    joinedAt: timestamp,
    lastSeenAt: timestamp,
  });

  if (session.participants.length === 2) {
    session.status = "active";
    session.phase = "first_half";
  }

  session.updatedAt = timestamp;
  return copySession(session);
}

export function reconnect(sessionId: string, userId: string): MatchSession {
  const session = getById(sessionId);
  const participant = ensureParticipant(session, userId);

  participant.connected = true;
  participant.lastSeenAt = nowIso();
  session.updatedAt = participant.lastSeenAt;

  return copySession(session);
}

export function disconnect(sessionId: string, userId: string): MatchSession {
  const session = getById(sessionId);
  const participant = ensureParticipant(session, userId);

  participant.connected = false;
  participant.lastSeenAt = nowIso();
  session.updatedAt = participant.lastSeenAt;

  return copySession(session);
}

export function submitTurn(
  sessionId: string,
  userId: string,
  turnNumber: number,
  payload: Record<string, unknown>
): MatchSession {
  const session = getById(sessionId);
  const participant = ensureParticipant(session, userId);

  if (session.status !== "active") {
    throw new SessionError("SESSION_NOT_ACTIVE", "Session is not active");
  }

  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new SessionError("INVALID_TURN", "Turn number must be a positive integer");
  }

  if (turnNumber !== session.turnNumber) {
    throw new SessionError("INVALID_TURN", "Turn number is out of sync");
  }

  if (participant.side !== session.activeSide) {
    throw new SessionError("NOT_YOUR_TURN", "It is not your turn");
  }

  const payloadKeys = Object.keys(payload);
  if (payloadKeys.some((key) => RESERVED_PAYLOAD_KEYS.has(key))) {
    throw new SessionError("INVALID_ACTION", "Payload contains reserved session keys");
  }

  if ("transitionToPhase" in payload) {
    const nextPhase = payload.transitionToPhase;
    if (typeof nextPhase !== "string") {
      throw new SessionError("INVALID_ACTION", "transitionToPhase must be a string");
    }

    const current = session.phase;
    const allowed = ALLOWED_PHASE_TRANSITIONS[current];
    if (!allowed.includes(nextPhase as MatchPhase)) {
      throw new SessionError(
        "INVALID_ACTION",
        `Invalid phase transition from ${current} to ${nextPhase}`
      );
    }

    session.phase = nextPhase as MatchPhase;
  }

  if (session.turns.length >= MAX_TURNS) {
    session.status = "completed";
    session.phase = "fulltime";
    session.updatedAt = nowIso();
    return copySession(session);
  }

  const timestamp = nowIso();

  session.turns.push({
    side: participant.side,
    turnNumber,
    payload,
    submittedAt: timestamp,
  });

  session.turnNumber += 1;
  session.activeSide = session.activeSide === "home" ? "away" : "home";
  session.updatedAt = timestamp;

  return copySession(session);
}

export function getSessionForUser(sessionId: string, userId: string): MatchSession {
  const session = getById(sessionId);
  ensureParticipant(session, userId);
  return copySession(session);
}

export function closeSession(sessionId: string, userId: string): MatchSession {
  const registry = getRegistry();
  const session = getById(sessionId);

  if (session.createdByUserId !== userId) {
    throw new SessionError("NOT_A_PARTICIPANT", "Only room creator can close session");
  }

  if (session.status === "completed") {
    throw new SessionError("INVALID_ACTION", "Session is already completed");
  }

  session.status = "completed";
  session.phase = "fulltime";
  session.updatedAt = nowIso();
  registry.byId.set(session.id, session);

  return copySession(session);
}
