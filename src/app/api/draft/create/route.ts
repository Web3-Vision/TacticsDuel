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
    const { inviteId } = body;

    if (!inviteId) {
      return NextResponse.json({ error: "Missing inviteId" }, { status: 400 });
    }

    // Verify invite
    const { data: invite } = await supabase
      .from("friend_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("mode", "live_draft")
      .single();

    if (!invite) {
      return NextResponse.json(
        { error: "Draft invite not found" },
        { status: 404 }
      );
    }

    // Generate player pool (80 players: 5 elite, 15 great, 25 good, 35 decent)
    const { PLAYERS } = await import("@/lib/data/players");
    const sorted = [...PLAYERS]
      .filter((p) => p.variant !== "icon")
      .sort(() => Math.random() - 0.5);

    const elite = sorted.filter((p) => p.overall >= 87).slice(0, 5);
    const great = sorted.filter((p) => p.overall >= 83 && p.overall < 87).slice(0, 15);
    const good = sorted.filter((p) => p.overall >= 78 && p.overall < 83).slice(0, 25);
    const decent = sorted.filter((p) => p.overall >= 70 && p.overall < 78).slice(0, 35);

    const pool = [...elite, ...great, ...good, ...decent].map((p) => p.id);

    const { data: draft, error } = await supabase
      .from("draft_sessions")
      .insert({
        invite_id: inviteId,
        user_a: invite.from_user_id,
        user_b: invite.to_user_id,
        player_pool: pool,
        current_picker: invite.from_user_id,
        status: "drafting",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create draft" },
        { status: 500 }
      );
    }

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
