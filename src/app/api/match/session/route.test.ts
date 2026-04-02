import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionError } from "../../../../lib/multiplayer/session-domain";
import { createRoomState, formatSessionStateHint, joinRoomState } from "../../../../lib/multiplayer/session-domain";

const createClientMock = vi.fn();
const getStoreMock = vi.fn();
const logDomainEventMock = vi.fn();
const recordApiResultMock = vi.fn();

vi.mock("../../../../lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("../../../../lib/multiplayer/session-store", () => ({
  getMultiplayerSessionStore: getStoreMock,
}));

vi.mock("../../../../lib/observability/realtime", () => ({
  createTraceId: () => "trace-route-test",
  logDomainEvent: logDomainEventMock,
  recordApiResult: recordApiResultMock,
}));

describe("/api/match/session route", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getStoreMock.mockReset();
    logDomainEventMock.mockReset();
    recordApiResultMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns authoritative recovery hints when turn submission is rejected", async () => {
    const created = createRoomState({
      sessionId: "session-route-1",
      roomCode: "ROOMR1",
      userId: "home-user",
      timestamp: "2026-04-02T21:00:00.000Z",
    });
    const active = joinRoomState(created, "away-user", "2026-04-02T21:00:01.000Z");

    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "home-user" } } }),
      },
    });

    getStoreMock.mockResolvedValue({
      submitTurn: async () => {
        throw new SessionError("PARTICIPANT_DISCONNECTED", "Reconnect before submitting commands");
      },
      getSessionForUser: async () => ({
        ...active,
        participants: active.participants.map((participant) =>
          participant.userId === "home-user" ? { ...participant, connected: false } : participant,
        ),
      }),
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/match/session", {
      method: "POST",
      body: JSON.stringify({
        action: "submit_turn",
        sessionId: "session-route-1",
        turnNumber: 1,
        payload: {
          action: "play_style_change",
          playStyle: "counter",
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PARTICIPANT_DISCONNECTED");
    expect(body.sessionState).toEqual(
      formatSessionStateHint(
        {
          ...active,
          participants: active.participants.map((participant) =>
            participant.userId === "home-user" ? { ...participant, connected: false } : participant,
          ),
        },
        "home-user",
      ),
    );
    expect(logDomainEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "turn_submission_rejected",
      }),
    );
  });
});
