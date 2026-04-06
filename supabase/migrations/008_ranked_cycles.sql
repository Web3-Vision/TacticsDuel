-- ============================================
-- RANKED CYCLE & PROGRESSION COLUMNS
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS squad_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ranked_matches_in_cycle int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transfers_remaining int NOT NULL DEFAULT 2;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS squad_confirmed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cycle_id int NOT NULL DEFAULT 0;

-- Division season tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division_wins int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division_draws int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division_losses int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division_season int NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS division_matches_played int NOT NULL DEFAULT 0;

-- ============================================
-- MISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_type text NOT NULL, -- 'daily', 'weekly', 'season'
  mission_key text NOT NULL,  -- 'play_ranked_3', 'win_match', etc.
  description text NOT NULL,
  target int NOT NULL,
  progress int NOT NULL DEFAULT 0,
  reward_coins int NOT NULL DEFAULT 0,
  reward_type text NOT NULL DEFAULT 'coins',
  expires_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own missions" ON public.missions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own missions" ON public.missions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own missions" ON public.missions FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- MATCH TABLE: allow update for simulation
-- ============================================
CREATE POLICY "Match participants can update" ON public.matches FOR UPDATE
  USING (auth.uid() = home_user_id OR auth.uid() = away_user_id);

-- Allow inserting matches where away_user_id is null (ghost opponents)
DROP POLICY IF EXISTS "Users can insert matches" ON public.matches;
CREATE POLICY "Users can insert matches" ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = home_user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_missions_user ON public.missions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_division ON public.profiles(division);
CREATE INDEX IF NOT EXISTS idx_matches_completed ON public.matches(completed_at) WHERE status = 'completed';
