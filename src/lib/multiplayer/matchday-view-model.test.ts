import { describe, expect, it } from "vitest";
import { buildReconnectViewModel, buildTimeline, fixtureStatusSummary, nextPhase, type MatchdaySessionView } from "./matchday-view-model";

describe("matchday view model", () => {
  it("renders timeline progression from current phase", () => {
    const timeline = buildTimeline("halftime");

    expect(timeline.map((item) => item.phase)).toEqual([
      "lobby",
      "first_half",
      "halftime",
      "second_half",
      "fulltime",
    ]);

    expect(timeline[0]?.state).toBe("completed");
    expect(timeline[1]?.state).toBe("completed");
    expect(timeline[2]?.state).toBe("current");
    expect(timeline[3]?.state).toBe("upcoming");
  });

  it("computes phase transitions", () => {
    expect(nextPhase("lobby")).toBe("first_half");
    expect(nextPhase("first_half")).toBe("halftime");
    expect(nextPhase("halftime")).toBe("second_half");
    expect(nextPhase("second_half")).toBe("fulltime");
    expect(nextPhase("fulltime")).toBeNull();
  });

  it("tracks reconnect state transitions", () => {
    const disconnectedLive: MatchdaySessionView = {
      id: "session-1",
      roomCode: "ROOM42",
      status: "active",
      turnNumber: 3,
      phase: "second_half",
      activeSide: "away",
      createdByUserId: "user-home",
      participants: [
        {
          userId: "user-home",
          side: "home",
          connected: true,
          joinedAt: "2026-03-31T10:00:00.000Z",
          lastSeenAt: "2026-03-31T10:03:00.000Z",
        },
        {
          userId: "user-away",
          side: "away",
          connected: false,
          joinedAt: "2026-03-31T10:00:10.000Z",
          lastSeenAt: "2026-03-31T10:02:00.000Z",
        },
      ],
      you: {
        userId: "user-away",
        side: "away",
        connected: false,
      },
    };

    expect(buildReconnectViewModel(null, false)).toMatchObject({
      state: "needs_session",
      canReconnect: false,
    });

    expect(buildReconnectViewModel(null, true)).toMatchObject({
      state: "ready",
      canReconnect: true,
    });

    expect(buildReconnectViewModel(disconnectedLive, true)).toMatchObject({
      state: "ready",
      canReconnect: true,
    });

    expect(
      buildReconnectViewModel(
        {
          ...disconnectedLive,
          you: { ...disconnectedLive.you!, connected: true },
        },
        true,
      ),
    ).toMatchObject({
      state: "already_connected",
      canReconnect: false,
    });

    expect(
      buildReconnectViewModel(
        {
          ...disconnectedLive,
          status: "completed",
          phase: "fulltime",
        },
        true,
      ),
    ).toMatchObject({
      state: "session_completed",
      canReconnect: false,
    });
  });

  it("provides fixture status summary", () => {
    expect(fixtureStatusSummary(null)).toBe("No active fixture selected");

    const waiting: MatchdaySessionView = {
      id: "session-2",
      roomCode: "ROOM88",
      status: "waiting",
      turnNumber: 1,
      phase: "lobby",
      activeSide: "home",
      createdByUserId: "user-home",
      participants: [],
      you: null,
    };

    expect(fixtureStatusSummary(waiting)).toBe("Waiting for opponent to join");
    expect(fixtureStatusSummary({ ...waiting, status: "active", phase: "first_half" })).toBe("Live in First Half");
    expect(fixtureStatusSummary({ ...waiting, status: "completed", phase: "fulltime" })).toBe("Fixture completed");
  });
});
