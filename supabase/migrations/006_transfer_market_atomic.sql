-- ============================================
-- TRANSFER MARKET ATOMIC BID + SETTLEMENT
-- ============================================

CREATE OR REPLACE FUNCTION public.jsonb_replace_player_with_null(
  p_slots jsonb,
  p_player_id text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_elem jsonb;
BEGIN
  FOR v_elem IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb))
  LOOP
    IF v_elem = to_jsonb(p_player_id) THEN
      v_result := v_result || jsonb_build_array(NULL);
    ELSE
      v_result := v_result || jsonb_build_array(v_elem);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.jsonb_insert_player_first_null(
  p_slots jsonb,
  p_player_id text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_inserted boolean := false;
BEGIN
  FOR v_elem IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb))
  LOOP
    IF NOT v_inserted AND v_elem = 'null'::jsonb THEN
      v_result := v_result || jsonb_build_array(to_jsonb(p_player_id));
      v_inserted := true;
    ELSE
      v_result := v_result || jsonb_build_array(v_elem);
    END IF;
  END LOOP;

  IF v_inserted THEN
    RETURN v_result;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_transfer_bid(
  p_listing_id uuid,
  p_bidder_user_id uuid,
  p_bid_amount int,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  bid_id uuid,
  listing_id uuid,
  bidder_user_id uuid,
  bid_amount int,
  created_at timestamptz,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.transfer_listings%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_min_bid int;
  v_bid public.transfer_bids%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_bidder_user_id THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'unauthorized'::text, 'Unauthorized'::text;
    RETURN;
  END IF;

  IF p_bid_amount IS NULL OR p_bid_amount <= 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'invalid_bid_amount'::text, 'bidAmount must be a positive integer'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_listing
  FROM public.transfer_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'listing_not_found'::text, 'Listing not found'::text;
    RETURN;
  END IF;

  IF v_listing.seller_user_id = p_bidder_user_id THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'own_listing'::text, 'Cannot bid on your own listing'::text;
    RETURN;
  END IF;

  IF v_listing.status <> 'open' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'listing_not_open'::text, 'Listing is not open'::text;
    RETURN;
  END IF;

  IF v_listing.expires_at < p_now THEN
    UPDATE public.transfer_listings
    SET status = 'expired',
        updated_at = p_now
    WHERE id = v_listing.id
      AND status = 'open';

    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'listing_expired'::text, 'Listing has expired'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_bidder_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'profile_not_found'::text, 'Profile not found'::text;
    RETURN;
  END IF;

  IF v_profile.squad_locked THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'squad_locked'::text, 'Squad is locked'::text;
    RETURN;
  END IF;

  v_min_bid := CASE
    WHEN v_listing.highest_bidder_user_id IS NULL THEN v_listing.ask_price
    ELSE GREATEST(v_listing.current_price + 1, v_listing.ask_price)
  END;

  IF p_bid_amount < v_min_bid THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'bid_too_low'::text, ('Bid must be at least ' || v_min_bid)::text;
    RETURN;
  END IF;

  IF COALESCE(v_profile.coins, 0) < p_bid_amount THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::int, NULL::timestamptz, 'insufficient_coins'::text, 'Insufficient coins'::text;
    RETURN;
  END IF;

  INSERT INTO public.transfer_bids (listing_id, bidder_user_id, bid_amount)
  VALUES (v_listing.id, p_bidder_user_id, p_bid_amount)
  RETURNING * INTO v_bid;

  UPDATE public.transfer_listings
  SET current_price = p_bid_amount,
      highest_bidder_user_id = p_bidder_user_id,
      updated_at = p_now
  WHERE id = v_listing.id
    AND status = 'open';

  RETURN QUERY SELECT v_bid.id, v_bid.listing_id, v_bid.bidder_user_id, v_bid.bid_amount, v_bid.created_at, NULL::text, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_transfer_listing(
  p_listing_id uuid,
  p_seller_user_id uuid,
  p_player_market_value int,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  listing_id uuid,
  player_id text,
  seller_user_id uuid,
  buyer_user_id uuid,
  final_price int,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.transfer_listings%ROWTYPE;
  v_top_bid public.transfer_bids%ROWTYPE;
  v_seller_profile public.profiles%ROWTYPE;
  v_buyer_profile public.profiles%ROWTYPE;
  v_seller_squad public.squads%ROWTYPE;
  v_buyer_squad public.squads%ROWTYPE;
  v_next_seller_player_ids jsonb;
  v_next_seller_bench_ids jsonb;
  v_next_buyer_player_ids jsonb;
  v_next_buyer_bench_ids jsonb;
  v_player_value int := GREATEST(COALESCE(p_player_market_value, 0), 0);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_seller_user_id THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'unauthorized'::text, 'Unauthorized'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_listing
  FROM public.transfer_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'listing_not_found'::text, 'Listing not found'::text;
    RETURN;
  END IF;

  IF v_listing.seller_user_id <> p_seller_user_id THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'seller_mismatch'::text, 'Only seller can settle this listing'::text;
    RETURN;
  END IF;

  IF v_listing.status <> 'open' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'listing_not_open'::text, 'Listing is not open'::text;
    RETURN;
  END IF;

  IF v_listing.expires_at < p_now THEN
    UPDATE public.transfer_listings
    SET status = 'expired',
        updated_at = p_now
    WHERE id = v_listing.id
      AND status = 'open';

    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'listing_expired'::text, 'Listing has expired'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_top_bid
  FROM public.transfer_bids
  WHERE listing_id = v_listing.id
  ORDER BY bid_amount DESC, created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'no_bids'::text, 'No bids to settle'::text;
    RETURN;
  END IF;

  IF v_top_bid.bid_amount < v_listing.ask_price THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'bid_below_ask'::text, 'Top bid does not meet ask price'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_seller_profile
  FROM public.profiles
  WHERE id = v_listing.seller_user_id
  FOR UPDATE;

  SELECT *
  INTO v_buyer_profile
  FROM public.profiles
  WHERE id = v_top_bid.bidder_user_id
  FOR UPDATE;

  IF v_seller_profile.id IS NULL OR v_buyer_profile.id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'profile_missing'::text, 'Failed to load settlement profiles'::text;
    RETURN;
  END IF;

  IF v_seller_profile.squad_locked OR v_buyer_profile.squad_locked THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'squad_locked'::text, 'One or more squads are locked'::text;
    RETURN;
  END IF;

  IF COALESCE(v_seller_profile.transfers_remaining, 0) <= 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'seller_no_transfers'::text, 'Seller has no transfers remaining'::text;
    RETURN;
  END IF;

  IF COALESCE(v_buyer_profile.coins, 0) < v_top_bid.bid_amount THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'buyer_insufficient_coins'::text, 'Buyer does not have enough coins'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_seller_squad
  FROM public.squads
  WHERE user_id = v_listing.seller_user_id
  FOR UPDATE;

  SELECT *
  INTO v_buyer_squad
  FROM public.squads
  WHERE user_id = v_top_bid.bidder_user_id
  FOR UPDATE;

  IF v_seller_squad.user_id IS NULL OR v_buyer_squad.user_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'squad_missing'::text, 'Both users must have squads before settlement'::text;
    RETURN;
  END IF;

  IF NOT (
    COALESCE(v_seller_squad.player_ids, '[]'::jsonb) @> jsonb_build_array(to_jsonb(v_listing.player_id))
    OR COALESCE(v_seller_squad.bench_ids, '[]'::jsonb) @> jsonb_build_array(to_jsonb(v_listing.player_id))
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'seller_missing_player'::text, 'Seller does not own player'::text;
    RETURN;
  END IF;

  IF (
    COALESCE(v_buyer_squad.player_ids, '[]'::jsonb) @> jsonb_build_array(to_jsonb(v_listing.player_id))
    OR COALESCE(v_buyer_squad.bench_ids, '[]'::jsonb) @> jsonb_build_array(to_jsonb(v_listing.player_id))
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'buyer_already_owns'::text, 'Buyer already owns player'::text;
    RETURN;
  END IF;

  v_next_seller_player_ids := public.jsonb_replace_player_with_null(v_seller_squad.player_ids, v_listing.player_id);
  v_next_seller_bench_ids := public.jsonb_replace_player_with_null(v_seller_squad.bench_ids, v_listing.player_id);

  v_next_buyer_bench_ids := public.jsonb_insert_player_first_null(v_buyer_squad.bench_ids, v_listing.player_id);
  v_next_buyer_player_ids := COALESCE(v_buyer_squad.player_ids, '[]'::jsonb);

  IF v_next_buyer_bench_ids IS NULL THEN
    v_next_buyer_player_ids := public.jsonb_insert_player_first_null(v_buyer_squad.player_ids, v_listing.player_id);
    IF v_next_buyer_player_ids IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::uuid, NULL::int, 'buyer_no_slot'::text, 'Buyer squad has no empty slot'::text;
      RETURN;
    END IF;
    v_next_buyer_bench_ids := COALESCE(v_buyer_squad.bench_ids, '[]'::jsonb);
  END IF;

  UPDATE public.squads
  SET player_ids = v_next_seller_player_ids,
      bench_ids = v_next_seller_bench_ids,
      total_cost = GREATEST(0, COALESCE(v_seller_squad.total_cost, 0) - v_player_value),
      updated_at = p_now
  WHERE user_id = v_listing.seller_user_id;

  UPDATE public.squads
  SET player_ids = v_next_buyer_player_ids,
      bench_ids = v_next_buyer_bench_ids,
      total_cost = COALESCE(v_buyer_squad.total_cost, 0) + v_player_value,
      updated_at = p_now
  WHERE user_id = v_top_bid.bidder_user_id;

  UPDATE public.profiles
  SET coins = COALESCE(v_seller_profile.coins, 0) + v_top_bid.bid_amount,
      transfers_remaining = GREATEST(0, COALESCE(v_seller_profile.transfers_remaining, 0) - 1),
      updated_at = p_now
  WHERE id = v_listing.seller_user_id;

  UPDATE public.profiles
  SET coins = COALESCE(v_buyer_profile.coins, 0) - v_top_bid.bid_amount,
      updated_at = p_now
  WHERE id = v_top_bid.bidder_user_id;

  UPDATE public.transfer_listings
  SET status = 'sold',
      current_price = v_top_bid.bid_amount,
      highest_bidder_user_id = v_top_bid.bidder_user_id,
      settled_at = p_now,
      updated_at = p_now
  WHERE id = v_listing.id
    AND status = 'open';

  RETURN QUERY
  SELECT
    v_listing.id,
    v_listing.player_id,
    v_listing.seller_user_id,
    v_top_bid.bidder_user_id,
    v_top_bid.bid_amount,
    NULL::text,
    NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.place_transfer_bid(uuid, uuid, int, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_transfer_listing(uuid, uuid, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_transfer_bid(uuid, uuid, int, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_transfer_listing(uuid, uuid, int, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_transfer_bid(uuid, uuid, int, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_transfer_listing(uuid, uuid, int, timestamptz) TO service_role;
