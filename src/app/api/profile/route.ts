import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  ACCOUNT_STATUSES,
  MANAGER_ARCHETYPES,
  HAIR_STYLES,
  HAIR_COLORS,
  SKIN_TONES,
  BEARD_STYLES,
  type AccountStatus,
} from "@/lib/profile-options";

function parseMissingColumnFromError(error: { code?: string; message?: string } | null) {
  if (!error || error.code !== "PGRST204") return null;
  const match = /Could not find the '([^']+)' column/i.exec(error.message ?? "");
  return match?.[1] ?? null;
}

function buildProfileSeed(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const usernameFromMetadata =
    typeof metadata.username === "string" ? metadata.username.trim() : "";
  const clubNameFromMetadata =
    typeof metadata.club_name === "string" ? metadata.club_name.trim() : "";
  const emailPrefix = user.email?.split("@")[0]?.trim() ?? "";
  const uniqueSuffix = user.id.slice(0, 6);
  const usernameBase = usernameFromMetadata || emailPrefix || "manager";
  const safeUsernameBase = usernameBase.replace(/\s+/g, "_").slice(0, 24) || "manager";

  return {
    id: user.id,
    username: `${safeUsernameBase}_${uniqueSuffix}`,
    club_name: clubNameFromMetadata || `FC ${uniqueSuffix}`,
  };
}

async function ensureProfileExists(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const serviceSupabase = await createServiceClient();
  const seed = buildProfileSeed(user);
  const { error } = await serviceSupabase.from("profiles").upsert(seed, { onConflict: "id" });
  return error;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const requestedManagerName =
    typeof body.manager_name === "string" ? body.manager_name.trim() : null;

  if (body.favorite_team !== undefined) {
    updates.favorite_team =
      typeof body.favorite_team === "string" && body.favorite_team.trim().length > 0
        ? body.favorite_team.trim().slice(0, 60)
        : null;
  }

  if (body.manager_name !== undefined) {
    const managerName = requestedManagerName ?? "";
    if (managerName.length > 0 && managerName.length < 2) {
      return NextResponse.json({ error: "Manager name must be at least 2 characters" }, { status: 400 });
    }
    if (managerName.length > 40) {
      return NextResponse.json({ error: "Manager name must be 40 characters or less" }, { status: 400 });
    }
    updates.manager_name = managerName.length > 0 ? managerName : null;
  }

  if (body.age !== undefined) {
    if (body.age === null || body.age === "") {
      updates.age = null;
    } else if (typeof body.age === "number" && Number.isInteger(body.age) && body.age >= 13 && body.age <= 80) {
      updates.age = body.age;
    } else {
      return NextResponse.json({ error: "Age must be an integer between 13 and 80" }, { status: 400 });
    }
  }

  if (body.manager_avatar_archetype !== undefined) {
    if (!MANAGER_ARCHETYPES.includes(body.manager_avatar_archetype)) {
      return NextResponse.json({ error: "Invalid manager archetype" }, { status: 400 });
    }
    updates.manager_avatar_archetype = body.manager_avatar_archetype;
  }

  if (body.manager_hair_style !== undefined) {
    if (!HAIR_STYLES.includes(body.manager_hair_style)) {
      return NextResponse.json({ error: "Invalid hair style" }, { status: 400 });
    }
    updates.manager_hair_style = body.manager_hair_style;
  }

  if (body.manager_hair_color !== undefined) {
    if (!HAIR_COLORS.includes(body.manager_hair_color)) {
      return NextResponse.json({ error: "Invalid hair color" }, { status: 400 });
    }
    updates.manager_hair_color = body.manager_hair_color;
  }

  if (body.manager_skin_tone !== undefined) {
    if (!SKIN_TONES.includes(body.manager_skin_tone)) {
      return NextResponse.json({ error: "Invalid skin tone" }, { status: 400 });
    }
    updates.manager_skin_tone = body.manager_skin_tone;
  }

  if (body.manager_beard_style !== undefined) {
    if (!BEARD_STYLES.includes(body.manager_beard_style)) {
      return NextResponse.json({ error: "Invalid beard style" }, { status: 400 });
    }
    updates.manager_beard_style = body.manager_beard_style;
  }

  if (body.captain_player_id !== undefined) {
    updates.captain_player_id =
      typeof body.captain_player_id === "string" && body.captain_player_id.length > 0
        ? body.captain_player_id
        : null;
  }

  if (body.onboarding_completed !== undefined) {
    updates.onboarding_completed = Boolean(body.onboarding_completed);
  }

  if (body.account_status !== undefined) {
    if (!ACCOUNT_STATUSES.includes(body.account_status)) {
      return NextResponse.json({ error: "Invalid account status" }, { status: 400 });
    }

    const nextStatus = body.account_status as AccountStatus;
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .single();

    if (currentProfile?.account_status === "deactivated" && nextStatus !== "deactivated") {
      return NextResponse.json(
        { error: "Deactivated accounts cannot be reactivated from this endpoint" },
        { status: 400 }
      );
    }

    updates.account_status = nextStatus;
    if (nextStatus === "paused") {
      updates.paused_at = new Date().toISOString();
      updates.deactivated_at = null;
    }
    if (nextStatus === "active") {
      updates.paused_at = null;
      updates.deactivated_at = null;
    }
    if (nextStatus === "deactivated") {
      updates.paused_at = null;
      updates.deactivated_at = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const fallbackUpdates: Record<string, unknown> = { ...updates };
  let profileSeeded = false;
  while (true) {
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update(fallbackUpdates)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (!error && updatedProfile) break;

    if (!error && !updatedProfile) {
      if (profileSeeded) {
        return NextResponse.json({ error: "Profile record could not be created" }, { status: 500 });
      }

      const seedError = await ensureProfileExists(user);
      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }

      profileSeeded = true;
      continue;
    }

    const missingColumn = parseMissingColumnFromError(error);
    if (!missingColumn || !(missingColumn in fallbackUpdates)) {
      return NextResponse.json({ error: error?.message ?? "Failed to update profile" }, { status: 500 });
    }

    if (
      missingColumn === "manager_name" &&
      requestedManagerName &&
      !("username" in fallbackUpdates)
    ) {
      // Compatibility path for older profile schemas without manager_name.
      // Persisting into username keeps manager identity edits visible after reload.
      fallbackUpdates.username = requestedManagerName;
    }

    delete fallbackUpdates[missingColumn];
    if (Object.keys(fallbackUpdates).length === 0) {
      return NextResponse.json({ error: "No supported fields available for this profile schema" }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
