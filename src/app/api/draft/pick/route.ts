import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { draftId, playerId } = body;

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
    const picks = draft.picks as Array<{
      user_id: string;
      player_id: string;
      pick_number: number;
    }>;

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

    // Add pick
    const newPick = {
      user_id: user.id,
      player_id: playerId,
      pick_number: draft.current_pick,
    };
    const newPicks = [...picks, newPick];
    const newPickNumber = draft.current_pick + 1;

    // Snake draft: determine next picker
    // Pattern: A, B, B, A, A, B, B, A... (picks 1-32 for 16 each)
    const totalPicks = 22; // 11 per team
    let nextPicker = draft.user_a;
    if (newPickNumber <= totalPicks) {
      // Snake: pick 1=A, 2-3=B, 4-5=A, 6-7=B...
      const cycle = Math.floor((newPickNumber - 1) / 2);
      nextPicker = cycle % 2 === 0 ? draft.user_a : draft.user_b;
      // But within each pair, second pick goes to same player
      if (newPickNumber > 1) {
        const pair = Math.ceil(newPickNumber / 2);
        nextPicker = pair % 2 === 1 ? draft.user_a : draft.user_b;
      }
    }

    const isComplete = newPickNumber > totalPicks;

    const { error: updateError } = await supabase
      .from("draft_sessions")
      .update({
        picks: newPicks,
        current_pick: newPickNumber,
        current_picker: isComplete ? null : nextPicker,
        status: isComplete ? "completed" : "drafting",
      })
      .eq("id", draftId)
      .eq("current_picker", user.id); // Optimistic lock

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to make pick" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pick: newPick,
      isComplete,
      nextPicker: isComplete ? null : nextPicker,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
