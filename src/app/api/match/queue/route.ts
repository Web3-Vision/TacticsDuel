import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Join matchmaking queue
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if already in queue
    const { data: existing } = await supabase
      .from("matchmaking_queue")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already in queue" }, { status: 409 });
    }

    // Add to queue
    const { error: insertError } = await supabase
      .from("matchmaking_queue")
      .insert({
        user_id: user.id,
        elo_rating: profile.elo_rating,
        division: profile.division,
      });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to join queue" },
        { status: 500 }
      );
    }

    // Try to find a match immediately
    const match = await tryFindMatch(supabase, user.id, profile.elo_rating);

    return NextResponse.json({
      queued: true,
      matchFound: !!match,
      matchId: match?.id ?? null,
    });
  } catch (error) {
    console.error("Queue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: Check queue status
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if still in queue
    const { data: queueEntry } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!queueEntry) {
      // Check for pending/recent match
      const { data: recentMatch } = await supabase
        .from("matches")
        .select("id, status")
        .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
        .in("status", ["pending", "accepted", "simulating"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (recentMatch) {
        return NextResponse.json({
          inQueue: false,
          matchFound: true,
          matchId: recentMatch.id,
        });
      }

      return NextResponse.json({ inQueue: false, matchFound: false });
    }

    // Try matchmaking
    const { data: profile } = await supabase
      .from("profiles")
      .select("elo_rating")
      .eq("id", user.id)
      .single();

    const match = await tryFindMatch(
      supabase,
      user.id,
      profile?.elo_rating ?? 1000,
      queueEntry.joined_at
    );

    return NextResponse.json({
      inQueue: !match,
      matchFound: !!match,
      matchId: match?.id ?? null,
      waitTime: Math.round(
        (Date.now() - new Date(queueEntry.joined_at).getTime()) / 1000
      ),
    });
  } catch (error) {
    console.error("Queue check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Leave queue
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
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

  // Get both players' squads and tactics
  const [homeSquad, awaySquad, homeTactics, awayTactics] = await Promise.all([
    supabase.from("squads").select("*").eq("user_id", userId).eq("is_starter", true),
    supabase.from("squads").select("*").eq("user_id", opponent.user_id).eq("is_starter", true),
    supabase.from("tactics").select("*").eq("user_id", userId).single(),
    supabase.from("tactics").select("*").eq("user_id", opponent.user_id).single(),
  ]);

  // Create match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      home_user_id: userId,
      away_user_id: opponent.user_id,
      match_type: "ranked",
      status: "accepted",
      home_squad: homeSquad.data ?? [],
      away_squad: awaySquad.data ?? [],
      home_tactics: homeTactics.data ?? {},
      away_tactics: awayTactics.data ?? {},
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
