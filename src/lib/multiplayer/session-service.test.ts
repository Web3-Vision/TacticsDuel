import { describe, expect, it } from "vitest";
import {
  SessionError,
  connectMatchParticipant,
  disconnect,
  createRoom,
  getSessionForUser,
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
      action: "phase_transition",
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
      action: "phase_transition",
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

  it("persists deterministic command hashes for identical command payloads", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;

    const createdOne = createRoom(homeUserId, "match-deterministic-1");
    const activeOne = joinRoom(awayUserId, createdOne.roomCode);
    const afterTurnOne = submitTurn(activeOne.id, homeUserId, 1, {
      action: "formation_change",
      formation: "4-4-2",
    });
    const firstHash = String(afterTurnOne.turns.at(-1)?.payload.commandHash ?? "");
    expect(firstHash).toMatch(/^[a-f0-9]{8}$/);

    const createdTwo = createRoom(homeUserId, "match-deterministic-2");
    const activeTwo = joinRoom(awayUserId, createdTwo.roomCode);
    const afterTurnTwo = submitTurn(activeTwo.id, homeUserId, 1, {
      action: "formation_change",
      formation: "4-4-2",
    });
    const secondHash = String(afterTurnTwo.turns.at(-1)?.payload.commandHash ?? "");

    expect(secondHash).toBe(firstHash);
  });

  it("enforces substitution anti-exploit limits", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;
    const created = createRoom(homeUserId, "match-subs-1");
    const activeSession = joinRoom(awayUserId, created.roomCode);

    let turn = 1;
    for (let i = 0; i < 5; i += 1) {
      submitTurn(activeSession.id, homeUserId, turn, {
        action: "substitution",
        outPlayerId: `homeOut${i + 1}`,
        inPlayerId: `homeIn${i + 1}`,
        minute: 55 + i,
      });
      turn += 1;
      submitTurn(activeSession.id, awayUserId, turn, {
        action: "play_style_change",
        playStyle: i % 2 === 0 ? "balanced" : "counter",
      });
      turn += 1;
    }

    expectSessionError(
      () =>
        submitTurn(activeSession.id, homeUserId, turn, {
          action: "substitution",
          outPlayerId: "homeOut6",
          inPlayerId: "homeIn6",
        }),
      "INVALID_ACTION",
    );
  });

  it("rejects duplicate set-piece role assignments inside one command", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;
    const created = createRoom(homeUserId, "match-roles-1");
    const activeSession = joinRoom(awayUserId, created.roomCode);

    expectSessionError(
      () =>
        submitTurn(activeSession.id, homeUserId, 1, {
          action: "set_piece_roles",
          roles: {
            captain: "player01",
            penaltyTaker: "player01",
          },
        }),
      "INVALID_ACTION",
    );
  });

  it("rejects unsupported command actions", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;
    const created = createRoom(homeUserId, "match-action-1");
    const activeSession = joinRoom(awayUserId, created.roomCode);

    expectSessionError(
      () =>
        submitTurn(activeSession.id, homeUserId, 1, {
          action: "teleport_ball",
        }),
      "INVALID_ACTION",
    );
  });

  it("stores normalized command envelope fields on turn payload", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;
    const created = createRoom(homeUserId, "match-envelope-1");
    const activeSession = joinRoom(awayUserId, created.roomCode);

    submitTurn(activeSession.id, homeUserId, 1, {
      action: "play_style_change",
      playStyle: "HIGH_PRESS",
    });

    const session = getSessionForUser(activeSession.id, homeUserId);
    const payload = session.turns[0]?.payload;
    expect(payload.commandType).toBe("play_style_change");
    expect(payload.commandVersion).toBe(1);
    expect(payload.playStyle).toBe("high_press");
    expect(typeof payload.commandHash).toBe("string");
  });

  it("connects both real match participants into the same room by match id", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;
    const matchId = `match-linked-${crypto.randomUUID()}`;

    const awayConnectedFirst = connectMatchParticipant(matchId, awayUserId, homeUserId, awayUserId);
    expect(awayConnectedFirst.matchId).toBe(matchId);
    expect(awayConnectedFirst.status).toBe("waiting");
    expect(awayConnectedFirst.participants).toHaveLength(1);
    expect(awayConnectedFirst.participants[0]?.side).toBe("away");

    const homeConnectedSecond = connectMatchParticipant(matchId, homeUserId, homeUserId, awayUserId);
    expect(homeConnectedSecond.id).toBe(awayConnectedFirst.id);
    expect(homeConnectedSecond.status).toBe("active");
    expect(homeConnectedSecond.phase).toBe("first_half");
    expect(homeConnectedSecond.activeSide).toBe("home");
    expect(homeConnectedSecond.participants.map((participant) => participant.side).sort()).toEqual(["away", "home"]);
  });

  it("accepts tactical command payloads used by the matchday UI", () => {
    const homeUserId = `home-${crypto.randomUUID()}`;
    const awayUserId = `away-${crypto.randomUUID()}`;
    const created = createRoom(homeUserId, "match-tactical-1");
    const activeSession = joinRoom(awayUserId, created.roomCode);

    const updated = submitTurn(activeSession.id, homeUserId, 1, {
      action: "tactical_command",
      commandType: "mentality_shift",
      value: "Attacking",
      phase: "first_half",
    });

    const payload = updated.turns[0]?.payload;
    expect(payload.action).toBe("tactical_command");
    expect(payload.commandType).toBe("mentality_shift");
    expect(payload.commandVersion).toBe(1);
    expect(payload.value).toBe("Attacking");
    expect(payload.phase).toBe("first_half");
    expect(typeof payload.commandHash).toBe("string");
  });
});
