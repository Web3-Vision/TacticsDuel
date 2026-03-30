import type {
  Player,
  Tactics,
  MatchConfig,
  MatchResult,
  MatchEvent,
  MatchStats,
} from "../types";
import {
  calculateTeamRatings,
  applyTacticalModifiers,
  type ModifiedRatings,
} from "./team-strength";
import { generateCommentary, generateAtmosphericCommentary } from "./match-events";

// Seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPlayer(squad: Player[], positions: string[], rng: () => number): Player {
  const candidates = squad.filter((p) => positions.includes(p.position));
  if (candidates.length === 0) return squad[Math.floor(rng() * squad.length)];
  return candidates[Math.floor(rng() * candidates.length)];
}

function pickAttacker(squad: Player[], rng: () => number): Player {
  return pickPlayer(squad, ["ST", "LW", "RW"], rng);
}

function pickMidfielder(squad: Player[], rng: () => number): Player {
  return pickPlayer(squad, ["CM"], rng);
}

function pickDefender(squad: Player[], rng: () => number): Player {
  return pickPlayer(squad, ["CB", "LB", "RB"], rng);
}

function pickGK(squad: Player[], rng: () => number): Player {
  return pickPlayer(squad, ["GK"], rng);
}

// Tactical intervention presets
export const TACTICAL_PRESETS = {
  protectLead: {
    label: "Protect Lead",
    mentality: "Defensive" as const,
    tempo: "Slow" as const,
    pressing: "Low" as const,
    width: "Narrow" as const,
  },
  chaseGoal: {
    label: "Chase Goal",
    mentality: "All-out Attack" as const,
    tempo: "Fast" as const,
    pressing: "High" as const,
    width: "Wide" as const,
  },
  controlGame: {
    label: "Control Game",
    mentality: "Balanced" as const,
    tempo: "Normal" as const,
    pressing: "Medium" as const,
    width: "Normal" as const,
  },
  overloadMidfield: {
    label: "Overload Midfield",
    mentality: "Attacking" as const,
    tempo: "Normal" as const,
    pressing: "Medium" as const,
    width: "Narrow" as const,
  },
};

export interface TacticalOverride {
  mentality?: Tactics["mentality"];
  tempo?: Tactics["tempo"];
  pressing?: Tactics["pressing"];
  width?: Tactics["width"];
}

export interface PhaseResult {
  events: MatchEvent[];
  homeScore: number;
  awayScore: number;
  homePossCount: number;
  awayPossCount: number;
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  playerEvents: Record<string, { positive: number; negative: number; involved: number }>;
}

