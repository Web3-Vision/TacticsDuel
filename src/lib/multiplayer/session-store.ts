import {
  closeSession,
  createRoom,
  disconnect,
  getSessionForUser,
  joinRoom,
  reconnect,
  submitTurn,
} from "./session-service";
import {
  createPostgresSessionStore,
  type MultiplayerSessionStore,
} from "./session-postgres-store";

const memoryStore: MultiplayerSessionStore = {
  async createRoom(userId, matchId) {
    return createRoom(userId, matchId);
  },
  async joinRoom(userId, roomCode) {
    return joinRoom(userId, roomCode);
  },
  async reconnect(sessionId, userId) {
    return reconnect(sessionId, userId);
  },
  async disconnect(sessionId, userId) {
    return disconnect(sessionId, userId);
  },
  async submitTurn(sessionId, userId, turnNumber, payload) {
    return submitTurn(sessionId, userId, turnNumber, payload);
  },
  async getSessionForUser(sessionId, userId) {
    return getSessionForUser(sessionId, userId);
  },
  async closeSession(sessionId, userId) {
    return closeSession(sessionId, userId);
  },
};

export function getMultiplayerSessionStoreMode(): "memory" | "postgres" {
  return process.env.MULTIPLAYER_SESSION_STORE === "postgres" ? "postgres" : "memory";
}

export async function getMultiplayerSessionStore(): Promise<MultiplayerSessionStore> {
  return getMultiplayerSessionStoreMode() === "postgres" ? createPostgresSessionStore() : memoryStore;
}

export type { MultiplayerSessionStore } from "./session-postgres-store";
