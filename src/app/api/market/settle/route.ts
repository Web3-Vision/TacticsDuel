import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  recalcTotalCost,
  transferPlayerBetweenSquads,
  type SquadRow,
} from "@/lib/transfer-market";

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
      .select("id, seller_user_id, player_id, ask_price, status, expires_at")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.seller_user_id !== user.id) {
      return NextResponse.json({ error: "Only seller can settle this listing" }, { status: 403 });
    }

    if (listing.status !== "open") {
      return NextResponse.json({ error: "Listing is not open" }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    if (new Date(listing.expires_at).getTime() < Date.now()) {
      await supabase
        .from("transfer_listings")
        .update({ status: "expired", updated_at: nowIso })
        .eq("id", listingId)
        .eq("status", "open");
      return NextResponse.json({ error: "Listing has expired" }, { status: 410 });
    }

    const { data: topBid, error: topBidError } = await supabase
      .from("transfer_bids")
      .select("id, bidder_user_id, bid_amount, created_at")
      .eq("listing_id", listingId)
      .order("bid_amount", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (topBidError || !topBid) {
      return NextResponse.json({ error: "No bids to settle" }, { status: 400 });
    }

    if (topBid.bid_amount < listing.ask_price) {
      return NextResponse.json({ error: "Top bid does not meet ask price" }, { status: 400 });
    }

    const serviceSupabase = await createServiceClient();

    const [sellerProfileRes, buyerProfileRes, sellerSquadRes, buyerSquadRes] = await Promise.all([
      serviceSupabase
        .from("profiles")
        .select("id, coins, transfers_remaining")
        .eq("id", listing.seller_user_id)
        .single(),
      serviceSupabase
        .from("profiles")
        .select("id, coins")
        .eq("id", topBid.bidder_user_id)
        .single(),
      serviceSupabase
        .from("squads")
        .select("user_id, formation, player_ids, bench_ids, captain_id, total_cost")
        .eq("user_id", listing.seller_user_id)
        .single(),
      serviceSupabase
        .from("squads")
        .select("user_id, formation, player_ids, bench_ids, captain_id, total_cost")
        .eq("user_id", topBid.bidder_user_id)
        .single(),
    ]);

    if (sellerProfileRes.error || !sellerProfileRes.data || buyerProfileRes.error || !buyerProfileRes.data) {
      return NextResponse.json({ error: "Failed to load settlement profiles" }, { status: 500 });
    }

    if (sellerSquadRes.error || !sellerSquadRes.data || buyerSquadRes.error || !buyerSquadRes.data) {
      return NextResponse.json({ error: "Both users must have squads before settlement" }, { status: 400 });
    }

    const sellerProfile = sellerProfileRes.data;
    const buyerProfile = buyerProfileRes.data;
    const sellerSquad = sellerSquadRes.data as SquadRow;
    const buyerSquad = buyerSquadRes.data as SquadRow;

    if ((buyerProfile.coins ?? 0) < topBid.bid_amount) {
      return NextResponse.json({ error: "Buyer does not have enough coins" }, { status: 409 });
    }

    const transferResult = transferPlayerBetweenSquads(sellerSquad, buyerSquad, listing.player_id);
    if (!transferResult.ok) {
      return NextResponse.json({ error: transferResult.reason ?? "Failed to transfer player" }, { status: 409 });
    }

    const sellerTotalCost = recalcTotalCost(
      transferResult.sellerPlayerIds ?? [],
      transferResult.sellerBenchIds ?? [],
    );
    const buyerTotalCost = recalcTotalCost(
      transferResult.buyerPlayerIds ?? [],
      transferResult.buyerBenchIds ?? [],
    );

    const sellerTransfersRemaining = Math.max(0, (sellerProfile.transfers_remaining ?? 0) - 1);

    const [sellerSquadUpdate, buyerSquadUpdate, sellerProfileUpdate, buyerProfileUpdate, listingUpdate] = await Promise.all([
      serviceSupabase
        .from("squads")
        .update({
          player_ids: transferResult.sellerPlayerIds,
          bench_ids: transferResult.sellerBenchIds,
          total_cost: sellerTotalCost,
          updated_at: nowIso,
        })
        .eq("user_id", listing.seller_user_id),
      serviceSupabase
        .from("squads")
        .update({
          player_ids: transferResult.buyerPlayerIds,
          bench_ids: transferResult.buyerBenchIds,
          total_cost: buyerTotalCost,
          updated_at: nowIso,
        })
        .eq("user_id", topBid.bidder_user_id),
      serviceSupabase
        .from("profiles")
        .update({
          coins: (sellerProfile.coins ?? 0) + topBid.bid_amount,
          transfers_remaining: sellerTransfersRemaining,
          updated_at: nowIso,
        })
        .eq("id", listing.seller_user_id),
      serviceSupabase
        .from("profiles")
        .update({
          coins: (buyerProfile.coins ?? 0) - topBid.bid_amount,
          updated_at: nowIso,
        })
        .eq("id", topBid.bidder_user_id),
      serviceSupabase
        .from("transfer_listings")
        .update({
          status: "sold",
          current_price: topBid.bid_amount,
          highest_bidder_user_id: topBid.bidder_user_id,
          settled_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", listing.id)
        .eq("status", "open"),
    ]);

    if (
      sellerSquadUpdate.error ||
      buyerSquadUpdate.error ||
      sellerProfileUpdate.error ||
      buyerProfileUpdate.error ||
      listingUpdate.error
    ) {
      console.error("Transfer settlement partial failure", {
        sellerSquadUpdate: sellerSquadUpdate.error,
        buyerSquadUpdate: buyerSquadUpdate.error,
        sellerProfileUpdate: sellerProfileUpdate.error,
        buyerProfileUpdate: buyerProfileUpdate.error,
        listingUpdate: listingUpdate.error,
      });
      return NextResponse.json(
        { error: "Settlement failed while persisting changes" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      settlement: {
        listingId: listing.id,
        playerId: listing.player_id,
        sellerUserId: listing.seller_user_id,
        buyerUserId: topBid.bidder_user_id,
        finalPrice: topBid.bid_amount,
      },
    });
  } catch (error) {
    console.error("Transfer settle POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
