"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPlayerById } from "@/lib/data/players";
import { formatPrice } from "@/lib/utils";
import {
  getBidGuard,
  getMinimumBid,
  type BidGuardReason,
  type TransferListing,
} from "@/lib/market/listings-view-model";

interface TransferMarketBoardProps {
  initialListings: TransferListing[];
  currentUserId: string | null;
  initialCoins: number;
}

type RequestState = "idle" | "loading" | "error";

function formatTimeLeft(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

function reasonToText(reason: BidGuardReason | null, minBid: number): string {
  switch (reason) {
    case "listing_closed":
      return "Listing is no longer open.";
    case "listing_expired":
      return "Listing expired. Refresh to see current market.";
    case "own_listing":
      return "You cannot bid on your own listing.";
    case "invalid_bid":
      return "Enter a positive whole-number bid.";
    case "bid_too_low":
      return `Bid is too low. Minimum is ${formatPrice(minBid)}.`;
    case "insufficient_coins":
      return "Insufficient balance for this bid.";
    default:
      return "";
  }
}

export default function TransferMarketBoard({
  initialListings,
  currentUserId,
  initialCoins,
}: TransferMarketBoardProps) {
  const [listings, setListings] = useState<TransferListing[]>(initialListings);
  const [coins, setCoins] = useState(initialCoins);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [globalError, setGlobalError] = useState<string>("");
  const [bidDrafts, setBidDrafts] = useState<Record<string, string>>({});
  const [bidStatus, setBidStatus] = useState<Record<string, string>>({});
  const [submittingListingId, setSubmittingListingId] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    setRequestState("loading");
    setGlobalError("");

    try {
      const response = await fetch("/api/market/listings", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to fetch listings");
      }

      setListings((payload?.listings as TransferListing[]) ?? []);
      setRequestState("idle");
    } catch (error) {
      setRequestState("error");
      setGlobalError(error instanceof Error ? error.message : "Failed to fetch listings");
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadListings().catch(() => undefined);
    }, 30_000);

    return () => clearInterval(timer);
  }, [loadListings]);

  const openListings = useMemo(() => {
    return listings.filter((listing) => listing.status === "open");
  }, [listings]);

  async function submitBid(listing: TransferListing) {
    const rawDraft = bidDrafts[listing.id] ?? String(getMinimumBid(listing));
    const amount = Number(rawDraft);

    const guard = getBidGuard({
      listing,
      bidAmount: amount,
      currentUserId,
      coins,
    });

    if (!guard.ok) {
      setBidStatus((current) => ({
        ...current,
        [listing.id]: reasonToText(guard.reason, guard.minBid),
      }));
      return;
    }

    setSubmittingListingId(listing.id);
    setBidStatus((current) => ({ ...current, [listing.id]: "Submitting bid..." }));

    try {
      const response = await fetch("/api/market/bids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: listing.id,
          bidAmount: amount,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const errorMessage = payload?.error ?? "Bid failed";
        setBidStatus((current) => ({ ...current, [listing.id]: errorMessage }));
        return;
      }

      setBidStatus((current) => ({ ...current, [listing.id]: "Bid submitted." }));

      // Keep local UI conservative after a successful bid to prevent immediate over-bidding.
      setCoins((current) => Math.max(0, current - amount));

      await loadListings();
    } catch (error) {
      setBidStatus((current) => ({
        ...current,
        [listing.id]: error instanceof Error ? error.message : "Bid failed",
      }));
    } finally {
      setSubmittingListingId(null);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-text-dim uppercase tracking-wide">Transfer Market</p>
            <p className="font-mono text-[11px] text-text-mid mt-1">
              Browse active listings and place bids in real time.
            </p>
          </div>
          <button
            onClick={() => {
              loadListings().catch(() => undefined);
            }}
            className="h-8 px-3 rounded-[4px] border border-border text-text-mid font-mono text-[10px] uppercase tracking-wide hover:border-border-light transition-colors duration-100"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
            <p className="font-mono text-[9px] text-text-dim uppercase">Balance</p>
            <p className="font-mono text-xs text-gold tabular-nums mt-0.5">{formatPrice(coins)}</p>
          </div>
          <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
            <p className="font-mono text-[9px] text-text-dim uppercase">Open Listings</p>
            <p className="font-mono text-xs text-text tabular-nums mt-0.5">{openListings.length}</p>
          </div>
        </div>
      </div>

      {requestState === "error" && (
        <div className="bg-loss/10 border border-loss/40 rounded-md p-3">
          <p className="font-mono text-xs text-loss">{globalError || "Failed to load listings."}</p>
        </div>
      )}

      {requestState === "loading" && listings.length === 0 && (
        <div className="bg-surface border border-border rounded-md p-3 space-y-2">
          <div className="h-3 bg-border rounded-sm w-40 animate-pulse" />
          <div className="h-3 bg-border rounded-sm w-32 animate-pulse" />
          <div className="h-3 bg-border rounded-sm w-48 animate-pulse" />
        </div>
      )}

      {requestState !== "loading" && openListings.length === 0 && (
        <div className="bg-surface border border-border rounded-md p-4 text-center">
          <p className="font-mono text-xs text-text">No active listings right now.</p>
          <p className="font-mono text-[10px] text-text-dim mt-1">
            List players from your squad to seed the market.
          </p>
          <Link
            href="/club/team-hub"
            className="inline-flex mt-3 h-8 px-3 items-center rounded-[4px] border border-border text-text-mid font-mono text-[10px] uppercase tracking-wide hover:border-border-light transition-colors duration-100"
          >
            Open Team Hub
          </Link>
        </div>
      )}

      {openListings.length > 0 && (
        <div className="flex flex-col gap-2 pb-20">
          {openListings.map((listing) => {
            const player = getPlayerById(listing.player_id);
            const minBid = getMinimumBid(listing);
            const draftValue = bidDrafts[listing.id] ?? String(minBid);
            const bidAmount = Number(draftValue);
            const guard = getBidGuard({
              listing,
              bidAmount,
              currentUserId,
              coins,
            });
            const uiReason = reasonToText(guard.reason, guard.minBid);
            const statusMessage = bidStatus[listing.id] ?? uiReason;

            return (
              <article key={listing.id} className="bg-surface border border-border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-text">
                      {player?.name ?? listing.player_id}
                    </p>
                    <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide mt-0.5">
                      {player ? `${player.position} · OVR ${player.overall}` : "Unknown player"}
                    </p>
                  </div>
                  <p className="font-mono text-[10px] text-text-dim uppercase">
                    {formatTimeLeft(listing.expires_at)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
                    <p className="font-mono text-[9px] text-text-dim uppercase">Ask</p>
                    <p className="font-mono text-xs text-text tabular-nums mt-0.5">{formatPrice(listing.ask_price)}</p>
                  </div>
                  <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
                    <p className="font-mono text-[9px] text-text-dim uppercase">Current</p>
                    <p className="font-mono text-xs text-accent tabular-nums mt-0.5">{formatPrice(listing.current_price)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={draftValue}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^0-9]/g, "");
                      setBidDrafts((current) => ({ ...current, [listing.id]: next }));
                      setBidStatus((current) => ({ ...current, [listing.id]: "" }));
                    }}
                    inputMode="numeric"
                    className="h-8 w-full bg-bg border border-border rounded-[4px] px-2.5 font-mono text-xs text-text tabular-nums focus:outline-none focus:border-accent"
                    aria-label={`Bid amount for ${player?.name ?? listing.player_id}`}
                  />
                  <button
                    onClick={() => {
                      submitBid(listing).catch(() => undefined);
                    }}
                    disabled={!guard.ok || submittingListingId === listing.id}
                    className="shrink-0 h-8 px-3 rounded-[4px] font-mono text-[10px] uppercase tracking-wide transition-colors duration-100 bg-accent text-black hover:bg-accent-dim disabled:bg-border disabled:text-text-dim disabled:cursor-not-allowed"
                  >
                    {submittingListingId === listing.id ? "Bidding" : "Bid"}
                  </button>
                </div>

                <p className="font-mono text-[10px] text-text-dim mt-1">
                  Minimum bid: {formatPrice(minBid)}
                </p>

                {statusMessage && (
                  <p
                    className={`font-mono text-[10px] mt-2 ${
                      statusMessage === "Bid submitted." ? "text-accent" : "text-text-dim"
                    }`}
                  >
                    {statusMessage}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
