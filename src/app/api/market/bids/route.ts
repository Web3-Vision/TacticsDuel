import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
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

    const [{ data: profile, error: profileError }, { data: listing, error: listingError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, coins")
        .eq("id", user.id)
        .single(),
      supabase
        .from("transfer_listings")
        .select("id, seller_user_id, ask_price, current_price, highest_bidder_user_id, status, expires_at")
        .eq("id", listingId)
        .single(),
    ]);

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.status !== "open") {
      return NextResponse.json({ error: "Listing is not open" }, { status: 409 });
    }

    if (listing.seller_user_id === user.id) {
      return NextResponse.json({ error: "Cannot bid on your own listing" }, { status: 400 });
    }

    if (isExpired(listing.expires_at)) {
      await supabase
        .from("transfer_listings")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", listing.id)
        .eq("status", "open");
      return NextResponse.json({ error: "Listing has expired" }, { status: 410 });
    }

    const minBid = listing.highest_bidder_user_id
      ? Math.max(listing.current_price + 1, listing.ask_price)
      : listing.ask_price;

    if (bidAmount < minBid) {
      return NextResponse.json(
        { error: `Bid must be at least ${minBid}` },
        { status: 400 },
      );
    }

    if ((profile.coins ?? 0) < bidAmount) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }

    const { data: bid, error: bidInsertError } = await supabase
      .from("transfer_bids")
      .insert({
        listing_id: listingId,
        bidder_user_id: user.id,
        bid_amount: bidAmount,
      })
      .select("id, listing_id, bidder_user_id, bid_amount, created_at")
      .single();

    if (bidInsertError || !bid) {
      return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
    }

    const { error: listingUpdateError } = await supabase
      .from("transfer_listings")
      .update({
        current_price: bidAmount,
        highest_bidder_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId)
      .eq("status", "open");

    if (listingUpdateError) {
      return NextResponse.json({ error: "Bid accepted but listing update failed" }, { status: 500 });
    }

    return NextResponse.json({ bid }, { status: 201 });
  } catch (error) {
    console.error("Transfer bids POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
