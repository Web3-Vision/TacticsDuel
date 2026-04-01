import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTraceId, logDomainEvent, recordApiResult } from "@/lib/observability/realtime";
import type { Tactics } from "@/lib/types";
import { makeCompetitiveError, RANKED_MIN_STARTERS } from "@/lib/multiplayer/competitive-flow";
import { countSavedStarters } from "@/lib/squad/persisted-squad";

// Ghost opponent generation (server-side, no client imports)
function generateGhostTactics(): Tactics {
  const mentalities = ["Defensive", "Cautious", "Balanced", "Attacking", "Balanced"] as const;
  const tempos = ["Slow", "Normal", "Fast", "Normal"] as const;
  const pressings = ["Low", "Medium", "High", "Medium"] as const;
  const widths = ["Narrow", "Normal", "Wide", "Normal"] as const;
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    formation: "4-3-3",
    mentality: pick(mentalities),
    tempo: pick(tempos),
    pressing: pick(pressings),
    width: pick(widths),
    htIfLosingMentality: "Attacking",
    htIfWinningMentality: "Defensive",
  };
}

const GHOST_WAIT_THRESHOLD = 30; // seconds before generating ghost

function buildErrorResponse(code: Parameters<typeof makeCompetitiveError>[0], message: string, retryable = false) {
  return { ok: false, error: makeCompetitiveError(code, message, retryable) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStarterCount(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from("squads")
    .select("player_ids")
    .eq("user_id", userId)
    .maybeSingle();

  return countSavedStarters(data);
}

// POST: Join matchmaking queue
export async function POST() {
  const traceId = createTraceId();
  const startedAtMs = Date.now();
  const respond = (payload: unknown, status: number, context?: Record<string, string | number>, errorCode?: string) => {
    recordApiResult({
      service: "match.queue",
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
      return respond(buildErrorResponse("UNAUTHORIZED", "Unauthorized"), 401);
    }

    // Get profile
    const profileLookupStartedAt = Date.now();
    const { data: profile } = await supabase
      .from("profiles")
      .select("elo_rating, division, squad_locked")
      .eq("id", user.id)
      .single();
    timings.profileLookupMs = Date.now() - profileLookupStartedAt;

    if (!profile) {
      return respond(
        buildErrorResponse("PROFILE_NOT_FOUND", "Profile not found"),
        404,
        { userId: user.id, ...timings },
        "PROFILE_NOT_FOUND"
      );
    }

    const readinessLookupStartedAt = Date.now();
    const [starterCount, tacticsCheck] = await Promise.all([
      getStarterCount(supabase, user.id),
      supabase.from("tactics").select("user_id").eq("user_id", user.id).single(),
    ]);
    timings.readinessLookupMs = Date.now() - readinessLookupStartedAt;

    if (starterCount < RANKED_MIN_STARTERS) {
      return respond(
        buildErrorResponse("SQUAD_NOT_READY", "You need 11 saved starters before joining ranked queue."),
        422,
        { userId: user.id, starterCount, ...timings },
        "SQUAD_NOT_READY"
      );
    }

    if (!tacticsCheck.data) {
      return respond(
        buildErrorResponse("TACTICS_NOT_READY", "Save your tactics before joining ranked queue."),
        422,
        { userId: user.id, ...timings },
        "TACTICS_NOT_READY"
      );
    }

    if (!profile.squad_locked) {
      return respond(
        buildErrorResponse("SQUAD_NOT_LOCKED", "Lock your squad before joining ranked queue."),
        422,
        { userId: user.id, ...timings },
        "SQUAD_NOT_LOCKED"
      );
    }

    // Check if already in queue
    const queueLookupStartedAt = Date.now();
    const { data: existing } = await supabase
      .from("matchmaking_queue")
      .select("id")
      .eq("user_id", user.id)
      .single();
    timings.queueLookupMs = Date.now() - queueLookupStartedAt;

    if (existing) {
      return respond(
        buildErrorResponse("ALREADY_IN_QUEUE", "Already in queue", true),
        409,
        { userId: user.id, ...timings },
        "ALREADY_IN_QUEUE"
      );
    }

    // Add to queue
    const queueInsertStartedAt = Date.now();
    const { error: insertError } = await supabase
      .from("matchmaking_queue")
      .insert({
        user_id: user.id,
        elo_rating: profile.elo_rating,
        division: profile.division,
      });
    timings.queueInsertMs = Date.now() - queueInsertStartedAt;

    if (insertError) {
      return respond(
        buildErrorResponse("QUEUE_INSERT_FAILED", "Failed to join queue", true),
        500,
        { userId: user.id, ...timings },
        "QUEUE_INSERT_FAILED"
      );
    }

    // Try to find a match immediately
    const matchmakingStartedAt = Date.now();
    const match = await tryFindMatch(supabase, user.id, profile.elo_rating);
    timings.matchmakingMs = Date.now() - matchmakingStartedAt;
    if (match?.id) {
      logDomainEvent({
        service: "match.queue",
        event: "match_found_immediately",
        traceId,
        context: { userId: user.id, matchId: match.id },
      });
    }

    return respond(
      {
        ok: true,
        status: match ? "match_found" : "queued",
        queued: !match,
        matchFound: !!match,
        matchId: match?.id ?? null,
      },
      200,
      { userId: user.id, matchFound: Number(Boolean(match)), ...timings }
    );
  } catch (error) {
    console.error("Queue error:", error);
    return respond(
      buildErrorResponse("INTERNAL_ERROR", "Internal server error", true),
      500,
      undefined,
      "INTERNAL_ERROR"
    );
  }
}

// GET: Check queue status
export async function GET() {
  const traceId = createTraceId();
  const startedAtMs = Date.now();
  const respond = (payload: unknown, status: number, context?: Record<string, string | number>, errorCode?: string) => {
    recordApiResult({
      service: "match.queue",
      operation: "GET",
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
      return respond(buildErrorResponse("UNAUTHORIZED", "Unauthorized"), 401);
    }

    // Check if still in queue
    const queueLookupStartedAt = Date.now();
    const { data: queueEntry } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .eq("user_id", user.id)
      .single();
    timings.queueLookupMs = Date.now() - queueLookupStartedAt;

    if (!queueEntry) {
      // Check for pending/recent match
      const recentMatchLookupStartedAt = Date.now();
      const { data: recentMatch } = await supabase
        .from("matches")
        .select("id, status")
        .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
        .in("status", ["pending", "accepted", "simulating"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      timings.recentMatchLookupMs = Date.now() - recentMatchLookupStartedAt;

      if (recentMatch) {
        return respond({
          ok: true,
          status: "match_found",
          inQueue: false,
          matchFound: true,
          matchId: recentMatch.id,
        }, 200, { userId: user.id, matchFound: 1, ...timings });
      }

      return respond(
        { ok: true, status: "not_in_queue", inQueue: false, matchFound: false },
        200,
        { userId: user.id, matchFound: 0, ...timings }
      );
    }

    const waitSeconds = Math.round(
      (Date.now() - new Date(queueEntry.joined_at).getTime()) / 1000
    );

    // Try matchmaking with real opponent
    const profileLookupStartedAt = Date.now();
    const { data: profileData } = await supabase
      .from("profiles")
      .select("elo_rating")
      .eq("id", user.id)
      .single();
    timings.profileLookupMs = Date.now() - profileLookupStartedAt;

    const matchmakingStartedAt = Date.now();
    const match = await tryFindMatch(
      supabase,
      user.id,
      profileData?.elo_rating ?? 1000,
      queueEntry.joined_at
    );
    timings.matchmakingMs = Date.now() - matchmakingStartedAt;

    if (match) {
      return respond({
        ok: true,
        status: "match_found",
        inQueue: false,
        matchFound: true,
        matchId: match.id,
        waitTime: waitSeconds,
      }, 200, { userId: user.id, matchFound: 1, waitSeconds, ...timings });
    }

    // Ghost opponent fallback after threshold
    if (waitSeconds >= GHOST_WAIT_THRESHOLD) {
      const ghostMatchCreateStartedAt = Date.now();
      const ghostMatch = await createGhostMatch(
        supabase,
        user.id,
        profileData?.elo_rating ?? 1000
      );
      timings.ghostMatchCreateMs = Date.now() - ghostMatchCreateStartedAt;
      if (ghostMatch) {
        logDomainEvent({
          service: "match.queue",
          event: "ghost_match_created",
          traceId,
          context: { userId: user.id, matchId: ghostMatch.id, waitSeconds },
        });
        // Remove from queue
        await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);
        return respond({
          ok: true,
          status: "match_found",
          inQueue: false,
          matchFound: true,
          matchId: ghostMatch.id,
          waitTime: waitSeconds,
        }, 200, { userId: user.id, matchFound: 1, waitSeconds, ...timings });
      }
    }

    return respond({
      ok: true,
      status: "searching",
      inQueue: true,
      matchFound: false,
      waitTime: waitSeconds,
    }, 200, { userId: user.id, matchFound: 0, waitSeconds, ...timings });
  } catch (error) {
    console.error("Queue check error:", error);
    return respond(
      buildErrorResponse("INTERNAL_ERROR", "Internal server error", true),
      500,
      undefined,
      "INTERNAL_ERROR"
    );
  }
}

// DELETE: Leave queue
export async function DELETE() {
  const traceId = createTraceId();
  const startedAtMs = Date.now();
  const respond = (payload: unknown, status: number, context?: Record<string, string | number>, errorCode?: string) => {
    recordApiResult({
      service: "match.queue",
      operation: "DELETE",
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return respond(buildErrorResponse("UNAUTHORIZED", "Unauthorized"), 401);
    }

    await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);

    return respond({ ok: true, status: "not_in_queue", success: true }, 200, { userId: user.id });
  } catch {
    return respond(
      buildErrorResponse("INTERNAL_ERROR", "Internal server error", true),
      500,
      undefined,
      "INTERNAL_ERROR"
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryFindMatch(supabase: any, userId: string, elo: number, joinedAt?: string) {
  // Calculate ELO range based on wait time
  const waitSeconds = joinedAt
    ? (Date.now() - new Date(joinedAt).getTime()) / 1000
    : 0;
  const eloRange = Math.min(500, 150 + Math.floor(waitSeconds / 10) * 50);

  // Find opponent in range
  const { data: opponents } = await supabase
    .from("matchmaking_queue")
    .select("*")
    .neq("user_id", userId)
    .gte("elo_rating", elo - eloRange)
    .lte("elo_rating", elo + eloRange)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (!opponents || opponents.length === 0) return null;

  const opponent = opponents[0];

  // Get both players' squads (as Player objects via player_id lookup)
  const [homeSquadRes, awaySquadRes, homeTacticsRes, awayTacticsRes] = await Promise.all([
    supabase.from("squads").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("squads").select("*").eq("user_id", opponent.user_id).maybeSingle(),
    supabase.from("tactics").select("*").eq("user_id", userId).single(),
    supabase.from("tactics").select("*").eq("user_id", opponent.user_id).single(),
  ]);

  if (
    countSavedStarters(homeSquadRes.data) < RANKED_MIN_STARTERS ||
    countSavedStarters(awaySquadRes.data) < RANKED_MIN_STARTERS
  ) {
    return null;
  }

  // We store squad row data; the simulate endpoint resolves player objects.
  const homeSquadRows = homeSquadRes.data ? [homeSquadRes.data] : [];
  const awaySquadRows = awaySquadRes.data ? [awaySquadRes.data] : [];

  const homeTactics = homeTacticsRes.data
    ? {
        formation: homeTacticsRes.data.formation,
        mentality: homeTacticsRes.data.mentality,
        tempo: homeTacticsRes.data.tempo,
        pressing: homeTacticsRes.data.pressing,
        width: homeTacticsRes.data.width,
        htIfLosingMentality: homeTacticsRes.data.ht_if_losing_mentality,
        htIfWinningMentality: homeTacticsRes.data.ht_if_winning_mentality,
      }
    : { formation: "4-3-3", mentality: "Balanced", tempo: "Normal", pressing: "Medium", width: "Normal" };

  const awayTactics = awayTacticsRes.data
    ? {
        formation: awayTacticsRes.data.formation,
        mentality: awayTacticsRes.data.mentality,
        tempo: awayTacticsRes.data.tempo,
        pressing: awayTacticsRes.data.pressing,
        width: awayTacticsRes.data.width,
        htIfLosingMentality: awayTacticsRes.data.ht_if_losing_mentality,
        htIfWinningMentality: awayTacticsRes.data.ht_if_winning_mentality,
      }
    : { formation: "4-3-3", mentality: "Balanced", tempo: "Normal", pressing: "Medium", width: "Normal" };

  // Create match — store squad rows (simulate endpoint will resolve to Player objects)
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      home_user_id: userId,
      away_user_id: opponent.user_id,
      match_type: "ranked",
      status: "accepted",
      home_squad: homeSquadRows,
      away_squad: awaySquadRows,
      home_tactics: homeTactics,
      away_tactics: awayTactics,
      home_elo_before: elo,
      away_elo_before: opponent.elo_rating,
    })
    .select()
    .single();

  if (matchError) return null;

  // Remove both from queue
  await supabase.from("matchmaking_queue").delete().eq("user_id", userId);
  await supabase
    .from("matchmaking_queue")
    .delete()
    .eq("user_id", opponent.user_id);

  return match;
}

// Create a ghost opponent match using AI-generated squad
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createGhostMatch(supabase: any, userId: string, userElo: number) {
  // Get user's squad
  const { data: squadRows } = await supabase
    .from("squads")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: tacticsData } = await supabase
    .from("tactics")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (countSavedStarters(squadRows) < RANKED_MIN_STARTERS) return null;

  const userTactics = tacticsData
    ? {
        formation: tacticsData.formation,
        mentality: tacticsData.mentality,
        tempo: tacticsData.tempo,
        pressing: tacticsData.pressing,
        width: tacticsData.width,
        htIfLosingMentality: tacticsData.ht_if_losing_mentality,
        htIfWinningMentality: tacticsData.ht_if_winning_mentality,
      }
    : { formation: "4-3-3", mentality: "Balanced", tempo: "Normal", pressing: "Medium", width: "Normal" };

  // Try to find a recently active real player's squad as ghost
  const { data: recentOpponents } = await supabase
    .from("profiles")
    .select("id, elo_rating")
    .neq("id", userId)
    .gte("elo_rating", userElo - 300)
    .lte("elo_rating", userElo + 300)
    .order("updated_at", { ascending: false })
    .limit(10);

  let ghostSquad: unknown[] = [];
  let ghostTactics = generateGhostTactics();
  let ghostElo = userElo + Math.floor(Math.random() * 100) - 50; // Roughly similar ELO

  if (recentOpponents && recentOpponents.length > 0) {
    // Pick a random recent opponent
    const ghost = recentOpponents[Math.floor(Math.random() * recentOpponents.length)];
    ghostElo = ghost.elo_rating;

    const { data: ghostSquadData } = await supabase
      .from("squads")
      .select("*")
      .eq("user_id", ghost.id)
      .maybeSingle();

    const { data: ghostTacticsData } = await supabase
      .from("tactics")
      .select("*")
      .eq("user_id", ghost.id)
      .single();

    if (countSavedStarters(ghostSquadData) >= RANKED_MIN_STARTERS) {
      ghostSquad = [ghostSquadData];
      if (ghostTacticsData) {
        ghostTactics = {
          formation: ghostTacticsData.formation,
          mentality: ghostTacticsData.mentality,
          tempo: ghostTacticsData.tempo,
          pressing: ghostTacticsData.pressing,
          width: ghostTacticsData.width,
          htIfLosingMentality: ghostTacticsData.ht_if_losing_mentality,
          htIfWinningMentality: ghostTacticsData.ht_if_winning_mentality,
        };
      }
    }
  }

  // If no real ghost found, the simulate endpoint will generate AI squad
  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      home_user_id: userId,
      away_user_id: null, // ghost match
      match_type: "ranked",
      status: "accepted",
      home_squad: squadRows ? [squadRows] : [],
      away_squad: ghostSquad.length > 0 ? ghostSquad : [],
      home_tactics: userTactics,
      away_tactics: ghostTactics,
      home_elo_before: userElo,
      away_elo_before: ghostElo,
    })
    .select()
    .single();

  if (error) return null;
  return match;
}
