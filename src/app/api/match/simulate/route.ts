import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simulateMatch } from "@/lib/engine/match-engine";
import { calculateEloChange, calculateDivisionPoints } from "@/lib/engine/elo";
import { PLAYERS } from "@/lib/data/players";
import { generateAISquad, generateAITactics } from "@/lib/engine/ai-opponent";
import { getFormation } from "@/lib/data/formations";
import { createTraceId, logDomainEvent, recordApiResult } from "@/lib/observability/realtime";
import { persistNarrativeArtifacts } from "@/lib/engine/narrative-pipeline";
import { resolveStarterIdsFromMatchSquad } from "@/lib/squad/persisted-squad";
import { computeRankedProgression, type RankedMatchResult } from "@/lib/league/progression";
import type { Player, Tactics } from "@/lib/types";

// Resolve squad rows (from DB) to Player objects
function resolveSquad(squadData: unknown[]): Player[] {
  if (!squadData || squadData.length === 0) return [];

  // Check if already Player objects (have 'overall' field)
  const first = squadData[0] as Record<string, unknown>;
  if (first && typeof first.overall === "number") {
    return squadData as Player[];
  }

  // Otherwise, resolve ids from legacy/new persisted payloads.
  const starterIds = resolveStarterIdsFromMatchSquad(squadData);
  if (starterIds.length > 0) {
    return starterIds
      .map((playerId) => PLAYERS.find((player) => player.id === playerId))
      .filter((player): player is Player => Boolean(player));
  }

  // Legacy fallback: row-per-player payload with player_id.
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
  const traceId = createTraceId();
  const startedAtMs = Date.now();
  const respond = (payload: unknown, status: number, context?: Record<string, string | number>, errorCode?: string) => {
    recordApiResult({
      service: "match.simulate",
      operation: "POST",
      traceId,
      startedAtMs,
      status,
      context,
      errorCode,
    });
    const response = NextResponse.json(payload, { status });
    response.headers.set("x-trace-id", traceId);
    return response;
  };

  try {
    const timings: Record<string, number> = {};
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return respond({ error: "Missing matchId" }, 400, { userId: user.id }, "MISSING_MATCH_ID");
    }

    // Get match record
    const matchLookupStartedAt = Date.now();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();
    timings.matchLookupMs = Date.now() - matchLookupStartedAt;

    if (matchError || !match) {
      return respond({ error: "Match not found" }, 404, { userId: user.id, matchId, ...timings }, "MATCH_NOT_FOUND");
    }

    if (match.status !== "accepted" && match.status !== "pending") {
      return respond(
        { error: "Match already simulated" },
        400,
        { userId: user.id, matchId, matchStatus: match.status, ...timings },
        "MATCH_ALREADY_SIMULATED"
      );
    }

    // Resolve squads
    const squadResolveStartedAt = Date.now();
    const homeSquad = resolveSquad(match.home_squad as unknown[]);
    let awaySquad = resolveSquad(match.away_squad as unknown[]);
    const homeTactics = resolveTactics(match.home_tactics);
    let awayTactics = resolveTactics(match.away_tactics);
    timings.squadResolveMs = Date.now() - squadResolveStartedAt;

    // If away squad is empty (ghost match), generate AI squad
    if (awaySquad.length === 0) {
      const aiAwaySquadStartedAt = Date.now();
      const formation = getFormation(awayTactics.formation || "4-3-3");
      const positions = formation.slots.map((s) => s.position);
      awaySquad = generateAISquad(PLAYERS, positions);
      if (!awayTactics.mentality) {
        awayTactics = generateAITactics();
      }
      timings.aiAwaySquadMs = Date.now() - aiAwaySquadStartedAt;
      logDomainEvent({
        service: "match.simulate",
        event: "ai_away_squad_generated",
        traceId,
        context: { matchId },
      });
    }

    // Ensure we have valid squads
    if (homeSquad.length === 0) {
      return respond({ error: "Home squad is empty" }, 400, { userId: user.id, matchId, ...timings }, "EMPTY_HOME_SQUAD");
    }

    // Simulate
    const simulationStartedAt = Date.now();
    const result = simulateMatch({
      homeSquad,
      awaySquad,
      homeTactics,
      awayTactics,
      matchType: match.match_type,
    });
    timings.simulationMs = Date.now() - simulationStartedAt;

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
      const rankedHomeProfileLookupStartedAt = Date.now();
      const { data: homeProfile } = await supabase
        .from("profiles")
        .select("current_streak")
        .eq("id", match.home_user_id)
        .single();
      timings.rankedHomeProfileLookupMs = Date.now() - rankedHomeProfileLookupStartedAt;

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
    const matchUpdateStartedAt = Date.now();
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
    timings.matchUpdateMs = Date.now() - matchUpdateStartedAt;

    const narrativeWriteStartedAt = Date.now();
    await persistNarrativeArtifacts(supabase, {
      matchId,
      matchType: match.match_type,
      homeUserId: match.home_user_id,
      awayUserId: match.away_user_id,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      stats: result.stats,
      events: result.events,
    });
    timings.narrativeWriteMs = Date.now() - narrativeWriteStartedAt;

    // Update player profiles for ranked
    if (match.match_type === "ranked") {
      const rankedProfilesUpdateStartedAt = Date.now();
      const nowIso = new Date().toISOString();

      // Home player
      const { data: homeProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", match.home_user_id)
        .single();

      if (homeProfile) {
        const progression = computeRankedProgression(
          homeProfile,
          homeResult as RankedMatchResult,
          homeDivPointsChange,
          nowIso,
        );

        await supabase
          .from("profiles")
          .update({
            elo_rating: homeProfile.elo_rating + homeEloChange,
            ...progression.patch,
          })
          .eq("id", match.home_user_id);

        if (progression.seasonReward) {
          await supabase
            .from("season_rewards")
            .upsert({
              user_id: match.home_user_id,
              season: progression.seasonReward.season,
              highest_division: progression.seasonReward.highestDivision,
              coins_earned: progression.seasonReward.coinsEarned,
              claimed: false,
            }, {
              onConflict: "user_id,season",
            });
        }
      }

      // Away player (if real, not ghost)
      if (match.away_user_id) {
        const { data: awayProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", match.away_user_id)
          .single();

        if (awayProfile) {
          const progression = computeRankedProgression(
            awayProfile,
            awayResult as RankedMatchResult,
            awayDivPointsChange,
            nowIso,
          );

          await supabase
            .from("profiles")
            .update({
              elo_rating: awayProfile.elo_rating + awayEloChange,
              ...progression.patch,
            })
            .eq("id", match.away_user_id);

          if (progression.seasonReward) {
            await supabase
              .from("season_rewards")
              .upsert({
                user_id: match.away_user_id,
                season: progression.seasonReward.season,
                highest_division: progression.seasonReward.highestDivision,
                coins_earned: progression.seasonReward.coinsEarned,
                claimed: false,
              }, {
                onConflict: "user_id,season",
              });
          }
        }
      }
      timings.rankedProfilesUpdateMs = Date.now() - rankedProfilesUpdateStartedAt;
    }

    return respond({
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
    }, 200, { userId: user.id, matchId, matchType: match.match_type, ...timings });
  } catch (error) {
    console.error("Match simulation error:", error);
    return respond(
      { error: "Internal server error" },
      500,
      undefined,
      "INTERNAL_ERROR"
    );
  }
}