function simulatePhase(
  startMinute: number,
  endMinute: number,
  config: MatchConfig,
  homeTactics: Tactics,
  awayTactics: Tactics,
  rng: () => number,
  prevState?: PhaseResult,
): PhaseResult {
  const homeRaw = calculateTeamRatings(config.homeSquad);
  const awayRaw = calculateTeamRatings(config.awaySquad);
  const homeRatings = applyTacticalModifiers(homeRaw, homeTactics);
  const awayRatings = applyTacticalModifiers(awayRaw, awayTactics);

  const events: MatchEvent[] = [];
  let homeScore = prevState?.homeScore ?? 0;
  let awayScore = prevState?.awayScore ?? 0;
  let homePossCount = prevState?.homePossCount ?? 0;
  let awayPossCount = prevState?.awayPossCount ?? 0;
  let homeShots = prevState?.homeShots ?? 0;
  let awayShots = prevState?.awayShots ?? 0;
  let homeOnTarget = prevState?.homeOnTarget ?? 0;
  let awayOnTarget = prevState?.awayOnTarget ?? 0;
  let homeCorners = prevState?.homeCorners ?? 0;
  let awayCorners = prevState?.awayCorners ?? 0;
  let homeFouls = prevState?.homeFouls ?? 0;
  let awayFouls = prevState?.awayFouls ?? 0;
  let homeYellows = prevState?.homeYellows ?? 0;
  let awayYellows = prevState?.awayYellows ?? 0;
  let homeReds = prevState?.homeReds ?? 0;
  let awayReds = prevState?.awayReds ?? 0;
  const playerEvents = prevState?.playerEvents
    ? JSON.parse(JSON.stringify(prevState.playerEvents))
    : {} as Record<string, { positive: number; negative: number; involved: number }>;

  function trackPlayer(id: string, type: "positive" | "negative" | "involved") {
    if (!playerEvents[id]) playerEvents[id] = { positive: 0, negative: 0, involved: 0 };
    playerEvents[id][type]++;
  }

  const homeTeam = "Home";
  const awayTeam = "Away";

  function makeVars(team: "home" | "away", player: Player, player2?: Player) {
    return {
      player: player.name,
      player2: player2?.name ?? "",
      team: team === "home" ? homeTeam : awayTeam,
      opponent: team === "home" ? awayTeam : homeTeam,
      minute: 0,
      score: `${homeScore}-${awayScore}`,
    };
  }

  for (let minute = startMinute; minute <= endMinute; minute++) {
    const homeMidStr = homeRatings.midfield;
    const awayMidStr = awayRatings.midfield;
    const homePossChance = homeMidStr / (homeMidStr + awayMidStr);
    const hasPossession = rng() < homePossChance;
    const possTeam: "home" | "away" = hasPossession ? "home" : "away";

    if (hasPossession) homePossCount++;
    else awayPossCount++;

    const atkRatings = possTeam === "home" ? homeRatings : awayRatings;
    const defRatings = possTeam === "home" ? awayRatings : homeRatings;
    const atkSquad = possTeam === "home" ? config.homeSquad : config.awaySquad;
    const defSquad = possTeam === "home" ? config.awaySquad : config.homeSquad;

    let eventChance = 0.28;
    if (minute > 80) eventChance += 0.06;
    if (minute > 85) eventChance += 0.04;
    eventChance *= atkRatings.eventRate;

    if (rng() > eventChance) {
      if (minute % 12 === 0 || (minute > 75 && minute % 5 === 0)) {
        const totalPoss = homePossCount + awayPossCount;
        const commentary = generateAtmosphericCommentary(
          {
            minute,
            homeScore,
            awayScore,
            homeTeam,
            awayTeam,
            homePossession: totalPoss > 0 ? (homePossCount / totalPoss) * 100 : 50,
          },
          rng
        );
        if (commentary) {
          events.push({
            minute,
            type: "commentary",
            team: "neutral",
            description: commentary,
            isKeyEvent: false,
          });
        }
      }
      continue;
    }

    // Build-up
    const buildUpSuccess = rng() < 0.55 + (atkRatings.midfield - defRatings.midfield) * 0.003;

    if (!buildUpSuccess) {
      if (rng() < 0.4) {
        const defender = pickDefender(defSquad, rng);
        const midfielder = pickMidfielder(atkSquad, rng);
        const isTackle = rng() < 0.5;
        const vars = {
          ...makeVars(possTeam === "home" ? "away" : "home", defender, midfielder),
          minute,
        };
        trackPlayer(defender.id, "positive");

        events.push({
          minute,
          type: isTackle ? "tackle" : "interception",
          team: possTeam === "home" ? "away" : "home",
          primaryPlayer: defender.name,
          description: generateCommentary(
            isTackle ? "tackle" : "interception",
            vars,
            rng
          ),
          isKeyEvent: false,
        });
      }
      continue;
    }

    // Chance creation
    const creator = rng() < 0.6 ? pickMidfielder(atkSquad, rng) : pickAttacker(atkSquad, rng);
    const attacker = pickAttacker(atkSquad, rng);
    const chanceQuality =
      (creator.passing * 0.4 + creator.dribbling * 0.3 + attacker.pace * 0.3) / 99;
    const defBlock =
      (defRatings.defense + defRatings.compactness) / 100 * 0.4;

    const chanceSucceeds = rng() < chanceQuality * 0.6 - defBlock * 0.3;

    if (!chanceSucceeds) {
      if (rng() < 0.3) {
        const defender = pickDefender(defSquad, rng);
        trackPlayer(defender.id, "positive");
        events.push({
          minute,
          type: "clearance",
          team: possTeam === "home" ? "away" : "home",
          primaryPlayer: defender.name,
          description: `${defender.name} clears the danger.`,
          isKeyEvent: false,
        });
      }
      continue;
    }

    trackPlayer(creator.id, "positive");
    trackPlayer(attacker.id, "involved");

    if (rng() < 0.5) {
      const vars = { ...makeVars(possTeam, creator, attacker), minute };
      events.push({
        minute,
        type: "chance_created",
        team: possTeam,
        primaryPlayer: creator.name,
        secondaryPlayer: attacker.name,
        description: generateCommentary("chance_created", vars, rng),
        isKeyEvent: false,
      });
    }

    // Foul chance
    if (rng() < 0.12) {
      const fouler = pickDefender(defSquad, rng);
      if (possTeam === "home") awayFouls++;
      else homeFouls++;
      trackPlayer(fouler.id, "negative");

      const vars = { ...makeVars(possTeam === "home" ? "away" : "home", fouler, attacker), minute };
      events.push({
        minute,
        type: "foul",
        team: possTeam === "home" ? "away" : "home",
        primaryPlayer: fouler.name,
        secondaryPlayer: attacker.name,
        description: generateCommentary("foul", vars, rng),
        isKeyEvent: false,
      });

      if (rng() < 0.3) {
        if (possTeam === "home") awayYellows++;
        else homeYellows++;
        events.push({
          minute,
          type: "yellow_card",
          team: possTeam === "home" ? "away" : "home",
          primaryPlayer: fouler.name,
          description: generateCommentary(
            "yellow_card",
            { ...makeVars(possTeam === "home" ? "away" : "home", fouler), minute },
            rng
          ),
          isKeyEvent: true,
        });

        if (rng() < 0.03) {
          if (possTeam === "home") awayReds++;
          else homeReds++;
          events.push({
            minute,
            type: "red_card",
            team: possTeam === "home" ? "away" : "home",
            primaryPlayer: fouler.name,
            description: generateCommentary(
              "red_card",
              { ...makeVars(possTeam === "home" ? "away" : "home", fouler), minute },
              rng
            ),
            isKeyEvent: true,
          });
        }
      }

      if (rng() < 0.2) {
        if (possTeam === "home") homeCorners++;
        else awayCorners++;
      }
      continue;
    }

    // Shot
    if (possTeam === "home") homeShots++;
    else awayShots++;

    const shotQuality =
      (attacker.shooting * 0.5 + attacker.dribbling * 0.2 + attacker.pace * 0.15 + creator.passing * 0.15) / 99;

    const onTargetChance = 0.40 + shotQuality * 0.15;
    const isOnTarget = rng() < onTargetChance;

    if (!isOnTarget) {
      trackPlayer(attacker.id, "negative");
      const vars = { ...makeVars(possTeam, attacker), minute };
      events.push({
        minute,
        type: "shot_missed",
        team: possTeam,
        primaryPlayer: attacker.name,
        description: generateCommentary("shot_missed", vars, rng),
        isKeyEvent: false,
      });

      if (rng() < 0.15) {
        if (possTeam === "home") homeCorners++;
        else awayCorners++;
        events.push({
          minute,
          type: "corner",
          team: possTeam,
          description: generateCommentary(
            "corner",
            { ...makeVars(possTeam, attacker), minute },
            rng
          ),
          isKeyEvent: false,
        });
      }
      continue;
    }

    if (possTeam === "home") homeOnTarget++;
    else awayOnTarget++;

    // Block chance
    const blockChance = 0.15 + (defRatings.compactness > 0 ? 0.05 : 0);
    if (rng() < blockChance) {
      const blocker = pickDefender(defSquad, rng);
      trackPlayer(blocker.id, "positive");
      const vars = { ...makeVars(possTeam, attacker), minute };
      events.push({
        minute,
        type: "shot_blocked",
        team: possTeam,
        primaryPlayer: attacker.name,
        description: generateCommentary("shot_blocked", vars, rng),
        isKeyEvent: false,
      });
      continue;
    }

    // Goal or save
    const gk = pickGK(defSquad, rng);
    const gkStrength = gk.goalkeeping / 99;
    const goalChance =
      (0.24 + shotQuality * 0.12 - gkStrength * 0.10) * atkRatings.conversionRate;

    if (rng() < goalChance) {
      if (possTeam === "home") homeScore++;
      else awayScore++;

      trackPlayer(attacker.id, "positive");
      trackPlayer(attacker.id, "positive");
      trackPlayer(creator.id, "positive");

      const vars = {
        ...makeVars(possTeam, attacker, creator),
        minute,
        score: `${homeScore}-${awayScore}`,
      };

      events.push({
        minute,
        type: "goal",
        team: possTeam,
        primaryPlayer: attacker.name,
        secondaryPlayer: creator.id !== attacker.id ? creator.name : undefined,
        description: generateCommentary("goal", vars, rng),
        isKeyEvent: true,
      });
    } else {
      trackPlayer(gk.id, "positive");
      const vars = { ...makeVars(possTeam, attacker), minute };
      events.push({
        minute,
        type: "shot_saved",
        team: possTeam,
        primaryPlayer: attacker.name,
        description: generateCommentary("shot_saved", vars, rng),
        isKeyEvent: false,
      });

      if (rng() < 0.3) {
        if (possTeam === "home") homeCorners++;
        else awayCorners++;
      }
    }
  }

  return {
    events,
    homeScore,
    awayScore,
    homePossCount,
    awayPossCount,
    homeShots,
    awayShots,
    homeOnTarget,
    awayOnTarget,
    homeCorners,
    awayCorners,
    homeFouls,
    awayFouls,
    homeYellows,
    awayYellows,
    homeReds,
    awayReds,
    playerEvents,
  };
}

