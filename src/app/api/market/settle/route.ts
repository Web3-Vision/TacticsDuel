import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlayerById } from "@/lib/data/players";

type SettlementRpcRow = {
  listing_id: string | null;
  player_id: string | null;
  seller_user_id: string | null;
  buyer_user_id: string | null;
  final_price: number | null;
  error_code: string | null;
  error_message: string | null;
};

function mapSettlementErrorToStatus(errorCode: string): number {
  switch (errorCode) {
    case "unauthorized":
      return 401;
    case "listing_not_found":
      return 404;
    case "seller_mismatch":
      return 403;
    case "no_bids":
    case "bid_below_ask":
    case "seller_no_transfers":
      return 400;
    case "listing_expired":
      return 410;
    case "listing_not_open":
    case "buyer_insufficient_coins":
    case "buyer_already_owns":
    case "seller_missing_player":
    case "buyer_no_slot":
    case "squad_locked":
      return 409;
    case "profile_missing":
    case "squad_missing":
      return 400;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId : "";

    if (!listingId) {
      return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
    }

    const { data: listing, error: listingError } = await supabase
      .from("transfer_listings")
      .select("id, player_id")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const playerMarketValue = getPlayerById(listing.player_id)?.marketValue ?? 0;

    const { data, error } = await supabase.rpc("settle_transfer_listing", {
      p_listing_id: listingId,
      p_seller_user_id: user.id,
      p_player_market_value: playerMarketValue,
      p_now: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: "Settlement failed while persisting changes" }, { status: 500 });
    }

    const row = (Array.isArray(data) && data[0] ? data[0] : null) as SettlementRpcRow | null;
    if (!row) {
      return NextResponse.json({ error: "Settlement failed while persisting changes" }, { status: 500 });
    }

    if (row.error_code) {
      return NextResponse.json(
        { error: row.error_message ?? "Settlement failed" },
        { status: mapSettlementErrorToStatus(row.error_code) },
      );
    }

    return NextResponse.json({
      settlement: {
        listingId: row.listing_id,
        playerId: row.player_id,
        sellerUserId: row.seller_user_id,
        buyerUserId: row.buyer_user_id,
        finalPrice: row.final_price,
      },
    });
  } catch (error) {
    console.error("Transfer settle POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
