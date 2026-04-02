import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createTraceId, logDomainEvent, recordApiResult } from "@/lib/observability/realtime";
import type { Mentality, Pressing, Tactics, Tempo, Width } from "@/lib/types";
import { makeCompetitiveError, RANKED_MIN_STARTERS } from "@/lib/multiplayer/competitive-flow";
import { allocateRankedMatch, type RankedMatchAllocationRepository } from "@/lib/multiplayer/queue-allocation";
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

type ClaimMatchmakingOpponentRpcRow = {
  claim_id: string | null;
  claimer_queue_id: string | null;
  opponent_queue_id: string | null;
  opponent_user_id: string | null;
  opponent_elo: number | null;
  opponent_joined_at: string | null;
  claim_expires_at: string | null;
};

type FinalizeClaimRpcRow = boolean | null;

const MENTALITIES: Mentality[] = ["Defensive", "Cautious", "Balanced", "Attacking", "All-out Attack"];
const TEMPOS: Tempo[] = ["Slow", "Normal", "Fast"];
const PRESSINGS: Pressing[] = ["Low", "Medium", "High"];
const WIDTHS: Width[] = ["Narrow", "Normal", "Wide"];

function asMentality(value: unknown, fallback: Mentality): Mentality {
  return MENTALITIES.includes(value as Mentality) ? (value as Mentality) : fallback;
}

function asTempo(value: unknown, fallback: Tempo): Tempo {
  return TEMPOS.includes(value as Tempo) ? (value as Tempo) : fallback;
}

function asPressing(value: unknown, fallback: Pressing): Pressing {
  return PRESSINGS.includes(value as Pressing) ? (value as Pressing) : fallback;
}

function asWidth(value: unknown, fallback: Width): Width {
  return WIDTHS.includes(value as Width) ? (value as Width) : fallback;
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

function normalizeTactics(raw: Record<string, unknown> | null): Tactics {
  return raw
    ? {
        formation: String(raw.formation ?? "4-3-3"),
        mentality: asMentality(raw.mentality, "Balanced"),
        tempo: asTempo(raw.tempo, "Normal"),
        pressing: asPressing(raw.pressing, "Medium"),
        width: asWidth(raw.width, "Normal"),
        htIfLosingMentality: asMentality(raw.htIfLosingMentality ?? raw.ht_if_losing_mentality, "Attacking"),
        htIfWinningMentality: asMentality(raw.htIfWinningMentality ?? raw.ht_if_winning_mentality, "Defensive"),
      }
    : {
        formation: "4-3-3",
        mentality: "Balanced",
        tempo: "Normal",
        pressing: "Medium",
        width: "Normal",
        htIfLosingMentality: "Attacking",
        htIfWinningMentality: "Defensive",
      };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createRankedMatchRepository(supabase: any): RankedMatchAllocationRepository {
  return {
    async claimOpponent(input) {
      const { data, error } = await supabase.rpc("claim_matchmaking_opponent", {
        p_user_id: input.userId,
        p_elo: input.elo,
        p_elo_range: input.eloRange,
        p_lease_seconds: 30,
      });

      if (error) {
        console.error("claim_matchmaking_opponent rpc error", error);
        return null;
      }

      const row = (Array.isArray(data) ? data[0] : null) as ClaimMatchmakingOpponentRpcRow | null;
      if (!row?.claim_id || !row.opponent_user_id || typeof row.opponent_elo !== "number") {
        return null;
      }

      return {
        claimId: row.claim_id,
        opponentUserId: row.opponent_user_id,
        opponentElo: row.opponent_elo,
      };
    },
    async loadParticipant(userId) {
      const [squadResult, tacticsResult] = await Promise.all([
        supabase.from("squads").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("tactics").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      return {
        squadRow: squadResult.data ? { player_ids: squadResult.data.player_ids } : null,
        tactics: tacticsResult.data ?? null,
      };
    },
    async createMatch(input) {
      const { data, error } = await supabase
        .from("matches")
        .insert({
          home_user_id: input.homeUserId,
          away_user_id: input.awayUserId,
          match_type: "ranked",
          status: "accepted",
          home_squad: input.home.squadRow ? [input.home.squadRow] : [],
          away_squad: input.away.squadRow ? [input.away.squadRow] : [],
          home_tactics: normalizeTactics(input.home.tactics),
          away_tactics: normalizeTactics(input.away.tactics),
          home_elo_before: input.homeElo,
          away_elo_before: input.awayElo,
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        console.error("ranked match insert error", error);
        return null;
      }

      return { id: data.id };
    },
    async finalizeClaim(claimId, matchId) {
      const { data, error } = await supabase.rpc("finalize_matchmaking_claim", {
        p_claim_id: claimId,
        p_match_id: matchId,
      });

      if (error) {
        console.error("finalize_matchmaking_claim rpc error", error);
        return false;
      }

      return Boolean(data as FinalizeClaimRpcRow);
    },
    async releaseClaim(claimId, reason) {
      const { error } = await supabase.rpc("release_matchmaking_claim", {
        p_claim_id: claimId,
        p_reason: reason,
      });

      if (error) {
        console.error("release_matchmaking_claim rpc error", error);
      }
    },
  };
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
    const serviceSupabase = await createServiceClient();
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
    const match = await tryFindMatch(serviceSupabase, user.id, profile.elo_rating);
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
    const serviceSupabase = await createServiceClient();
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
      serviceSupabase,
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
  return allocateRankedMatch(createRankedMatchRepository(supabase), {
    userId,
    elo,
    eloRange,
  });
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
