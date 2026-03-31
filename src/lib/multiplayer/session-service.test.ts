import { describe, expect, it } from "vitest";
import {
  SessionError,
  disconnect,
  createRoom,
  joinRoom,
  reconnect,
  submitTurn,
} from "./session-service";

function expectSessionError(fn: () => void, expectedCode: SessionError["code"]) {
  try {
    fn();
    throw new Error(`Expected SessionError(${expectedCode})`);
  } catch (error) {
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).code).toBe(expectedCode);
  }
}

describe("multiplayer session service smoke tests", () => {
  it("supports room creation, join, and alternating turn flow", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;

    const created = createRoom(homeUserId, "match-1");
    expect(created.status).toBe("waiting");
    expect(created.phase).toBe("lobby");
    expect(created.participants).toHaveLength(1);

    const activeSession = joinRoom(awayUserId, created.roomCode);
    expect(activeSession.status).toBe("active");
    expect(activeSession.phase).toBe("first_half");
    expect(activeSession.participants).toHaveLength(2);

    const afterHomeTurn = submitTurn(activeSession.id, homeUserId, 1, {
      action: "attack",
      transitionToPhase: "halftime",
    });
    expect(afterHomeTurn.turnNumber).toBe(2);
    expect(afterHomeTurn.activeSide).toBe("away");
    expect(afterHomeTurn.phase).toBe("halftime");

    expectSessionError(
      () => submitTurn(activeSession.id, homeUserId, 2, { action: "play" }),
      "NOT_YOUR_TURN",
    );

    const afterAwayTurn = submitTurn(activeSession.id, awayUserId, 2, {
      action: "counter",
      transitionToPhase: "second_half",
    });
    expect(afterAwayTurn.turnNumber).toBe(3);
    expect(afterAwayTurn.activeSide).toBe("home");
    expect(afterAwayTurn.phase).toBe("second_half");
  });

  it("rejects invalid phase transitions in turn payload", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;

    const created = createRoom(homeUserId, "match-2");
    const activeSession = joinRoom(awayUserId, created.roomCode);

    expectSessionError(
      () =>
        submitTurn(activeSession.id, homeUserId, 1, {
          action: "bad-transition",
          transitionToPhase: "lobby",
        }),
      "INVALID_ACTION",
    );
  });

  it("tracks participant connectivity during disconnect and reconnect flows", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;

    const created = createRoom(homeUserId, "match-3");
    const activeSession = joinRoom(awayUserId, created.roomCode);
    const awayBeforeDisconnect = activeSession.participants.find((participant) => participant.userId === awayUserId);
    expect(awayBeforeDisconnect?.connected).toBe(true);

    const disconnected = disconnect(activeSession.id, awayUserId);
    const awayAfterDisconnect = disconnected.participants.find((participant) => participant.userId === awayUserId);
    expect(awayAfterDisconnect?.connected).toBe(false);

    const reconnected = reconnect(activeSession.id, awayUserId);
    const awayAfterReconnect = reconnected.participants.find((participant) => participant.userId === awayUserId);
    expect(awayAfterReconnect?.connected).toBe(true);
  });
});
