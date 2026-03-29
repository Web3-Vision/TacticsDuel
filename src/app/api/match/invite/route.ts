import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Create friend match invite
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
    const { mode } = body; // 'bring_squad' or 'live_draft'

    const { data: invite, error } = await supabase
      .from("friend_invites")
      .insert({
        from_user_id: user.id,
        mode: mode || "bring_squad",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create invite" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invite });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: Get invite by code
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: invite, error } = await supabase
      .from("friend_invites")
      .select(
        `
        *,
        from_user:profiles!friend_invites_from_user_id_fkey(username, club_name)
      `
      )
      .eq("invite_code", code)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite no longer valid" },
        { status: 410 }
      );
    }

    return NextResponse.json({ invite });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Accept invite
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    // Get invite
    const { data: invite, error: inviteError } = await supabase
      .from("friend_invites")
      .select("*")
      .eq("invite_code", inviteCode)
      .eq("status", "pending")
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.from_user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot accept your own invite" },
        { status: 400 }
      );
    }

    // Update invite
    await supabase
      .from("friend_invites")
      .update({ to_user_id: user.id, status: "accepted" })
      .eq("id", invite.id);

    if (invite.mode === "bring_squad") {
      // Create match immediately
      const [homeSquad, awaySquad, homeTactics, awayTactics] =
        await Promise.all([
          supabase
            .from("squads")
            .select("*")
            .eq("user_id", invite.from_user_id)
            .eq("is_starter", true),
          supabase
            .from("squads")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_starter", true),
          supabase
            .from("tactics")
            .select("*")
            .eq("user_id", invite.from_user_id)
            .single(),
          supabase
            .from("tactics")
            .select("*")
            .eq("user_id", user.id)
            .single(),
        ]);

      const { data: match } = await supabase
        .from("matches")
        .insert({
          home_user_id: invite.from_user_id,
          away_user_id: user.id,
          match_type: "friendly",
          status: "accepted",
          home_squad: homeSquad.data ?? [],
          away_squad: awaySquad.data ?? [],
          home_tactics: homeTactics.data ?? {},
          away_tactics: awayTactics.data ?? {},
        })
        .select()
        .single();

      // Link match to invite
      if (match) {
        await supabase
          .from("friend_invites")
          .update({ match_id: match.id })
          .eq("id", invite.id);
      }

      return NextResponse.json({ matchId: match?.id, mode: "bring_squad" });
    }

    // Draft mode - create draft session
    return NextResponse.json({ inviteId: invite.id, mode: "live_draft" });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
