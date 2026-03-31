export type TransferListingStatus = "open" | "expired" | "sold";

export interface TransferListing {
  id: string;
  seller_user_id: string;
  player_id: string;
  ask_price: number;
  current_price: number;
  highest_bidder_user_id: string | null;
  status: TransferListingStatus | string;
  expires_at: string;
  created_at: string;
}

export type BidGuardReason =
  | "listing_closed"
  | "listing_expired"
  | "own_listing"
  | "invalid_bid"
  | "bid_too_low"
  | "insufficient_coins";

export interface BidGuardInput {
  listing: TransferListing;
  bidAmount: number;
  currentUserId: string | null;
  coins: number;
  nowMs?: number;
}

export interface BidGuardResult {
  ok: boolean;
  reason: BidGuardReason | null;
  minBid: number;
}

export function getMinimumBid(listing: TransferListing): number {
  if (listing.highest_bidder_user_id) {
    return Math.max(listing.current_price + 1, listing.ask_price);
  }
  return listing.ask_price;
}

export function isListingExpired(listing: TransferListing, nowMs = Date.now()): boolean {
  return new Date(listing.expires_at).getTime() <= nowMs;
}

export function getBidGuard(input: BidGuardInput): BidGuardResult {
  const minBid = getMinimumBid(input.listing);

  if (input.listing.status !== "open") {
    return { ok: false, reason: "listing_closed", minBid };
  }

  if (isListingExpired(input.listing, input.nowMs)) {
    return { ok: false, reason: "listing_expired", minBid };
  }

  if (input.currentUserId && input.listing.seller_user_id === input.currentUserId) {
    return { ok: false, reason: "own_listing", minBid };
  }

  if (!Number.isInteger(input.bidAmount) || input.bidAmount <= 0) {
    return { ok: false, reason: "invalid_bid", minBid };
  }

  if (input.bidAmount < minBid) {
    return { ok: false, reason: "bid_too_low", minBid };
  }

  if (input.coins < input.bidAmount) {
    return { ok: false, reason: "insufficient_coins", minBid };
  }

  return { ok: true, reason: null, minBid };
}
