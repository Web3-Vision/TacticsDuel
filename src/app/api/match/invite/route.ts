import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeCompetitiveError, RANKED_MIN_STARTERS } from "@/lib/multiplayer/competitive-flow";

type InviteMode = "bring_squad" | "live_draft";

function buildErrorResponse(code: Parameters<typeof makeCompetitiveError>[0], message: string, retryable = false) {
  return { ok: false, error: makeCompetitiveError(code, message, retryable) };
}

function parseInviteMode(value: unknown): InviteMode | null {
  if (value === "bring_squad" || value === "live_draft") {
    return value;
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStarterCount(supabase: any, userId: string): Promise<number> {
  const { count } = await supabase
    .from("squads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_starter", true);

  return count ?? 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBringSquadReady(supabase: any, userId: string) {
  const [profile, starterCount, tactics] = await Promise.all([
    supabase.from("profiles").select("squad_locked").eq("id", userId).single(),
    getStarterCount(supabase, userId),
    supabase.from("tactics").select("user_id").eq("user_id", userId).single(),
  ]);

  if (!profile.data) {
    return buildErrorResponse("PROFILE_NOT_FOUND", "Profile not found");
  }

  if (starterCount < RANKED_MIN_STARTERS) {
    return buildErrorResponse("SQUAD_NOT_READY", "You need 11 saved starters for bring-squad matches.");
  }

  if (!tactics.data) {
    return buildErrorResponse("TACTICS_NOT_READY", "Save your tactics before starting a bring-squad match.");
  }

  if (!profile.data.squad_locked) {
    return buildErrorResponse("SQUAD_NOT_LOCKED", "Lock your squad before starting a bring-squad match.");
  }

  return null;
}

// POST: Create friend match invite
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(buildErrorResponse("UNAUTHORIZED", "Unauthorized"), { status: 401 });
    }

    const body = await request.json();
    const mode = parseInviteMode(body?.mode) ?? "bring_squad";
    if (body?.mode && !parseInviteMode(body.mode)) {
      return NextResponse.json(
        buildErrorResponse("INVALID_MODE", "Mode must be bring_squad or live_draft."),
        { status: 400 }
      );
    }

    if (mode === "bring_squad") {
      const readinessError = await ensureBringSquadReady(supabase, user.id);
      if (readinessError) {
        return NextResponse.json(readinessError, { status: 422 });
      }
    }

    const { data: invite, error } = await supabase
      .from("friend_invites")
      .insert({
        from_user_id: user.id,
        mode,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        buildErrorResponse("INTERNAL_ERROR", "Failed to create invite", true),
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, status: "invite_created", invite });
  } catch {
    return NextResponse.json(
      buildErrorResponse("INTERNAL_ERROR", "Internal server error", true),
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
      return NextResponse.json(
        buildErrorResponse("INVALID_INVITE_CODE", "Missing invite code"),
        { status: 400 }
      );
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
      return NextResponse.json(buildErrorResponse("INVITE_NOT_FOUND", "Invite not found"), { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json(buildErrorResponse("INVITE_EXPIRED", "Invite has expired"), { status: 410 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(buildErrorResponse("INVITE_ALREADY_HANDLED", "Invite no longer valid"), { status: 410 });
    }

    return NextResponse.json({ ok: true, status: "invite_ready", invite });
  } catch {
    return NextResponse.json(
      buildErrorResponse("INTERNAL_ERROR", "Internal server error", true),
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
      return NextResponse.json(buildErrorResponse("UNAUTHORIZED", "Unauthorized"), { status: 401 });
    }

    const body = await request.json();
    const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";
    if (!inviteCode) {
      return NextResponse.json(
        buildErrorResponse("INVALID_INVITE_CODE", "Invite code is required"),
        { status: 400 }
      );
    }

    const { data: invite, error: inviteError } = await supabase
      .from("friend_invites")
      .select("*")
      .eq("invite_code", inviteCode.toUpperCase())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(buildErrorResponse("INVITE_NOT_FOUND", "Invite not found"), { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json(buildErrorResponse("INVITE_EXPIRED", "Invite has expired"), { status: 410 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(buildErrorResponse("INVITE_ALREADY_HANDLED", "Invite no longer valid"), { status: 410 });
    }

    if (invite.from_user_id === user.id) {
      return NextResponse.json(
        buildErrorResponse("INVITE_SELF_ACCEPT", "Cannot accept your own invite"),
        { status: 400 }
      );
    }

    if (invite.mode === "bring_squad") {
      const readinessError = await ensureBringSquadReady(supabase, user.id);
      if (readinessError) {
        return NextResponse.json(readinessError, { status: 422 });
      }
    }

    const { error: updateError } = await supabase
      .from("friend_invites")
      .update({ to_user_id: user.id, status: "accepted" })
      .eq("id", invite.id);
    if (updateError) {
      return NextResponse.json(buildErrorResponse("INTERNAL_ERROR", "Failed to accept invite", true), { status: 500 });
    }

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

      const { data: match, error: matchError } = await supabase
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
      if (matchError || !match) {
        return NextResponse.json(buildErrorResponse("MATCH_CREATE_FAILED", "Failed to create match", true), {
          status: 500,
        });
      }

      // Link match to invite
      await supabase
        .from("friend_invites")
        .update({ match_id: match.id })
        .eq("id", invite.id);

      return NextResponse.json({ ok: true, status: "match_ready", matchId: match.id, mode: "bring_squad" });
    }

    return NextResponse.json({ ok: true, status: "draft_ready", inviteId: invite.id, mode: "live_draft" });
  } catch {
    return NextResponse.json(
      buildErrorResponse("INTERNAL_ERROR", "Internal server error", true),
      { status: 500 }
    );
  }
}
