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
type MessageTone = "neutral" | "success" | "warning";

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

function resolveMessageTone(message: string | undefined): MessageTone {
  if (!message) return "neutral";
  if (message.includes("submitted") || message.includes("settled")) return "success";
  if (message.includes("failed") || message.includes("error")) return "warning";
  return "neutral";
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
  const [settleStatus, setSettleStatus] = useState<Record<string, string>>({});
  const [settlingListingId, setSettlingListingId] = useState<string | null>(null);

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

  const sellerOpenListings = useMemo(() => {
    if (!currentUserId) return [];
    return openListings.filter((listing) => listing.seller_user_id === currentUserId);
  }, [currentUserId, openListings]);

  const readyToSettleCount = useMemo(() => {
    return sellerOpenListings.filter((listing) => {
      const isExpired = new Date(listing.expires_at).getTime() <= Date.now();
      return !isExpired && !!listing.highest_bidder_user_id && listing.current_price >= listing.ask_price;
    }).length;
  }, [sellerOpenListings]);

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

  async function settleListing(listing: TransferListing) {
    setSettlingListingId(listing.id);
    setSettleStatus((current) => ({ ...current, [listing.id]: "Settling sale..." }));
    try {
      const response = await fetch("/api/market/settle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: listing.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setSettleStatus((current) => ({
          ...current,
          [listing.id]: payload?.error ?? "Settlement failed",
        }));
        return;
      }

      const finalPrice = Number(payload?.settlement?.finalPrice ?? listing.current_price);
      setSettleStatus((current) => ({
        ...current,
        [listing.id]: `Sale settled for ${formatPrice(finalPrice)}.`,
      }));
      await loadListings();
    } catch (error) {
      setSettleStatus((current) => ({
        ...current,
        [listing.id]: error instanceof Error ? error.message : "Settlement failed",
      }));
    } finally {
      setSettlingListingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 pb-20 md:p-4 md:pb-24">
      <section className="glass-panel panel-enter rounded-xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-title">Transfer Market</p>
            <p className="mt-1 font-mono text-xs text-text-mid">
              Place bids, monitor your listings, and settle winning sales from one board.
            </p>
          </div>
          <button
            onClick={() => {
              loadListings().catch(() => undefined);
            }}
            className="h-8 rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-mid transition-colors duration-150 hover:border-border-light"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">Balance</p>
            <p className="mt-0.5 font-mono text-xs text-gold tabular-nums">{formatPrice(coins)}</p>
          </div>
          <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">Open Listings</p>
            <p className="mt-0.5 font-mono text-xs text-text tabular-nums">{openListings.length}</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">Your Listings</p>
            <p className="mt-0.5 font-mono text-xs text-text tabular-nums">{sellerOpenListings.length}</p>
          </div>
          <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">Ready To Settle</p>
            <p className="mt-0.5 font-mono text-xs text-accent tabular-nums">{readyToSettleCount}</p>
          </div>
        </div>
      </section>

      {requestState === "error" && (
        <div className="rounded-md border border-loss/40 bg-loss/10 p-3">
          <p className="font-mono text-xs text-loss">{globalError || "Failed to load listings."}</p>
        </div>
      )}

      {requestState === "loading" && listings.length === 0 && (
        <div className="glass-panel rounded-xl p-3 space-y-2">
          <div className="h-3 w-40 rounded-sm loading-shimmer" />
          <div className="h-3 w-32 rounded-sm loading-shimmer" />
          <div className="h-3 w-48 rounded-sm loading-shimmer" />
        </div>
      )}

      {requestState !== "loading" && openListings.length === 0 && (
        <div className="glass-panel panel-enter rounded-xl p-4 text-center">
          <p className="font-mono text-xs text-text">No active listings right now.</p>
          <p className="mt-1 font-mono text-[10px] text-text-dim">
            List players from your squad to seed the market.
          </p>
          <Link
            href="/club/team-hub"
            className="mt-3 inline-flex h-8 items-center rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-mid transition-colors duration-150 hover:border-border-light"
          >
            Open Team Hub
          </Link>
        </div>
      )}

      {openListings.length > 0 && (
        <div className="flex flex-col gap-2">
          {openListings.map((listing) => {
            const player = getPlayerById(listing.player_id);
            const minBid = getMinimumBid(listing);
            const draftValue = bidDrafts[listing.id] ?? String(minBid);
            const bidAmount = Number(draftValue);
            const isSeller = currentUserId != null && listing.seller_user_id === currentUserId;
            const isExpired = new Date(listing.expires_at).getTime() <= Date.now();
            const hasWinningBid = !!listing.highest_bidder_user_id && listing.current_price >= listing.ask_price;
            const canSettle = isSeller && !isExpired && hasWinningBid;
            const guard = getBidGuard({
              listing,
              bidAmount,
              currentUserId,
              coins,
            });
            const uiReason = reasonToText(guard.reason, guard.minBid);
            const statusMessage = bidStatus[listing.id] ?? settleStatus[listing.id] ?? uiReason;
            const messageTone = resolveMessageTone(statusMessage);

            return (
              <article key={listing.id} className="glass-panel panel-enter rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-text">
                      {player?.name ?? listing.player_id}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
                      {player ? `${player.position} · OVR ${player.overall}` : "Unknown player"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-mono text-[10px] uppercase text-text-dim">
                      {formatTimeLeft(listing.expires_at)}
                    </p>
                    {isSeller && (
                      <span className="rounded-sm border border-gold/45 bg-gold/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-gold">
                        Your listing
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">Ask</p>
                    <p className="mt-0.5 font-mono text-xs text-text tabular-nums">{formatPrice(listing.ask_price)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">Current</p>
                    <p className="mt-0.5 font-mono text-xs text-accent tabular-nums">{formatPrice(listing.current_price)}</p>
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
                    className="h-9 w-full rounded-md border border-border bg-bg/65 px-2.5 font-mono text-xs text-text tabular-nums focus:border-accent focus:outline-none"
                    aria-label={`Bid amount for ${player?.name ?? listing.player_id}`}
                    disabled={isSeller}
                  />
                  <button
                    onClick={() => {
                      submitBid(listing).catch(() => undefined);
                    }}
                    disabled={!guard.ok || submittingListingId === listing.id || isSeller}
                    className="h-9 shrink-0 rounded-md bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-black transition-colors duration-150 hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-border disabled:text-text-dim"
                  >
                    {isSeller ? "Owner" : submittingListingId === listing.id ? "Bidding" : "Bid"}
                  </button>
                </div>

                <p className="mt-1 font-mono text-[10px] text-text-dim">
                  Minimum bid: {formatPrice(minBid)}
                </p>

                {isSeller && (
                  <div className="mt-2 rounded-md border border-border bg-bg/55 px-2.5 py-2">
                    <p className="font-mono text-[10px] text-text-mid">
                      {canSettle
                        ? "Ask met. Settle now to finalize transfer."
                        : "Waiting for bids at or above ask before settlement."}
                    </p>
                    <button
                      onClick={() => {
                        settleListing(listing).catch(() => undefined);
                      }}
                      disabled={!canSettle || settlingListingId === listing.id}
                      className="mt-2 h-8 rounded-md border border-accent px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-colors duration-150 hover:bg-accent/10 disabled:cursor-not-allowed disabled:border-border disabled:text-text-dim"
                    >
                      {settlingListingId === listing.id ? "Settling..." : "Settle Sale"}
                    </button>
                  </div>
                )}

                {statusMessage && (
                  <p
                    className={`font-mono text-[10px] mt-2 ${
                      messageTone === "success"
                        ? "text-accent"
                        : messageTone === "warning"
                          ? "text-loss"
                          : "text-text-dim"
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
