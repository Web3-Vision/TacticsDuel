import { describe, expect, it } from "vitest";
import { getPlayersByPosition } from "../data/players";
import { simulateFirstHalf, simulateMatch, simulateSecondHalf } from "./match-engine";
import type { MatchConfig, Player, Tactics } from "../types";

const homeTactics: Tactics = {
  formation: "4-3-3",
  mentality: "Balanced",
  tempo: "Normal",
  pressing: "Medium",
  width: "Normal",
};

const awayTactics: Tactics = {
  formation: "4-3-3",
  mentality: "Attacking",
  tempo: "Fast",
  pressing: "High",
  width: "Wide",
};

function mustPlayer(player: Player | undefined): Player {
  if (!player) {
    throw new Error("Expected player to exist for deterministic test fixture");
  }
  return player;
}

function buildSquad(offset: number): Player[] {
  const gks = getPlayersByPosition("GK");
  const cbs = getPlayersByPosition("CB");
  const lbs = getPlayersByPosition("LB");
  const rbs = getPlayersByPosition("RB");
  const cms = getPlayersByPosition("CM");
  const lws = getPlayersByPosition("LW");
  const rws = getPlayersByPosition("RW");
  const sts = getPlayersByPosition("ST");

  return [
    mustPlayer(gks[offset]),
    mustPlayer(cbs[offset * 2]),
    mustPlayer(cbs[offset * 2 + 1]),
    mustPlayer(lbs[offset]),
    mustPlayer(rbs[offset]),
    mustPlayer(cms[offset * 3]),
    mustPlayer(cms[offset * 3 + 1]),
    mustPlayer(cms[offset * 3 + 2]),
    mustPlayer(lws[offset]),
    mustPlayer(rws[offset]),
    mustPlayer(sts[offset]),
  ];
}

function buildConfig(): MatchConfig {
  return {
    homeSquad: buildSquad(0),
    awaySquad: buildSquad(1),
    homeTactics,
    awayTactics,
    matchType: "friendly",
  };
}

describe("match engine determinism", () => {
  it("produces identical full-match output for same seed", () => {
    const config = buildConfig();
    const firstRun = simulateMatch(config, 1337);
    const secondRun = simulateMatch(config, 1337);

    expect(secondRun).toEqual(firstRun);
  });

  it("replays second half identically from saved rng state", () => {
    const config = buildConfig();
    const firstHalf = simulateFirstHalf(config, 998877);

    const replayA = simulateSecondHalf(
      config,
      firstHalf.result,
      null,
      null,
      firstHalf.seed,
      firstHalf.rngState,
    );
    const replayB = simulateSecondHalf(
      config,
      firstHalf.result,
      null,
      null,
      firstHalf.seed,
      firstHalf.rngState,
    );

    expect(replayA).toEqual(replayB);
    expect(replayA.events.at(-1)?.type).toBe("fulltime");
  });
});
