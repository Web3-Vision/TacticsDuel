import { describe, expect, it } from "vitest";
import type { MatchEvent, MatchStats } from "@/lib/types";
import { buildNarrativeArtifacts } from "./narrative-pipeline";

const baseStats: MatchStats = {
  homePossession: 52,
  awayPossession: 48,
  homeShots: 10,
  awayShots: 8,
  homeOnTarget: 6,
  awayOnTarget: 4,
  homeCorners: 5,
  awayCorners: 3,
  homeFouls: 9,
  awayFouls: 11,
  homeYellowCards: 1,
  awayYellowCards: 2,
  homeRedCards: 0,
  awayRedCards: 1,
  homePassAccuracy: 84,
  awayPassAccuracy: 79,
};

const baseEvents: MatchEvent[] = [
  {
    minute: 1,
    type: "kickoff",
    team: "neutral",
    description: "Kick-off.",
    isKeyEvent: true,
  },
  {
    minute: 22,
    type: "goal",
    team: "home",
    primaryPlayer: "A. Striker",
    description: "A. Striker fires home.",
    isKeyEvent: true,
  },
  {
    minute: 70,
    type: "red_card",
    team: "away",
    primaryPlayer: "B. Defender",
    description: "B. Defender sent off.",
    isKeyEvent: true,
  },
  {
    minute: 90,
    type: "fulltime",
    team: "neutral",
    description: "Full time.",
    isKeyEvent: true,
  },
];

describe("narrative pipeline", () => {
  it("is deterministic for identical match input", () => {
    const input = {
      matchId: "match-1",
      matchType: "ranked" as const,
      homeUserId: "user-home",
      awayUserId: "user-away",
      homeScore: 2,
      awayScore: 1,
      stats: baseStats,
      events: baseEvents,
    };

    const first = buildNarrativeArtifacts(input);
    const second = buildNarrativeArtifacts(input);

    expect(second).toEqual(first);
    expect(first.roundRecap.event_digest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("changes digest and stories when event stream changes", () => {
    const baseline = buildNarrativeArtifacts({
      matchId: "match-2",
      matchType: "ranked",
      homeUserId: "user-home",
      awayUserId: "user-away",
      homeScore: 1,
      awayScore: 1,
      stats: baseStats,
      events: baseEvents,
    });

    const modified = buildNarrativeArtifacts({
      matchId: "match-2",
      matchType: "ranked",
      homeUserId: "user-home",
      awayUserId: "user-away",
      homeScore: 1,
      awayScore: 1,
      stats: baseStats,
      events: baseEvents.filter((event) => event.type !== "red_card"),
    });

    expect(modified.roundRecap.event_digest).not.toBe(baseline.roundRecap.event_digest);
    expect(baseline.newsItems.some((item) => item.story_key === "discipline-alert")).toBe(true);
    expect(modified.newsItems.some((item) => item.story_key === "discipline-alert")).toBe(false);
  });
});
