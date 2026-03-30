-- Add onboarding and profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_team text,
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS captain_player_id text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Migrate squads table to JSONB format (if still using row-per-player schema)
-- This ensures the store's upsert with player_ids/formation/captain_id works
DO $$
BEGIN
  -- Add columns if the squads table exists but doesn't have player_ids
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'squads')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'squads' AND column_name = 'player_ids')
  THEN
    -- Drop old constraints and columns, recreate with JSONB format
    DROP TABLE IF EXISTS public.squads;
    CREATE TABLE public.squads (
      user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
      formation text NOT NULL DEFAULT '4-3-3',
      player_ids jsonb NOT NULL DEFAULT '[]',
      captain_id text,
      total_cost int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    -- Just add captain_id if squads already has player_ids format
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'squads')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'squads' AND column_name = 'captain_id')
    THEN
      ALTER TABLE public.squads ADD COLUMN captain_id text;
    END IF;
  END IF;
END $$;
