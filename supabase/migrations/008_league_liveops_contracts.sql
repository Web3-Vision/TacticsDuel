-- ============================================
-- LEAGUE HQ + LIVE OPS CONTRACTS
-- ============================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended_mode text,
  ADD COLUMN IF NOT EXISTS priority_weight int NOT NULL DEFAULT 0;

UPDATE public.missions
SET
  is_featured = COALESCE(is_featured, false),
  recommended_mode = COALESCE(
    recommended_mode,
    CASE
      WHEN mission_key LIKE '%ranked%' THEN 'ranked'
      WHEN mission_key LIKE '%play_any%' THEN 'any'
      ELSE NULL
    END
  ),
  priority_weight = CASE
    WHEN priority_weight > 0 THEN priority_weight
    WHEN mission_type = 'weekly' THEN 70
    ELSE 40
  END;

CREATE INDEX IF NOT EXISTS idx_profiles_division_ladder
  ON public.profiles (division, elo_rating DESC, updated_at ASC, id ASC);

CREATE OR REPLACE FUNCTION public.claim_season_reward(p_reward_id uuid)
RETURNS TABLE (
  reward_id uuid,
  season int,
  highest_division int,
  coins_awarded int,
  claimed boolean,
  already_claimed boolean,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reward public.season_rewards%ROWTYPE;
  v_coins int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::int,
      NULL::int,
      NULL::int,
      false,
      false,
      'unauthorized'::text,
      'Unauthorized'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_reward
  FROM public.season_rewards
  WHERE id = p_reward_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::int,
      NULL::int,
      NULL::int,
      false,
      false,
      'reward_not_found'::text,
      'Reward not found'::text;
    RETURN;
  END IF;

  v_coins := COALESCE(
    NULLIF(v_reward.coins_earned, 0),
    CASE v_reward.highest_division
      WHEN 10 THEN 100
      WHEN 9 THEN 200
      WHEN 8 THEN 350
      WHEN 7 THEN 500
      WHEN 6 THEN 750
      WHEN 5 THEN 1000
      WHEN 4 THEN 1500
      WHEN 3 THEN 2000
      WHEN 2 THEN 3000
      WHEN 1 THEN 5000
      ELSE 100
    END
  );

  IF v_reward.claimed THEN
    RETURN QUERY
    SELECT
      v_reward.id,
      v_reward.season,
      v_reward.highest_division,
      v_coins,
      true,
      true,
      NULL::text,
      NULL::text;
    RETURN;
  END IF;

  UPDATE public.season_rewards
  SET claimed = true,
      coins_earned = v_coins
  WHERE id = v_reward.id;

  UPDATE public.profiles
  SET coins = coins + v_coins,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN QUERY
  SELECT
    v_reward.id,
    v_reward.season,
    v_reward.highest_division,
    v_coins,
    true,
    false,
    NULL::text,
    NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_season_reward(uuid) TO authenticated;
