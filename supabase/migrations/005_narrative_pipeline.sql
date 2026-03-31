-- ============================================
-- NARRATIVE PIPELINE (INBOX, NEWS, ROUND RECAP)
-- ============================================

CREATE TABLE IF NOT EXISTS public.match_round_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_index int NOT NULL DEFAULT 1,
  event_digest text NOT NULL,
  recap jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, round_index)
);

CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  message_key text NOT NULL,
  event_digest text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id, message_key)
);

CREATE TABLE IF NOT EXISTS public.news_feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  story_key text NOT NULL,
  event_digest text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, story_key)
);

CREATE INDEX IF NOT EXISTS idx_match_round_recaps_match_created
  ON public.match_round_recaps(match_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_user_created
  ON public.inbox_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_feed_items_created
  ON public.news_feed_items(created_at DESC);

ALTER TABLE public.match_round_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Round recap visible to participants" ON public.match_round_recaps
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND (auth.uid() = m.home_user_id OR auth.uid() = m.away_user_id)
  )
);

CREATE POLICY "Match participants can insert round recaps" ON public.match_round_recaps
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND (auth.uid() = m.home_user_id OR auth.uid() = m.away_user_id)
  )
);

CREATE POLICY "Match participants can update round recaps" ON public.match_round_recaps
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND (auth.uid() = m.home_user_id OR auth.uid() = m.away_user_id)
  )
);

CREATE POLICY "Users can view own inbox" ON public.inbox_messages
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Match participants can insert inbox messages" ON public.inbox_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND (auth.uid() = m.home_user_id OR auth.uid() = m.away_user_id)
      AND (user_id = m.home_user_id OR user_id = m.away_user_id)
  )
);

CREATE POLICY "Users can view news feed" ON public.news_feed_items
FOR SELECT USING (true);

CREATE POLICY "Match participants can insert news feed" ON public.news_feed_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND (auth.uid() = m.home_user_id OR auth.uid() = m.away_user_id)
  )
);
