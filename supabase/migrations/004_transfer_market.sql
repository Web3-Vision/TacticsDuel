-- ============================================
-- TRANSFER MARKET
-- ============================================

CREATE TYPE transfer_listing_status AS ENUM ('open', 'sold', 'cancelled', 'expired');

CREATE TABLE IF NOT EXISTS public.transfer_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  ask_price int NOT NULL CHECK (ask_price > 0),
  current_price int NOT NULL CHECK (current_price > 0),
  highest_bidder_user_id uuid REFERENCES public.profiles(id),
  status transfer_listing_status NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transfer_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.transfer_listings(id) ON DELETE CASCADE,
  bidder_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bid_amount int NOT NULL CHECK (bid_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_listings_status_expires
  ON public.transfer_listings(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_transfer_listings_player_status
  ON public.transfer_listings(player_id, status);

CREATE INDEX IF NOT EXISTS idx_transfer_bids_listing_amount
  ON public.transfer_bids(listing_id, bid_amount DESC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_open_listing_per_seller_player
  ON public.transfer_listings(seller_user_id, player_id)
  WHERE status = 'open';

ALTER TABLE public.transfer_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_bids ENABLE ROW LEVEL SECURITY;

-- Listings are visible if open, or if user is a participant.
CREATE POLICY "Transfer listings visible" ON public.transfer_listings
FOR SELECT USING (
  status = 'open'
  OR auth.uid() = seller_user_id
  OR auth.uid() = highest_bidder_user_id
);

CREATE POLICY "Users can create own listing" ON public.transfer_listings
FOR INSERT WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can update own listing" ON public.transfer_listings
FOR UPDATE USING (auth.uid() = seller_user_id)
WITH CHECK (auth.uid() = seller_user_id);

-- Bids are visible to bidder and listing seller.
CREATE POLICY "Transfer bids visible to participants" ON public.transfer_bids
FOR SELECT USING (
  auth.uid() = bidder_user_id
  OR EXISTS (
    SELECT 1
    FROM public.transfer_listings l
    WHERE l.id = listing_id
      AND (l.seller_user_id = auth.uid() OR l.highest_bidder_user_id = auth.uid())
  )
);

CREATE POLICY "Users can insert own bids" ON public.transfer_bids
FOR INSERT WITH CHECK (auth.uid() = bidder_user_id);
