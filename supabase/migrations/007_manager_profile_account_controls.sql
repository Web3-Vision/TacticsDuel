-- Manager avatar customization and account lifecycle controls
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS manager_avatar_archetype text,
  ADD COLUMN IF NOT EXISTS manager_hair_style text,
  ADD COLUMN IF NOT EXISTS manager_hair_color text,
  ADD COLUMN IF NOT EXISTS manager_skin_tone text,
  ADD COLUMN IF NOT EXISTS manager_beard_style text,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'paused', 'deactivated'));
  END IF;
END $$;

UPDATE public.profiles
SET manager_name = COALESCE(NULLIF(manager_name, ''), username)
WHERE manager_name IS NULL OR manager_name = '';
