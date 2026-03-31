import { createClient } from "@/lib/supabase/server";
import TransferMarketBoard from "@/components/market/TransferMarketBoard";
import type { TransferListing } from "@/lib/market/listings-view-model";

export default async function ClubMarketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: listings }, profileResult] = await Promise.all([
    supabase
      .from("transfer_listings")
      .select("id, seller_user_id, player_id, ask_price, current_price, highest_bidder_user_id, status, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    user
      ? supabase
          .from("profiles")
          .select("id, coins")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <TransferMarketBoard
      initialListings={((listings as TransferListing[] | null) ?? []).filter((listing) => listing.status === "open")}
      currentUserId={user?.id ?? null}
      initialCoins={profileResult.data?.coins ?? 0}
    />
  );
}
