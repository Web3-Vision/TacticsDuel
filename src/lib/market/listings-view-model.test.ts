import { describe, expect, it } from "vitest";
import {
  getBidGuard,
  getMinimumBid,
  isListingExpired,
  type TransferListing,
} from "./listings-view-model";

const BASE_NOW_MS = new Date("2026-04-02T09:00:00.000Z").getTime();

const BASE_LISTING: TransferListing = {
  id: "listing-1",
  seller_user_id: "seller-1",
  player_id: "courtois_01",
  ask_price: 100,
  current_price: 100,
  highest_bidder_user_id: null,
  status: "open",
  expires_at: "2026-04-02T10:00:00.000Z",
  created_at: "2026-03-31T10:00:00.000Z",
};

describe("market listing view-model", () => {
  it("uses ask price as minimum bid when there is no current bidder", () => {
    expect(getMinimumBid(BASE_LISTING)).toBe(100);
  });

  it("requires at least +1 when a highest bidder exists", () => {
    const listing: TransferListing = {
      ...BASE_LISTING,
      current_price: 140,
      highest_bidder_user_id: "user-2",
    };

    expect(getMinimumBid(listing)).toBe(141);
  });

  it("guards own listing bids", () => {
    const result = getBidGuard({
      listing: BASE_LISTING,
      bidAmount: 120,
      currentUserId: "seller-1",
      coins: 500,
      nowMs: BASE_NOW_MS,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("own_listing");
  });

  it("guards insufficient balance", () => {
    const result = getBidGuard({
      listing: BASE_LISTING,
      bidAmount: 120,
      currentUserId: "buyer-1",
      coins: 90,
      nowMs: BASE_NOW_MS,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient_coins");
  });

  it("guards invalid bid paths below min bid", () => {
    const listing: TransferListing = {
      ...BASE_LISTING,
      current_price: 180,
      highest_bidder_user_id: "buyer-2",
    };

    const result = getBidGuard({
      listing,
      bidAmount: 179,
      currentUserId: "buyer-1",
      coins: 1000,
      nowMs: BASE_NOW_MS,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bid_too_low");
    expect(result.minBid).toBe(181);
  });

  it("detects expired listings", () => {
    const expired = isListingExpired(BASE_LISTING, new Date("2026-04-02T10:00:00.000Z").getTime());
    expect(expired).toBe(true);
  });
});
