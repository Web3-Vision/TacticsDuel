import { FORMATIONS } from "../data/formations";

export type SessionSide = "home" | "away";
export type SessionStatus = "waiting" | "active" | "completed";
export type MatchPhase = "lobby" | "first_half" | "halftime" | "second_half" | "fulltime";
export type LiveMatchCommandType =
  | "phase_transition"
  | "substitution"
  | "formation_change"
  | "play_style_change"
  | "set_piece_roles";

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
  | "PARTICIPANT_DISCONNECTED"
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
const MAX_COMMAND_PAYLOAD_BYTES = 4096;
const MAX_SUBSTITUTIONS_PER_SIDE = 5;
const MAX_FORMATION_CHANGES_PER_SIDE = 4;
const MAX_PLAY_STYLE_CHANGES_PER_SIDE = 6;
const MAX_SET_PIECE_ROLE_CHANGES_PER_SIDE = 8;
const ROOM_CODE_LENGTH = 6;
const STALE_SESSION_MS = 2 * 60 * 60 * 1000;
const RESERVED_PAYLOAD_KEYS = new Set(["status", "activeSide", "turnNumber", "phase", "participants"]);
const ALLOWED_FORMATIONS = new Set(FORMATIONS.map((formation) => formation.id));
const ALLOWED_PLAY_STYLES = new Set(["balanced", "counter", "possession", "high_press", "direct"]);
const SET_PIECE_ROLE_KEYS = ["captain", "penaltyTaker", "freeKickTaker", "leftCornerTaker", "rightCornerTaker"] as const;
const ALLOWED_PHASE_TRANSITIONS: Record<MatchPhase, MatchPhase[]> = {
  lobby: ["first_half"],
  first_half: ["halftime"],
  halftime: ["second_half"],
  second_half: ["fulltime"],
  fulltime: [],
};
type SetPieceRoleKey = (typeof SET_PIECE_ROLE_KEYS)[number];

