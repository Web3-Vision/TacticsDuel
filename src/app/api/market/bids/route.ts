import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type BidRpcRow = {
  bid_id: string | null;
  listing_id: string | null;
  bidder_user_id: string | null;
  bid_amount: number | null;
  created_at: string | null;
  error_code: string | null;
  error_message: string | null;
};

function mapBidErrorToStatus(errorCode: string): number {
  switch (errorCode) {
    case "unauthorized":
      return 401;
    case "invalid_bid_amount":
    case "own_listing":
    case "bid_too_low":
      return 400;
    case "listing_not_found":
    case "profile_not_found":
      return 404;
    case "listing_expired":
      return 410;
    case "listing_not_open":
    case "squad_locked":
      return 409;
    case "insufficient_coins":
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
    const bidAmount = Number(body?.bidAmount);

    if (!listingId) {
      return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
    }

    if (!Number.isInteger(bidAmount) || bidAmount <= 0) {
      return NextResponse.json({ error: "bidAmount must be a positive integer" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("place_transfer_bid", {
      p_listing_id: listingId,
      p_bidder_user_id: user.id,
      p_bid_amount: bidAmount,
      p_now: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
    }

    const row = (Array.isArray(data) && data[0] ? data[0] : null) as BidRpcRow | null;
    if (!row) {
      return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
    }

    if (row.error_code) {
      return NextResponse.json(
        { error: row.error_message ?? "Failed to place bid" },
        { status: mapBidErrorToStatus(row.error_code) },
      );
    }

    return NextResponse.json({
      bid: {
        id: row.bid_id,
        listing_id: row.listing_id,
        bidder_user_id: row.bidder_user_id,
        bid_amount: row.bid_amount,
        created_at: row.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Transfer bids POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
