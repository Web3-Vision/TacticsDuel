import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPlayerInSquad, validateAskPrice } from "@/lib/transfer-market";

const DEFAULT_EXPIRY_HOURS = 24;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from("transfer_listings")
      .update({ status: "expired", updated_at: nowIso })
      .eq("status", "open")
      .lt("expires_at", nowIso);

    const { data: listings, error } = await supabase
      .from("transfer_listings")
      .select("id, seller_user_id, player_id, ask_price, current_price, highest_bidder_user_id, status, expires_at, settled_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 });
    }

    return NextResponse.json({ listings: listings ?? [] });
  } catch (error) {
    console.error("Transfer listings GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
    const playerId = typeof body?.playerId === "string" ? body.playerId : "";
    const askPrice = Number(body?.askPrice);
    const expiresInHoursRaw = Number(body?.expiresInHours);

    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }

    const askValidation = validateAskPrice(playerId, askPrice);
    if (!askValidation.ok) {
      return NextResponse.json(
        {
          error: askValidation.reason,
          range: askValidation.range,
        },
        { status: 400 },
      );
    }

    const expiresInHours = Number.isInteger(expiresInHoursRaw)
      ? Math.min(72, Math.max(1, expiresInHoursRaw))
      : DEFAULT_EXPIRY_HOURS;

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const [{ data: profile, error: profileError }, { data: squad, error: squadError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, transfers_remaining")
        .eq("id", user.id)
        .single(),
      supabase
        .from("squads")
        .select("user_id, formation, player_ids, bench_ids, captain_id, total_cost")
        .eq("user_id", user.id)
        .single(),
    ]);

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (squadError || !squad) {
      return NextResponse.json({ error: "Squad not found" }, { status: 404 });
    }

    if ((profile.transfers_remaining ?? 0) <= 0) {
      return NextResponse.json({ error: "No transfers remaining" }, { status: 400 });
    }

    if (!hasPlayerInSquad(squad, playerId)) {
      return NextResponse.json({ error: "Player is not in your squad" }, { status: 400 });
    }

    const { data: existingOpenListing } = await supabase
      .from("transfer_listings")
      .select("id")
      .eq("seller_user_id", user.id)
      .eq("player_id", playerId)
      .eq("status", "open")
      .limit(1)
      .single();

    if (existingOpenListing) {
      return NextResponse.json({ error: "Player already has an open listing" }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const { data: listing, error: insertError } = await supabase
      .from("transfer_listings")
      .insert({
        seller_user_id: user.id,
        player_id: playerId,
        ask_price: askPrice,
        current_price: askPrice,
        status: "open",
        expires_at: expiresAt,
        updated_at: nowIso,
      })
      .select("id, seller_user_id, player_id, ask_price, current_price, highest_bidder_user_id, status, expires_at, created_at")
      .single();

    if (insertError || !listing) {
      return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
    }

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    console.error("Transfer listings POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