// Full match simulation (backward compatible)
export function simulateMatch(config: MatchConfig, seed?: number): MatchResult {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 2147483647));

  const events: MatchEvent[] = [];

  // Kickoff
  events.push({
    minute: 0,
    type: "kickoff",
    team: "neutral",
    description: "The referee blows the whistle. Kick-off!",
    isKeyEvent: true,
  });

  // First half (1-45)
  const firstHalf = simulatePhase(1, 45, config, config.homeTactics, config.awayTactics, rng);
  events.push(...firstHalf.events);

  // Halftime
  events.push({
    minute: 45,
    type: "halftime",
    team: "neutral",
    description: `Half time. ${firstHalf.homeScore}-${firstHalf.awayScore}`,
    isKeyEvent: true,
  });

  // Apply conditional HT tactics
  let secondHalfHomeTactics = { ...config.homeTactics };
  let secondHalfAwayTactics = { ...config.awayTactics };

  if (firstHalf.homeScore < firstHalf.awayScore && config.homeTactics.htIfLosingMentality) {
    secondHalfHomeTactics = { ...secondHalfHomeTactics, mentality: config.homeTactics.htIfLosingMentality };
  } else if (firstHalf.homeScore > firstHalf.awayScore && config.homeTactics.htIfWinningMentality) {
    secondHalfHomeTactics = { ...secondHalfHomeTactics, mentality: config.homeTactics.htIfWinningMentality };
  }

  if (firstHalf.awayScore < firstHalf.homeScore && config.awayTactics.htIfLosingMentality) {
    secondHalfAwayTactics = { ...secondHalfAwayTactics, mentality: config.awayTactics.htIfLosingMentality };
  } else if (firstHalf.awayScore > firstHalf.homeScore && config.awayTactics.htIfWinningMentality) {
    secondHalfAwayTactics = { ...secondHalfAwayTactics, mentality: config.awayTactics.htIfWinningMentality };
  }

  // Second half (46-90)
  const secondHalf = simulatePhase(46, 90, config, secondHalfHomeTactics, secondHalfAwayTactics, rng, firstHalf);
  events.push(...secondHalf.events);

  // Full time
  events.push({
    minute: 90,
    type: "fulltime",
    team: "neutral",
    description: `Full time! ${secondHalf.homeScore}-${secondHalf.awayScore}`,
    isKeyEvent: true,
  });

  // Stats
  const totalPoss = secondHalf.homePossCount + secondHalf.awayPossCount;
  const stats: MatchStats = {
    homePossession: totalPoss > 0 ? Math.round((secondHalf.homePossCount / totalPoss) * 100) : 50,
    awayPossession: totalPoss > 0 ? Math.round((secondHalf.awayPossCount / totalPoss) * 100) : 50,
    homeShots: secondHalf.homeShots,
    awayShots: secondHalf.awayShots,
    homeOnTarget: secondHalf.homeOnTarget,
    awayOnTarget: secondHalf.awayOnTarget,
    homeCorners: secondHalf.homeCorners,
    awayCorners: secondHalf.awayCorners,
    homeFouls: secondHalf.homeFouls,
    awayFouls: secondHalf.awayFouls,
    homeYellowCards: secondHalf.homeYellows,
    awayYellowCards: secondHalf.awayYellows,
    homeRedCards: secondHalf.homeReds,
    awayRedCards: secondHalf.awayReds,
    homePassAccuracy: Math.round(65 + (secondHalf.homePossCount / Math.max(1, totalPoss)) * 20 + rng() * 8),
    awayPassAccuracy: Math.round(65 + (secondHalf.awayPossCount / Math.max(1, totalPoss)) * 20 + rng() * 8),
  };

  // Player ratings
  const allPlayers = [...config.homeSquad, ...config.awaySquad];
  const playerRatings: Record<string, number> = {};
  let bestRating = 0;
  let motm = allPlayers[0]?.id ?? "";

  for (const p of allPlayers) {
    const pe = secondHalf.playerEvents[p.id] ?? { positive: 0, negative: 0, involved: 0 };
    let rating = 6.0 + pe.positive * 0.5 - pe.negative * 0.3 + pe.involved * 0.1;
    rating = Math.max(1, Math.min(10, Math.round(rating * 10) / 10));
    playerRatings[p.id] = rating;

    if (rating > bestRating) {
      bestRating = rating;
      motm = p.id;
    }
  }

  return {
    events,
    homeScore: secondHalf.homeScore,
    awayScore: secondHalf.awayScore,
    stats,
    playerRatings,
    manOfTheMatch: motm,
  };
}