interface CommandHistory {
  substitutionCount: number;
  formationChangeCount: number;
  playStyleChangeCount: number;
  setPieceRoleChangeCount: number;
  substitutedOutPlayerIds: Set<string>;
  substitutedInPlayerIds: Set<string>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function hashFNV1a(input: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(payload: Record<string, unknown>, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(payload).filter((key) => !allowed.has(key));

  if (unexpected.length > 0) {
    throw new SessionError("INVALID_ACTION", `Payload contains unsupported keys: ${unexpected.join(", ")}`);
  }
}

function normalizePlayerId(raw: unknown, fieldName: string): string {
  if (typeof raw !== "string") {
    throw new SessionError("INVALID_ACTION", `${fieldName} must be a string`);
  }

  const value = raw.trim();
  if (!value) {
    throw new SessionError("INVALID_ACTION", `${fieldName} is required`);
  }

  if (!/^[A-Za-z0-9_-]{2,64}$/.test(value)) {
    throw new SessionError("INVALID_ACTION", `${fieldName} has invalid format`);
  }

  return value;
}

function buildCommandHistory(session: MatchSession, side: SessionSide): CommandHistory {
  const history: CommandHistory = {
    substitutionCount: 0,
    formationChangeCount: 0,
    playStyleChangeCount: 0,
    setPieceRoleChangeCount: 0,
    substitutedOutPlayerIds: new Set(),
    substitutedInPlayerIds: new Set(),
  };

  for (const turn of session.turns) {
    if (turn.side !== side || !isRecord(turn.payload)) {
      continue;
    }

    const commandType = turn.payload.commandType ?? turn.payload.action;
    if (commandType === "substitution") {
      history.substitutionCount += 1;
      if (typeof turn.payload.outPlayerId === "string") {
        history.substitutedOutPlayerIds.add(turn.payload.outPlayerId);
      }
      if (typeof turn.payload.inPlayerId === "string") {
        history.substitutedInPlayerIds.add(turn.payload.inPlayerId);
      }
    } else if (commandType === "formation_change") {
      history.formationChangeCount += 1;
    } else if (commandType === "play_style_change") {
      history.playStyleChangeCount += 1;
    } else if (commandType === "set_piece_roles") {
      history.setPieceRoleChangeCount += 1;
    }
  }

  return history;
}

function normalizeCommandPayload(
  session: MatchSession,
  side: SessionSide,
  turnNumber: number,
  payload: Record<string, unknown>
) {
  if (stableStringify(payload).length > MAX_COMMAND_PAYLOAD_BYTES) {
    throw new SessionError("INVALID_ACTION", "Payload exceeds maximum command size");
  }

  const actionRaw = payload.commandType ?? payload.action;
  if (typeof actionRaw !== "string") {
    throw new SessionError("INVALID_ACTION", "Payload action is required");
  }
  const commandType = actionRaw.trim().toLowerCase() as LiveMatchCommandType;
  const history = buildCommandHistory(session, side);

  if (commandType === "phase_transition") {
    assertAllowedKeys(payload, ["action", "commandType", "transitionToPhase"]);
    const nextPhase = payload.transitionToPhase;
    if (typeof nextPhase !== "string") {
      throw new SessionError("INVALID_ACTION", "transitionToPhase must be a string");
    }

    const allowed = ALLOWED_PHASE_TRANSITIONS[session.phase];
    if (!allowed.includes(nextPhase as MatchPhase)) {
      throw new SessionError("INVALID_ACTION", `Invalid phase transition from ${session.phase} to ${nextPhase}`);
    }

    return {
      action: "phase_transition",
      commandType: "phase_transition",
      commandVersion: 1,
      transitionToPhase: nextPhase as MatchPhase,
    } as const;
  }

  if (commandType === "substitution") {
    assertAllowedKeys(payload, ["action", "commandType", "outPlayerId", "inPlayerId", "minute"]);

    if (history.substitutionCount >= MAX_SUBSTITUTIONS_PER_SIDE) {
      throw new SessionError("INVALID_ACTION", "Substitution limit reached for this side");
    }

    const outPlayerId = normalizePlayerId(payload.outPlayerId, "outPlayerId");
    const inPlayerId = normalizePlayerId(payload.inPlayerId, "inPlayerId");
    if (outPlayerId === inPlayerId) {
      throw new SessionError("INVALID_ACTION", "outPlayerId and inPlayerId must be different");
    }

    if (history.substitutedOutPlayerIds.has(outPlayerId)) {
      throw new SessionError("INVALID_ACTION", "outPlayerId has already been substituted out");
    }

    if (history.substitutedInPlayerIds.has(inPlayerId)) {
      throw new SessionError("INVALID_ACTION", "inPlayerId has already been substituted in");
    }

    let minute: number | undefined;
    if ("minute" in payload) {
      if (!Number.isInteger(payload.minute) || Number(payload.minute) < 1 || Number(payload.minute) > 130) {
        throw new SessionError("INVALID_ACTION", "minute must be an integer between 1 and 130");
      }
      minute = Number(payload.minute);
    }

    return {
      action: "substitution",
      commandType: "substitution",
      commandVersion: 1,
      outPlayerId,
      inPlayerId,
      ...(typeof minute === "number" ? { minute } : {}),
    } as const;
  }

  if (commandType === "formation_change") {
    assertAllowedKeys(payload, ["action", "commandType", "formation"]);

    if (history.formationChangeCount >= MAX_FORMATION_CHANGES_PER_SIDE) {
      throw new SessionError("INVALID_ACTION", "Formation change limit reached for this side");
    }

    if (typeof payload.formation !== "string" || !ALLOWED_FORMATIONS.has(payload.formation)) {
      throw new SessionError("INVALID_ACTION", "formation must be a supported formation id");
    }

    return {
      action: "formation_change",
      commandType: "formation_change",
      commandVersion: 1,
      formation: payload.formation,
    } as const;
  }

  if (commandType === "play_style_change") {
    assertAllowedKeys(payload, ["action", "commandType", "playStyle"]);

    if (history.playStyleChangeCount >= MAX_PLAY_STYLE_CHANGES_PER_SIDE) {
      throw new SessionError("INVALID_ACTION", "Play style change limit reached for this side");
    }

    if (typeof payload.playStyle !== "string") {
      throw new SessionError("INVALID_ACTION", "playStyle must be a string");
    }

    const normalizedPlayStyle = payload.playStyle.trim().toLowerCase();
    if (!ALLOWED_PLAY_STYLES.has(normalizedPlayStyle)) {
      throw new SessionError("INVALID_ACTION", "playStyle must be one of balanced, counter, possession, high_press, direct");
    }

    return {
      action: "play_style_change",
      commandType: "play_style_change",
      commandVersion: 1,
      playStyle: normalizedPlayStyle,
    } as const;
  }

  if (commandType === "set_piece_roles") {
    assertAllowedKeys(payload, ["action", "commandType", "roles"]);

    if (history.setPieceRoleChangeCount >= MAX_SET_PIECE_ROLE_CHANGES_PER_SIDE) {
      throw new SessionError("INVALID_ACTION", "Set-piece role change limit reached for this side");
    }

    if (!isRecord(payload.roles)) {
      throw new SessionError("INVALID_ACTION", "roles must be an object");
    }

    const normalizedRoles: Partial<Record<SetPieceRoleKey, string>> = {};
    const seenPlayers = new Set<string>();
    let assignedRoleCount = 0;

    for (const roleKey of SET_PIECE_ROLE_KEYS) {
      const roleValue = payload.roles[roleKey];
      if (typeof roleValue === "undefined" || roleValue === null || roleValue === "") {
        continue;
      }

      const playerId = normalizePlayerId(roleValue, `roles.${roleKey}`);
      if (seenPlayers.has(playerId)) {
        throw new SessionError("INVALID_ACTION", "A player cannot hold duplicate set-piece roles in one command");
      }

      seenPlayers.add(playerId);
      normalizedRoles[roleKey] = playerId;
      assignedRoleCount += 1;
    }

    if (assignedRoleCount === 0) {
      throw new SessionError("INVALID_ACTION", "At least one set-piece role assignment is required");
    }

    return {
      action: "set_piece_roles",
      commandType: "set_piece_roles",
      commandVersion: 1,
      roles: normalizedRoles,
    } as const;
  }

  throw new SessionError(
    "INVALID_ACTION",
    "Unsupported command type. Expected one of phase_transition, substitution, formation_change, play_style_change, set_piece_roles"
  );
}

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
    turns: session.turns.map((t) => ({ ...t, payload: structuredClone(t.payload) })),
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

function ensureConnectedParticipant(participant: SessionParticipant) {
  if (!participant.connected) {
    throw new SessionError("PARTICIPANT_DISCONNECTED", "Reconnect before submitting commands");
  }
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
  ensureConnectedParticipant(participant);

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

  const normalizedPayload = normalizeCommandPayload(session, participant.side, turnNumber, payload);
  if (normalizedPayload.commandType === "phase_transition") {
    session.phase = normalizedPayload.transitionToPhase;
  }

  if (session.turns.length >= MAX_TURNS) {
    session.status = "completed";
    session.phase = "fulltime";
    session.updatedAt = nowIso();
    return copySession(session);
  }

  const timestamp = nowIso();

  const commandHash = hashFNV1a(
    stableStringify({
      side: participant.side,
      turnNumber,
      payload: normalizedPayload,
    })
  );

  session.turns.push({
    side: participant.side,
    turnNumber,
    payload: {
      ...normalizedPayload,
      commandHash,
    },
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
