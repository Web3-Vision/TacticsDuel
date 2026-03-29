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

export function simulateMatch(config: MatchConfig, seed?: number): MatchResult {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 2147483647));

  const homeRaw = calculateTeamRatings(config.homeSquad);
  const awayRaw = calculateTeamRatings(config.awaySquad);

  let homeTactics = { ...config.homeTactics };
  let awayTactics = { ...config.awayTactics };

  let homeRatings = applyTacticalModifiers(homeRaw, homeTactics);
  let awayRatings = applyTacticalModifiers(awayRaw, awayTactics);

  const events: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let homePossCount = 0;
  let awayPossCount = 0;
  let homeShots = 0;
  let awayShots = 0;
  let homeOnTarget = 0;
  let awayOnTarget = 0;
  let homeCorners = 0;
  let awayCorners = 0;
  let homeFouls = 0;
  let awayFouls = 0;
  let homeYellows = 0;
  let awayYellows = 0;
  let homeReds = 0;
  let awayReds = 0;

  // Player tracking for ratings
  const playerEvents: Record<string, { positive: number; negative: number; involved: number }> = {};
  function trackPlayer(id: string, type: "positive" | "negative" | "involved") {
    if (!playerEvents[id]) playerEvents[id] = { positive: 0, negative: 0, involved: 0 };
    playerEvents[id][type]++;
  }

  const homeTeam = "Home";
  const awayTeam = "Away";

  function makeVars(
    team: "home" | "away",
    player: Player,
    player2?: Player
  ) {
    return {
      player: player.name,
      player2: player2?.name ?? "",
      team: team === "home" ? homeTeam : awayTeam,
      opponent: team === "home" ? awayTeam : homeTeam,
      minute: 0, // filled later
      score: `${homeScore}-${awayScore}`,
    };
  }

  // Kickoff
  events.push({
    minute: 0,
    type: "kickoff",
    team: "neutral",
    description: "The referee blows the whistle. Kick-off!",
    isKeyEvent: true,
  });

  for (let minute = 1; minute <= 90; minute++) {
    // Determine possession this minute
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

    // Base event chance: ~28%, higher in last 10 mins
    let eventChance = 0.28;
    if (minute > 80) eventChance += 0.06;
    if (minute > 85) eventChance += 0.04;
    eventChance *= atkRatings.eventRate;

    if (rng() > eventChance) {
      // Atmospheric commentary occasionally
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

    // --- Event Resolution Chain ---

    // Step 1: Build-up (midfield vs midfield)
    const buildUpSuccess = rng() < 0.55 + (atkRatings.midfield - defRatings.midfield) * 0.003;

    if (!buildUpSuccess) {
      // Interception/tackle
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

    // Step 2: Chance creation
    const creator = rng() < 0.6 ? pickMidfielder(atkSquad, rng) : pickAttacker(atkSquad, rng);
    const attacker = pickAttacker(atkSquad, rng);
    const chanceQuality =
      (creator.passing * 0.4 + creator.dribbling * 0.3 + attacker.pace * 0.3) / 99;
    const defBlock =
      (defRatings.defense + defRatings.compactness) / 100 * 0.4;

    const chanceSucceeds = rng() < chanceQuality * 0.6 - defBlock * 0.3;

    if (!chanceSucceeds) {
      // Chance blocked or lost
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

    // Chance created event
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

    // Step 3: Foul chance (before shot)
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

      // Yellow card chance
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

        // Very rare red
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

      // Corner from free kick sometimes
      if (rng() < 0.2) {
        if (possTeam === "home") homeCorners++;
        else awayCorners++;
      }
      continue;
    }

    // Step 4: Shot
    if (possTeam === "home") homeShots++;
    else awayShots++;

    const shotQuality =
      (attacker.shooting * 0.5 + attacker.dribbling * 0.2 + attacker.pace * 0.15 + creator.passing * 0.15) / 99;

    // On target? (~45% of shots)
    const onTargetChance = 0.40 + shotQuality * 0.15;
    const isOnTarget = rng() < onTargetChance;

    if (!isOnTarget) {
      // Shot missed
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

      // Corner chance
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

    // Step 5: Shot blocked by defender?
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

    // Step 6: Goal or save?
    // Goal conversion: ~28% of on-target shots (calibrated for ~2.5 goals/game)
    const gk = pickGK(defSquad, rng);
    const gkStrength = gk.goalkeeping / 99;
    const goalChance =
      (0.24 + shotQuality * 0.12 - gkStrength * 0.10) * atkRatings.conversionRate;

    if (rng() < goalChance) {
      // GOAL!
      if (possTeam === "home") homeScore++;
      else awayScore++;

      trackPlayer(attacker.id, "positive");
      trackPlayer(attacker.id, "positive"); // double for goals
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
      // Save
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

      // Corner from save
      if (rng() < 0.3) {
        if (possTeam === "home") homeCorners++;
        else awayCorners++;
      }
    }

    // Half-time
    if (minute === 45) {
      events.push({
        minute: 45,
        type: "halftime",
        team: "neutral",
        description: `Half time. ${homeScore}-${awayScore}`,
        isKeyEvent: true,
      });

      // Apply conditional tactics
      if (homeScore < awayScore && homeTactics.htIfLosingMentality) {
        homeTactics = { ...homeTactics, mentality: homeTactics.htIfLosingMentality };
        homeRatings = applyTacticalModifiers(homeRaw, homeTactics);
      } else if (homeScore > awayScore && homeTactics.htIfWinningMentality) {
        homeTactics = { ...homeTactics, mentality: homeTactics.htIfWinningMentality };
        homeRatings = applyTacticalModifiers(homeRaw, homeTactics);
      }

      if (awayScore < homeScore && awayTactics.htIfLosingMentality) {
        awayTactics = { ...awayTactics, mentality: awayTactics.htIfLosingMentality };
        awayRatings = applyTacticalModifiers(awayRaw, awayTactics);
      } else if (awayScore > homeScore && awayTactics.htIfWinningMentality) {
        awayTactics = { ...awayTactics, mentality: awayTactics.htIfWinningMentality };
        awayRatings = applyTacticalModifiers(awayRaw, awayTactics);
      }
    }
  }

  // Full time
  events.push({
    minute: 90,
    type: "fulltime",
    team: "neutral",
    description: `Full time! ${homeScore}-${awayScore}`,
    isKeyEvent: true,
  });

  // Calculate stats
  const totalPoss = homePossCount + awayPossCount;
  const stats: MatchStats = {
    homePossession: totalPoss > 0 ? Math.round((homePossCount / totalPoss) * 100) : 50,
    awayPossession: totalPoss > 0 ? Math.round((awayPossCount / totalPoss) * 100) : 50,
    homeShots,
    awayShots,
    homeOnTarget,
    awayOnTarget,
    homeCorners,
    awayCorners,
    homeFouls,
    awayFouls,
    homeYellowCards: homeYellows,
    awayYellowCards: awayYellows,
    homeRedCards: homeReds,
    awayRedCards: awayReds,
    homePassAccuracy: Math.round(65 + homeRatings.midfield * 0.25 + rng() * 8),
    awayPassAccuracy: Math.round(65 + awayRatings.midfield * 0.25 + rng() * 8),
  };

  // Player ratings
  const allPlayers = [...config.homeSquad, ...config.awaySquad];
  const playerRatings: Record<string, number> = {};
  let bestRating = 0;
  let motm = allPlayers[0]?.id ?? "";

  for (const p of allPlayers) {
    const pe = playerEvents[p.id] ?? { positive: 0, negative: 0, involved: 0 };
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
    homeScore,
    awayScore,
    stats,
    playerRatings,
    manOfTheMatch: motm,
  };
}