// Interactive match simulation (for client-side AI matches with tactical interventions)
export function simulateFirstHalf(config: MatchConfig, seed?: number): {
  result: PhaseResult;
  events: MatchEvent[];
  seed: number;
} {
  const actualSeed = seed ?? Math.floor(Math.random() * 2147483647);
  const rng = mulberry32(actualSeed);

  const events: MatchEvent[] = [{
    minute: 0,
    type: "kickoff",
    team: "neutral",
    description: "The referee blows the whistle. Kick-off!",
    isKeyEvent: true,
  }];

  const firstHalf = simulatePhase(1, 45, config, config.homeTactics, config.awayTactics, rng);
  events.push(...firstHalf.events);

  events.push({
    minute: 45,
    type: "halftime",
    team: "neutral",
    description: `Half time. ${firstHalf.homeScore}-${firstHalf.awayScore}`,
    isKeyEvent: true,
  });

  return { result: firstHalf, events, seed: actualSeed };
}

export function simulateSecondHalf(
  config: MatchConfig,
  firstHalfResult: PhaseResult,
  homeTacticsOverride: TacticalOverride | null,
  awayTacticsOverride: TacticalOverride | null,
  seed: number,
): MatchResult {
  // We need to recreate the RNG in the same state
  // Since we used the same seed, we replay through first half RNG calls
  const rng = mulberry32(seed);
  // Fast-forward RNG through first half (approximate — consume same number of random calls)
  for (let i = 0; i < 500; i++) rng();

  let homeTactics = { ...config.homeTactics };
  let awayTactics = { ...config.awayTactics };

  if (homeTacticsOverride) {
    homeTactics = {
      ...homeTactics,
      ...(homeTacticsOverride.mentality && { mentality: homeTacticsOverride.mentality }),
      ...(homeTacticsOverride.tempo && { tempo: homeTacticsOverride.tempo }),
      ...(homeTacticsOverride.pressing && { pressing: homeTacticsOverride.pressing }),
      ...(homeTacticsOverride.width && { width: homeTacticsOverride.width }),
    };
  } else {
    // Apply conditional HT tactics
    if (firstHalfResult.homeScore < firstHalfResult.awayScore && config.homeTactics.htIfLosingMentality) {
      homeTactics = { ...homeTactics, mentality: config.homeTactics.htIfLosingMentality };
    } else if (firstHalfResult.homeScore > firstHalfResult.awayScore && config.homeTactics.htIfWinningMentality) {
      homeTactics = { ...homeTactics, mentality: config.homeTactics.htIfWinningMentality };
    }
  }

  if (awayTacticsOverride) {
    awayTactics = {
      ...awayTactics,
      ...(awayTacticsOverride.mentality && { mentality: awayTacticsOverride.mentality }),
      ...(awayTacticsOverride.tempo && { tempo: awayTacticsOverride.tempo }),
      ...(awayTacticsOverride.pressing && { pressing: awayTacticsOverride.pressing }),
      ...(awayTacticsOverride.width && { width: awayTacticsOverride.width }),
    };
  } else {
    if (firstHalfResult.awayScore < firstHalfResult.homeScore && config.awayTactics.htIfLosingMentality) {
      awayTactics = { ...awayTactics, mentality: config.awayTactics.htIfLosingMentality };
    } else if (firstHalfResult.awayScore > firstHalfResult.homeScore && config.awayTactics.htIfWinningMentality) {
      awayTactics = { ...awayTactics, mentality: config.awayTactics.htIfWinningMentality };
    }
  }

  // Add tactical change events
  const events: MatchEvent[] = [];

  if (homeTacticsOverride) {
    events.push({
      minute: 46,
      type: "commentary",
      team: "home",
      description: `Tactical change: ${homeTactics.mentality} mentality, ${homeTactics.tempo} tempo`,
      isKeyEvent: true,
    });
  }

  const secondHalf = simulatePhase(46, 90, config, homeTactics, awayTactics, rng, firstHalfResult);
  events.push(...secondHalf.events);

  events.push({
    minute: 90,
    type: "fulltime",
    team: "neutral",
    description: `Full time! ${secondHalf.homeScore}-${secondHalf.awayScore}`,
    isKeyEvent: true,
  });

  const totalPoss = secondHalf.homePossCount + secondHalf.awayPossCount;
  const stats: MatchStats = {
    homePossession: totalPoss > 0 ? Math.round((secondHalf.homePossCount / totalPoss) * 100) : 50,
    awayPossession: totalPoss > 0 ? Math.round((secondHalf.awayPossCount / totalPoss) * 100) : 50,
    homeShots: secondHalf.homeShots,
    awayShots: secondHalf.awayShots,
    homeOnTarget: secondHalf.homeOnTarget,
    awayOnTarget: secondHalf.awayOnTarget,
    homeCorners: secondHalf.homeCorners,
    awayCorners: secondHalf.awayCorners,
    homeFouls: secondHalf.homeFouls,
    awayFouls: secondHalf.awayFouls,
    homeYellowCards: secondHalf.homeYellows,
    awayYellowCards: secondHalf.awayYellows,
    homeRedCards: secondHalf.homeReds,
    awayRedCards: secondHalf.awayReds,
    homePassAccuracy: Math.round(65 + (secondHalf.homePossCount / Math.max(1, totalPoss)) * 20 + rng() * 8),
    awayPassAccuracy: Math.round(65 + (secondHalf.awayPossCount / Math.max(1, totalPoss)) * 20 + rng() * 8),
  };

  const allPlayers = [...config.homeSquad, ...config.awaySquad];
  const playerRatings: Record<string, number> = {};
  let bestRating = 0;
  let motm = allPlayers[0]?.id ?? "";

  for (const p of allPlayers) {
    const pe = secondHalf.playerEvents[p.id] ?? { positive: 0, negative: 0, involved: 0 };
    let rating = 6.0 + pe.positive * 0.5 - pe.negative * 0.3 + pe.involved * 0.1;
    rating = Math.max(1, Math.min(10, Math.round(rating * 10) / 10));
    playerRatings[p.id] = rating;

    if (rating > bestRating) {
      bestRating = rating;
      motm = p.id;
    }
  }

  return {
    events,
    homeScore: secondHalf.homeScore,
    awayScore: secondHalf.awayScore,
    stats,
    playerRatings,
    manOfTheMatch: motm,
  };
}
