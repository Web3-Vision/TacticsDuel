import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyLiveDraftPick,
  LIVE_DRAFT_PICKS_PER_SIDE,
  type DraftPick,
  splitDraftedSides,
} from "@/lib/multiplayer/live-draft";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalizeDraftMatchIfNeeded(supabase: any, draft: any): Promise<string> {
  const { data: invite, error: inviteError } = await supabase
    .from("friend_invites")
    .select("id, match_id, from_user_id, to_user_id, created_at")
    .eq("id", draft.invite_id)
    .single();

  if (inviteError || !invite) {
    throw new Error("Failed to resolve draft invite");
  }

  if (invite.match_id) {
    return invite.match_id;
  }

  const userA = draft.user_a as string;
  const userB = (draft.user_b ?? invite.to_user_id) as string | null;
  if (!userA || !userB) {
    throw new Error("Draft participants missing");
  }

  const picks = draft.picks as DraftPick[];
  const { homeStarterIds, awayStarterIds } = splitDraftedSides(picks, userA, userB);
  if (homeStarterIds.length !== LIVE_DRAFT_PICKS_PER_SIDE || awayStarterIds.length !== LIVE_DRAFT_PICKS_PER_SIDE) {
    throw new Error("Draft completion is inconsistent");
  }

  // Recovery guard: if a prior finalize created the match but linking failed,
  // relink that existing draft match instead of creating another one.
  const { data: existingMatch } = await supabase
    .from("matches")
    .select("id, created_at")
    .eq("home_user_id", userA)
    .eq("away_user_id", userB)
    .eq("match_type", "draft")
    .eq("status", "accepted")
    .gte("created_at", invite.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingMatch?.id) {
    await supabase.from("friend_invites").update({ match_id: existingMatch.id }).eq("id", invite.id).is("match_id", null);
    const { data: relinkedInvite } = await supabase
      .from("friend_invites")
      .select("match_id")
      .eq("id", invite.id)
      .single();

    if (relinkedInvite?.match_id) {
      return relinkedInvite.match_id;
    }
  }

  const [homeTactics, awayTactics] = await Promise.all([
    supabase.from("tactics").select("*").eq("user_id", userA).single(),
    supabase.from("tactics").select("*").eq("user_id", userB).single(),
  ]);

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      home_user_id: userA,
      away_user_id: userB,
      match_type: "draft",
      status: "accepted",
      home_squad: [{ user_id: userA, player_ids: homeStarterIds, bench_ids: [] }],
      away_squad: [{ user_id: userB, player_ids: awayStarterIds, bench_ids: [] }],
      home_tactics: homeTactics.data ?? {},
      away_tactics: awayTactics.data ?? {},
    })
    .select("id")
    .single();

  if (matchError || !match) {
    throw new Error("Failed to create draft match");
  }

  await supabase.from("friend_invites").update({ match_id: match.id }).eq("id", invite.id).is("match_id", null);

  const { data: linkedInvite } = await supabase
    .from("friend_invites")
    .select("match_id")
    .eq("id", invite.id)
    .single();

  return linkedInvite?.match_id ?? match.id;
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
    const draftId = typeof body?.draftId === "string" ? body.draftId : "";
    const playerId = typeof body?.playerId === "string" ? body.playerId : "";
    if (!draftId || !playerId) {
      return NextResponse.json(
        { error: "Missing draftId or playerId" },
        { status: 400 }
      );
    }

    // Get draft
    const { data: draft, error: draftError } = await supabase
      .from("draft_sessions")
      .select("*")
      .eq("id", draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { error: "Draft not found" },
        { status: 404 }
      );
    }

    if (draft.status === "completed") {
      const { data: invite } = await supabase
        .from("friend_invites")
        .select("match_id")
        .eq("id", draft.invite_id)
        .single();

      let recoveredMatchId = invite?.match_id ?? null;
      if (!recoveredMatchId) {
        recoveredMatchId = await finalizeDraftMatchIfNeeded(supabase, draft);
      }

      return NextResponse.json({
        isComplete: true,
        nextPicker: null,
        matchId: recoveredMatchId,
      });
    }

    if (draft.status !== "drafting") {
      return NextResponse.json(
        { error: "Draft is not active" },
        { status: 400 }
      );
    }

    if (draft.current_picker !== user.id) {
      return NextResponse.json(
        { error: "Not your turn" },
        { status: 403 }
      );
    }

    // Verify player is in pool and not already picked
    const pool = draft.player_pool as string[];
    const picks = draft.picks as DraftPick[];

    if (!pool.includes(playerId)) {
      return NextResponse.json(
        { error: "Player not in pool" },
        { status: 400 }
      );
    }

    if (picks.some((p) => p.player_id === playerId)) {
      return NextResponse.json(
        { error: "Player already picked" },
        { status: 400 }
      );
    }

    let transition: ReturnType<typeof applyLiveDraftPick>;
    try {
      transition = applyLiveDraftPick(draft, user.id, playerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid draft action";
      if (message === "Not your turn") {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message === "Draft is not active" || message === "Draft is already complete") {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const { data: updatedDraft, error: updateError } = await supabase
      .from("draft_sessions")
      .update({
        picks: transition.picks,
        current_pick: transition.currentPick,
        current_picker: transition.nextPicker,
        status: transition.isComplete ? "completed" : "drafting",
      })
      .eq("id", draftId)
      .eq("current_picker", user.id)
      .eq("status", "drafting")
      .eq("current_pick", draft.current_pick)
      .select("*")
      .single();

    if (updateError || !updatedDraft) {
      return NextResponse.json(
        { error: "Draft state changed, refresh and retry." },
        { status: 409 }
      );
    }

    let matchId: string | null = null;
    if (transition.isComplete) {
      matchId = await finalizeDraftMatchIfNeeded(supabase, updatedDraft);
    }

    return NextResponse.json({
      pick: transition.pick,
      isComplete: transition.isComplete,
      nextPicker: transition.nextPicker,
      matchId,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
