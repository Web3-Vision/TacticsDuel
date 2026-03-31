import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTraceId, logDomainEvent, recordApiResult } from "@/lib/observability/realtime";
import type { Tactics } from "@/lib/types";

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
      return respond({ error: "Unauthorized" }, 401);
    }

    // Get profile
    const profileLookupStartedAt = Date.now();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    timings.profileLookupMs = Date.now() - profileLookupStartedAt;

    if (!profile) {
      return respond({ error: "Profile not found" }, 404, { userId: user.id, ...timings }, "PROFILE_NOT_FOUND");
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
      return respond({ error: "Already in queue" }, 409, { userId: user.id, ...timings }, "ALREADY_IN_QUEUE");
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
        { error: "Failed to join queue" },
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

    return respond({
      queued: true,
      matchFound: !!match,
      matchId: match?.id ?? null,
    }, 200, { userId: user.id, matchFound: Number(Boolean(match)), ...timings });
  } catch (error) {
    console.error("Queue error:", error);
    return respond(
      { error: "Internal server error" },
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
      return respond({ error: "Unauthorized" }, 401);
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
          inQueue: false,
          matchFound: true,
          matchId: recentMatch.id,
        }, 200, { userId: user.id, matchFound: 1, ...timings });
      }

      return respond({ inQueue: false, matchFound: false }, 200, { userId: user.id, matchFound: 0, ...timings });
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
          inQueue: false,
          matchFound: true,
          matchId: ghostMatch.id,
          waitTime: waitSeconds,
        }, 200, { userId: user.id, matchFound: 1, waitSeconds, ...timings });
      }
    }

    return respond({
      inQueue: true,
      matchFound: false,
      waitTime: waitSeconds,
    }, 200, { userId: user.id, matchFound: 0, waitSeconds, ...timings });
  } catch (error) {
    console.error("Queue check error:", error);
    return respond(
      { error: "Internal server error" },
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
      return respond({ error: "Unauthorized" }, 401);
    }

    await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);

    return respond({ success: true }, 200, { userId: user.id });
  } catch {
    return respond(
      { error: "Internal server error" },
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
    supabase.from("squads").select("*").eq("user_id", userId).eq("is_starter", true),
    supabase.from("squads").select("*").eq("user_id", opponent.user_id).eq("is_starter", true),
    supabase.from("tactics").select("*").eq("user_id", userId).single(),
    supabase.from("tactics").select("*").eq("user_id", opponent.user_id).single(),
  ]);

  // We store the squad row data; the simulate endpoint will resolve player objects
  const homeSquadRows = homeSquadRes.data ?? [];
  const awaySquadRows = awaySquadRes.data ?? [];

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
    .eq("is_starter", true);

  const { data: tacticsData } = await supabase
    .from("tactics")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!squadRows || squadRows.length === 0) return null;

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
      .eq("is_starter", true);

    const { data: ghostTacticsData } = await supabase
      .from("tactics")
      .select("*")
      .eq("user_id", ghost.id)
      .single();

    if (ghostSquadData && ghostSquadData.length >= 11) {
      ghostSquad = ghostSquadData;
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
      home_squad: squadRows,
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
