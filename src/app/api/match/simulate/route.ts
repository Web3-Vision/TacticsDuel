import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simulateMatch } from "@/lib/engine/match-engine";
import { calculateEloChange, calculateDivisionPoints } from "@/lib/engine/elo";
import { PLAYERS } from "@/lib/data/players";
import { generateAISquad, generateAITactics } from "@/lib/engine/ai-opponent";
import { getFormation } from "@/lib/data/formations";
import type { Player, Tactics } from "@/lib/types";

// Resolve squad rows (from DB) to Player objects
function resolveSquad(squadData: unknown[]): Player[] {
  if (!squadData || squadData.length === 0) return [];

  // Check if already Player objects (have 'overall' field)
  const first = squadData[0] as Record<string, unknown>;
  if (first && typeof first.overall === "number") {
    return squadData as Player[];
  }

  // Otherwise, resolve player_id references
  const resolved: Player[] = [];
  for (const row of squadData) {
    const r = row as Record<string, unknown>;
    const playerId = r.player_id as string;
    if (playerId) {
      const player = PLAYERS.find((p) => p.id === playerId);
      if (player) resolved.push(player);
    }
  }
  return resolved;
}

function resolveTactics(data: unknown): Tactics {
  const d = data as Record<string, unknown>;
  return {
    formation: (d?.formation as string) || "4-3-3",
    mentality: (d?.mentality as Tactics["mentality"]) || "Balanced",
    tempo: (d?.tempo as Tactics["tempo"]) || "Normal",
    pressing: (d?.pressing as Tactics["pressing"]) || "Medium",
    width: (d?.width as Tactics["width"]) || "Normal",
    htIfLosingMentality: d?.htIfLosingMentality as Tactics["mentality"] | undefined,
    htIfWinningMentality: d?.htIfWinningMentality as Tactics["mentality"] | undefined,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    // Get match record
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "accepted" && match.status !== "pending") {
      return NextResponse.json(
        { error: "Match already simulated" },
        { status: 400 }
      );
    }

    // Resolve squads
    const homeSquad = resolveSquad(match.home_squad as unknown[]);
    let awaySquad = resolveSquad(match.away_squad as unknown[]);
    const homeTactics = resolveTactics(match.home_tactics);
    let awayTactics = resolveTactics(match.away_tactics);

    // If away squad is empty (ghost match), generate AI squad
    if (awaySquad.length === 0) {
      const formation = getFormation(awayTactics.formation || "4-3-3");
      const positions = formation.slots.map((s) => s.position);
      awaySquad = generateAISquad(PLAYERS, positions);
      if (!awayTactics.mentality) {
        awayTactics = generateAITactics();
      }
    }

    // Ensure we have valid squads
    if (homeSquad.length === 0) {
      return NextResponse.json({ error: "Home squad is empty" }, { status: 400 });
    }

    // Simulate
    const result = simulateMatch({
      homeSquad,
      awaySquad,
      homeTactics,
      awayTactics,
      matchType: match.match_type,
    });

    // Determine result for each player
    const homeResult =
      result.homeScore > result.awayScore
        ? "win"
        : result.homeScore < result.awayScore
          ? "loss"
          : ("draw" as const);
    const awayResult =
      homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : ("draw" as const);

    // Calculate ELO changes for ranked
    let homeEloChange = 0;
    let awayEloChange = 0;
    let homeDivPointsChange = 0;
    let awayDivPointsChange = 0;

    if (match.match_type === "ranked") {
      homeEloChange = calculateEloChange(
        match.home_elo_before ?? 1000,
        match.away_elo_before ?? 1000,
        homeResult
      );
      awayEloChange = calculateEloChange(
        match.away_elo_before ?? 1000,
        match.home_elo_before ?? 1000,
        awayResult
      );

      // Get home profile for streak
      const { data: homeProfile } = await supabase
        .from("profiles")
        .select("current_streak")
        .eq("id", match.home_user_id)
        .single();

      homeDivPointsChange = calculateDivisionPoints(
        homeResult,
        match.home_elo_before ?? 1000,
        match.away_elo_before ?? 1000,
        homeProfile?.current_streak ?? 0
      );
      awayDivPointsChange = calculateDivisionPoints(
        awayResult,
        match.away_elo_before ?? 1000,
        match.home_elo_before ?? 1000,
        0
      );
    }

    // Update match record
    await supabase
      .from("matches")
      .update({
        status: "completed",
        home_score: result.homeScore,
        away_score: result.awayScore,
        home_possession: result.stats.homePossession,
        away_possession: result.stats.awayPossession,
        home_shots: result.stats.homeShots,
        away_shots: result.stats.awayShots,
        home_on_target: result.stats.homeOnTarget,
        away_on_target: result.stats.awayOnTarget,
        events: result.events,
        home_elo_change: homeEloChange,
        away_elo_change: awayEloChange,
        home_division_points_change: homeDivPointsChange,
        away_division_points_change: awayDivPointsChange,
        completed_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    // Update player profiles for ranked
    if (match.match_type === "ranked") {
      // Home player
      const { data: homeProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", match.home_user_id)
        .single();

      if (homeProfile) {
        const newStreak =
          homeResult === "win"
            ? homeProfile.current_streak + 1
            : homeResult === "loss"
              ? 0
              : homeProfile.current_streak;

        const newDivPoints = Math.max(0, homeProfile.division_points + homeDivPointsChange);
        const newRankedInCycle = (homeProfile.ranked_matches_in_cycle ?? 0) + 1;
        const newDivMatchesPlayed = (homeProfile.division_matches_played ?? 0) + 1;

        // Check for cycle completion (5 ranked matches)
        const cycleComplete = newRankedInCycle >= 5;

        // Check for division season completion (10 matches)
        let newDivision = homeProfile.division;
        let newDivisionPoints = newDivPoints;
        let newDivSeason = homeProfile.division_season ?? 1;
        let newDivWins = (homeProfile.division_wins ?? 0) + (homeResult === "win" ? 1 : 0);
        let newDivDraws = (homeProfile.division_draws ?? 0) + (homeResult === "draw" ? 1 : 0);
        let newDivLosses = (homeProfile.division_losses ?? 0) + (homeResult === "loss" ? 1 : 0);
        let newDivMatchesPlayedFinal = newDivMatchesPlayed;
        let seasonCoins = 0;

        if (newDivMatchesPlayed >= 10) {
          // Evaluate promotion/relegation
          const divConfig = getDivisionConfig(homeProfile.division);
          if (divConfig?.pointsToPromote && newDivisionPoints >= divConfig.pointsToPromote) {
            // Promote!
            newDivision = Math.max(1, homeProfile.division - 1);
            seasonCoins = divConfig.rewardCoins;
          } else if (newDivisionPoints <= 0 && homeProfile.division < 10) {
            // Relegate
            newDivision = homeProfile.division + 1;
          }
          // Reset division season
          newDivisionPoints = 0;
          newDivSeason += 1;
          newDivWins = 0;
          newDivDraws = 0;
          newDivLosses = 0;
          newDivMatchesPlayedFinal = 0;
        }

        await supabase
          .from("profiles")
          .update({
            elo_rating: homeProfile.elo_rating + homeEloChange,
            division_points: newDivisionPoints,
            division: newDivision,
            wins: homeProfile.wins + (homeResult === "win" ? 1 : 0),
            draws: homeProfile.draws + (homeResult === "draw" ? 1 : 0),
            losses: homeProfile.losses + (homeResult === "loss" ? 1 : 0),
            current_streak: newStreak,
            best_streak: Math.max(homeProfile.best_streak, newStreak),
            ranked_matches_in_cycle: cycleComplete ? 0 : newRankedInCycle,
            squad_locked: cycleComplete ? false : homeProfile.squad_locked,
            transfers_remaining: cycleComplete ? 2 : (homeProfile.transfers_remaining ?? 0),
            division_wins: newDivWins,
            division_draws: newDivDraws,
            division_losses: newDivLosses,
            division_season: newDivSeason,
            division_matches_played: newDivMatchesPlayedFinal,
            coins: (homeProfile.coins ?? 0) + seasonCoins,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.home_user_id);
      }

      // Away player (if real, not ghost)
      if (match.away_user_id) {
        const { data: awayProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", match.away_user_id)
          .single();

        if (awayProfile) {
          const newStreak =
            awayResult === "win"
              ? awayProfile.current_streak + 1
              : awayResult === "loss"
                ? 0
                : awayProfile.current_streak;

          await supabase
            .from("profiles")
            .update({
              elo_rating: awayProfile.elo_rating + awayEloChange,
              division_points: Math.max(0, awayProfile.division_points + awayDivPointsChange),
              wins: awayProfile.wins + (awayResult === "win" ? 1 : 0),
              draws: awayProfile.draws + (awayResult === "draw" ? 1 : 0),
              losses: awayProfile.losses + (awayResult === "loss" ? 1 : 0),
              current_streak: newStreak,
              best_streak: Math.max(awayProfile.best_streak, newStreak),
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.away_user_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        events: result.events,
        stats: result.stats,
        playerRatings: result.playerRatings,
        manOfTheMatch: result.manOfTheMatch,
        homeEloChange,
        awayEloChange,
        homeDivPointsChange,
        awayDivPointsChange,
      },
    });
  } catch (error) {
    console.error("Match simulation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getDivisionConfig(divisionId: number) {
  const DIVISIONS = [
    { id: 10, name: "Amateur", pointsToPromote: 30, rewardCoins: 100 },
    { id: 9, name: "Semi-Pro", pointsToPromote: 40, rewardCoins: 200 },
    { id: 8, name: "Professional", pointsToPromote: 50, rewardCoins: 350 },
    { id: 7, name: "Championship", pointsToPromote: 60, rewardCoins: 500 },
    { id: 6, name: "Premier", pointsToPromote: 70, rewardCoins: 750 },
    { id: 5, name: "Elite", pointsToPromote: 80, rewardCoins: 1000 },
    { id: 4, name: "World Class", pointsToPromote: 90, rewardCoins: 1500 },
    { id: 3, name: "Legendary", pointsToPromote: 100, rewardCoins: 2000 },
    { id: 2, name: "Ultimate", pointsToPromote: 120, rewardCoins: 3000 },
    { id: 1, name: "Ballon d'Or", pointsToPromote: null, rewardCoins: 5000 },
  ];
  return DIVISIONS.find((d) => d.id === divisionId);
}
