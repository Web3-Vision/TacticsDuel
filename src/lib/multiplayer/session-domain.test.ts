import { describe, expect, it } from "vitest";
import {
  SessionError,
  createRoomState,
  disconnectState,
  joinRoomState,
  reconnectState,
  submitTurnState,
} from "./session-domain";

function expectSessionError(fn: () => void, expectedCode: SessionError["code"]) {
  try {
    fn();
    throw new Error(`Expected SessionError(${expectedCode})`);
  } catch (error) {
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).code).toBe(expectedCode);
  }
}

describe("session-domain helpers", () => {
  it("keeps transitions deterministic for identical command payloads", () => {
    const createdOne = createRoomState({
      sessionId: "session-1",
      roomCode: "ROOM01",
      userId: "home-user",
      matchId: "match-1",
      timestamp: "2026-04-02T20:00:00.000Z",
    });
    const joinedOne = joinRoomState(createdOne, "away-user", "2026-04-02T20:00:01.000Z");
    const afterOne = submitTurnState(
      joinedOne,
      "home-user",
      1,
      {
        action: "formation_change",
        formation: "4-4-2",
      },
      "2026-04-02T20:00:02.000Z",
    );

    const createdTwo = createRoomState({
      sessionId: "session-2",
      roomCode: "ROOM02",
      userId: "home-user",
      matchId: "match-1",
      timestamp: "2026-04-02T20:00:00.000Z",
    });
    const joinedTwo = joinRoomState(createdTwo, "away-user", "2026-04-02T20:00:01.000Z");
    const afterTwo = submitTurnState(
      joinedTwo,
      "home-user",
      1,
      {
        action: "formation_change",
        formation: "4-4-2",
      },
      "2026-04-02T20:00:02.000Z",
    );

    expect(afterOne.turns[0]?.payload.commandHash).toBe(afterTwo.turns[0]?.payload.commandHash);
    expect(afterOne.phase).toBe(joinedOne.phase);
    expect(afterOne.activeSide).toBe("away");
  });

  it("preserves reconnect gating across pure disconnect and reconnect transitions", () => {
    const created = createRoomState({
      sessionId: "session-3",
      roomCode: "ROOM03",
      userId: "home-user",
      timestamp: "2026-04-02T20:10:00.000Z",
    });
    const joined = joinRoomState(created, "away-user", "2026-04-02T20:10:01.000Z");
    const disconnected = disconnectState(joined, "home-user", "2026-04-02T20:10:02.000Z");

    expectSessionError(
      () =>
        submitTurnState(disconnected, "home-user", 1, {
          action: "play_style_change",
          playStyle: "counter",
        }),
      "PARTICIPANT_DISCONNECTED",
    );

    const reconnected = reconnectState(disconnected, "home-user", "2026-04-02T20:10:03.000Z");
    const afterReconnect = submitTurnState(
      reconnected,
      "home-user",
      1,
      {
        action: "play_style_change",
        playStyle: "counter",
      },
      "2026-04-02T20:10:04.000Z",
    );

    expect(afterReconnect.turnNumber).toBe(2);
    expect(afterReconnect.activeSide).toBe("away");
  });
});
