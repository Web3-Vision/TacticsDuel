import { describe, expect, it, vi } from "vitest";
import { PostgresSessionStore, type SessionPersistence, type StoredSessionRecord } from "./session-postgres-store";
import { createRoomState } from "./session-domain";

function createStoredSession(): StoredSessionRecord {
  const created = createRoomState({
    sessionId: "session-pg-1",
    roomCode: "ROOMPG",
    userId: "home-user",
    timestamp: "2026-04-02T20:30:00.000Z",
  });
  return {
    session: {
      ...created,
      status: "active",
      phase: "first_half",
      participants: [
        created.participants[0]!,
        {
          userId: "away-user",
          side: "away",
          connected: true,
          joinedAt: "2026-04-02T20:30:01.000Z",
          lastSeenAt: "2026-04-02T20:30:01.000Z",
        },
      ],
    },
    sessionVersion: 3,
    lastEventNumber: 3,
  };
}

describe("PostgresSessionStore", () => {
  it("retries optimistic concurrency conflicts before succeeding", async () => {
    let current = createStoredSession();
    const appendEvent = vi.fn(async () => undefined);
    const persistence: SessionPersistence = {
      findById: vi.fn(async () => current),
      findByRoomCode: vi.fn(async () => current),
      create: vi.fn(async (record) => record),
      update: vi
        .fn()
        .mockImplementationOnce(async () => null)
        .mockImplementationOnce(async (_expectedVersion: number, record: StoredSessionRecord) => {
          current = record;
          return record;
        }),
      appendEvent,
    };

    const store = new PostgresSessionStore(persistence, 3);
    const session = await store.submitTurn("session-pg-1", "home-user", 1, {
      action: "play_style_change",
      playStyle: "counter",
    });

    expect(session.turnNumber).toBe(2);
    expect(session.activeSide).toBe("away");
    expect(persistence.update).toHaveBeenCalledTimes(2);

    await Promise.resolve();
    expect(appendEvent).toHaveBeenCalledTimes(1);
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-pg-1",
        eventType: "submit_turn",
        eventNumber: 4,
      }),
    );
  });
});
