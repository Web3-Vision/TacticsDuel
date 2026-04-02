import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/server";
import {
  SessionError,
  closeSessionState,
  copySession,
  createRoomState,
  disconnectState,
  formatSessionStateHint,
  getSessionForUserState,
  joinRoomState,
  reconnectState,
  submitTurnState,
  type MatchSession,
} from "./session-domain";

export interface MultiplayerSessionStore {
  createRoom(userId: string, matchId?: string | null): Promise<MatchSession>;
  joinRoom(userId: string, roomCode: string): Promise<MatchSession>;
  reconnect(sessionId: string, userId: string): Promise<MatchSession>;
  disconnect(sessionId: string, userId: string): Promise<MatchSession>;
  submitTurn(sessionId: string, userId: string, turnNumber: number, payload: Record<string, unknown>): Promise<MatchSession>;
  getSessionForUser(sessionId: string, userId: string): Promise<MatchSession>;
  closeSession(sessionId: string, userId: string): Promise<MatchSession>;
}

export interface StoredSessionRecord {
  session: MatchSession;
  sessionVersion: number;
  lastEventNumber: number;
}

export interface SessionPersistence {
  findById(sessionId: string): Promise<StoredSessionRecord | null>;
  findByRoomCode(roomCode: string): Promise<StoredSessionRecord | null>;
  create(record: StoredSessionRecord): Promise<StoredSessionRecord>;
  update(expectedVersion: number, record: StoredSessionRecord): Promise<StoredSessionRecord | null>;
  appendEvent(args: {
    sessionId: string;
    eventNumber: number;
    eventType: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

const DEFAULT_MAX_RETRIES = 4;

function bestEffortLogAppend(promise: Promise<void>) {
  void promise.catch((error) => {
    console.warn("Failed to append multiplayer session event", error);
  });
}

export class PostgresSessionStore implements MultiplayerSessionStore {
  constructor(
    private readonly persistence: SessionPersistence,
    private readonly maxRetries = DEFAULT_MAX_RETRIES,
  ) {}

  async createRoom(userId: string, matchId?: string | null): Promise<MatchSession> {
    const session = createRoomState({
      sessionId: crypto.randomUUID(),
      roomCode: randomCode(),
      userId,
      matchId: matchId ?? null,
    });

    const stored = await this.persistence.create({
      session,
      sessionVersion: 1,
      lastEventNumber: 1,
    });

    bestEffortLogAppend(
      this.persistence.appendEvent({
        sessionId: session.id,
        eventNumber: 1,
        eventType: "create_room",
        actorUserId: userId,
        payload: { matchId: session.matchId },
      }),
    );

    return copySession(stored.session);
  }

  async joinRoom(userId: string, roomCode: string): Promise<MatchSession> {
    const normalizedCode = roomCode.trim().toUpperCase();
    return this.mutateByRoomCode(normalizedCode, userId, "join_room", { roomCode: normalizedCode }, (session) =>
      joinRoomState(session, userId),
    );
  }

  async reconnect(sessionId: string, userId: string): Promise<MatchSession> {
    return this.mutateById(sessionId, userId, "reconnect", {}, (session) => reconnectState(session, userId));
  }

  async disconnect(sessionId: string, userId: string): Promise<MatchSession> {
    return this.mutateById(sessionId, userId, "disconnect", {}, (session) => disconnectState(session, userId));
  }

  async submitTurn(
    sessionId: string,
    userId: string,
    turnNumber: number,
    payload: Record<string, unknown>,
  ): Promise<MatchSession> {
    return this.mutateById(
      sessionId,
      userId,
      "submit_turn",
      { turnNumber, commandType: String(payload.commandType ?? payload.action ?? "") },
      (session) => submitTurnState(session, userId, turnNumber, payload),
    );
  }

  async getSessionForUser(sessionId: string, userId: string): Promise<MatchSession> {
    const record = await this.persistence.findById(sessionId);
    if (!record) {
      throw new SessionError("SESSION_NOT_FOUND", "Session not found");
    }

    return getSessionForUserState(record.session, userId);
  }

  async closeSession(sessionId: string, userId: string): Promise<MatchSession> {
    return this.mutateById(sessionId, userId, "close_room", {}, (session) => closeSessionState(session, userId));
  }

  private async mutateById(
    sessionId: string,
    userId: string,
    eventType: string,
    eventPayload: Record<string, unknown>,
    mutate: (session: MatchSession) => MatchSession,
  ): Promise<MatchSession> {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      const record = await this.persistence.findById(sessionId);
      if (!record) {
        throw new SessionError("SESSION_NOT_FOUND", "Session not found");
      }

      const nextSession = mutate(record.session);
      const updated = await this.persistence.update(record.sessionVersion, {
        session: nextSession,
        sessionVersion: record.sessionVersion + 1,
        lastEventNumber: record.lastEventNumber + 1,
      });

      if (updated) {
        bestEffortLogAppend(
          this.persistence.appendEvent({
            sessionId,
            eventNumber: updated.lastEventNumber,
            eventType,
            actorUserId: userId,
            payload: eventPayload,
          }),
        );
        return copySession(updated.session);
      }

      attempts += 1;
    }

    throw new SessionError("INVALID_TURN", "Session changed concurrently, retry the latest session state");
  }

  private async mutateByRoomCode(
    roomCode: string,
    userId: string,
    eventType: string,
    eventPayload: Record<string, unknown>,
    mutate: (session: MatchSession) => MatchSession,
  ): Promise<MatchSession> {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      const record = await this.persistence.findByRoomCode(roomCode);
      if (!record) {
        throw new SessionError("ROOM_NOT_FOUND", "Room code does not exist");
      }

      const nextSession = mutate(record.session);
      const updated = await this.persistence.update(record.sessionVersion, {
        session: nextSession,
        sessionVersion: record.sessionVersion + 1,
        lastEventNumber: record.lastEventNumber + 1,
      });

      if (updated) {
        bestEffortLogAppend(
          this.persistence.appendEvent({
            sessionId: updated.session.id,
            eventNumber: updated.lastEventNumber,
            eventType,
            actorUserId: userId,
            payload: eventPayload,
          }),
        );
        return copySession(updated.session);
      }

      attempts += 1;
    }

    throw new SessionError("INVALID_TURN", "Session changed concurrently, retry the latest session state");
  }
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

type SessionRow = {
  id: string;
  room_code: string;
  status: MatchSession["status"];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  session_version: number;
  last_event_number: number;
  session_snapshot: MatchSession;
};

class SupabaseSessionPersistence implements SessionPersistence {
  constructor(private readonly client: SupabaseClient) {}

  async findById(sessionId: string): Promise<StoredSessionRecord | null> {
    const { data, error } = await this.client
      .from("multiplayer_sessions")
      .select("id, room_code, status, created_by_user_id, created_at, updated_at, session_version, last_event_number, session_snapshot")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? this.fromRow(data as SessionRow) : null;
  }

  async findByRoomCode(roomCode: string): Promise<StoredSessionRecord | null> {
    const { data, error } = await this.client
      .from("multiplayer_sessions")
      .select("id, room_code, status, created_by_user_id, created_at, updated_at, session_version, last_event_number, session_snapshot")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? this.fromRow(data as SessionRow) : null;
  }

  async create(record: StoredSessionRecord): Promise<StoredSessionRecord> {
    const row = this.toRow(record);
    const { data, error } = await this.client
      .from("multiplayer_sessions")
      .insert(row)
      .select("id, room_code, status, created_by_user_id, created_at, updated_at, session_version, last_event_number, session_snapshot")
      .single();

    if (error) {
      throw error;
    }

    return this.fromRow(data as SessionRow);
  }

  async update(expectedVersion: number, record: StoredSessionRecord): Promise<StoredSessionRecord | null> {
    const row = this.toRow(record);
    const { data, error } = await this.client
      .from("multiplayer_sessions")
      .update(row)
      .eq("id", record.session.id)
      .eq("session_version", expectedVersion)
      .select("id, room_code, status, created_by_user_id, created_at, updated_at, session_version, last_event_number, session_snapshot");

    if (error) {
      throw error;
    }

    const updatedRow = Array.isArray(data) ? data[0] : null;
    return updatedRow ? this.fromRow(updatedRow as SessionRow) : null;
  }

  async appendEvent(args: {
    sessionId: string;
    eventNumber: number;
    eventType: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client.from("multiplayer_session_events").insert({
      session_id: args.sessionId,
      event_number: args.eventNumber,
      event_type: args.eventType,
      actor_user_id: args.actorUserId,
      payload: args.payload,
    });

    if (error) {
      throw error;
    }
  }

  private fromRow(row: SessionRow): StoredSessionRecord {
    return {
      session: copySession(row.session_snapshot),
      sessionVersion: row.session_version,
      lastEventNumber: row.last_event_number,
    };
  }

  private toRow(record: StoredSessionRecord) {
    const session = copySession(record.session);
    return {
      id: session.id,
      room_code: session.roomCode,
      status: session.status,
      created_by_user_id: session.createdByUserId,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      session_version: record.sessionVersion,
      last_event_number: record.lastEventNumber,
      session_snapshot: session,
    };
  }
}

export async function createPostgresSessionStore(): Promise<MultiplayerSessionStore> {
  const client = await createServiceClient();
  return new PostgresSessionStore(new SupabaseSessionPersistence(client));
}

export { formatSessionStateHint };
