-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================
-- USERS / PROFILES
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  club_name text not null,
  division int not null default 10,
  division_points int not null default 0,
  elo_rating int not null default 1000,
  coins int not null default 500,
  season_pass boolean not null default false,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, club_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Manager_' || left(new.id::text, 6)),
    coalesce(new.raw_user_meta_data->>'club_name', 'FC ' || left(new.id::text, 6))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- SQUADS
-- ============================================
create table public.squads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id text not null,
  position_slot int not null,
  is_starter boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, player_id),
  unique(user_id, position_slot)
);

-- ============================================
-- TACTICS
-- ============================================
create table public.tactics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  formation text not null default '4-3-3',
  mentality text not null default 'Balanced',
  tempo text not null default 'Normal',
  pressing text not null default 'Medium',
  width text not null default 'Normal',
  ht_if_losing_formation text,
  ht_if_losing_mentality text default 'Attacking',
  ht_if_winning_mentality text default 'Defensive',
  updated_at timestamptz not null default now()
);

-- ============================================
-- MATCHES
-- ============================================
create type match_type as enum ('ranked', 'friendly', 'draft', 'ai');
create type match_status as enum ('pending', 'accepted', 'simulating', 'completed', 'cancelled');

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  home_user_id uuid not null references public.profiles(id),
  away_user_id uuid references public.profiles(id),
  match_type match_type not null default 'ranked',
  status match_status not null default 'pending',

  home_squad jsonb not null default '[]',
  away_squad jsonb not null default '[]',
  home_tactics jsonb not null default '{}',
  away_tactics jsonb not null default '{}',

  home_score int,
  away_score int,
  home_possession int,
  away_possession int,
  home_shots int,
  away_shots int,
  home_on_target int,
  away_on_target int,

  home_elo_before int,
  away_elo_before int,
  home_elo_change int,
  away_elo_change int,
  home_division_points_change int,
  away_division_points_change int,

  events jsonb not null default '[]',

  season int not null default 1,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_matches_status on public.matches(status) where status = 'pending';
create index idx_matches_home_user on public.matches(home_user_id);
create index idx_matches_away_user on public.matches(away_user_id);

-- ============================================
-- MATCHMAKING QUEUE
-- ============================================
create table public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  elo_rating int not null,
  division int not null,
  joined_at timestamptz not null default now()
);

-- ============================================
-- FRIEND INVITES
-- ============================================
create type invite_status as enum ('pending', 'accepted', 'declined', 'expired');
create type invite_mode as enum ('bring_squad', 'live_draft');

create table public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid references public.profiles(id),
  invite_code text unique not null default left(gen_random_uuid()::text, 8),
  mode invite_mode not null default 'bring_squad',
  status invite_status not null default 'pending',
  match_id uuid references public.matches(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);

-- ============================================
-- DRAFT SESSIONS
-- ============================================
create type draft_status as enum ('waiting', 'drafting', 'completed');

create table public.draft_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.friend_invites(id),
  user_a uuid not null references public.profiles(id),
  user_b uuid references public.profiles(id),
  player_pool jsonb not null default '[]',
  picks jsonb not null default '[]',
  current_pick int not null default 1,
  current_picker uuid,
  status draft_status not null default 'waiting',
  budget_per_team numeric not null default 200,
  pick_time_limit int not null default 30,
  created_at timestamptz not null default now()
);

-- ============================================
-- SEASON REWARDS
-- ============================================
create table public.season_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  season int not null,
  highest_division int not null,
  coins_earned int not null default 0,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, season)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.squads enable row level security;
alter table public.tactics enable row level security;
alter table public.matches enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.friend_invites enable row level security;
alter table public.draft_sessions enable row level security;
alter table public.season_rewards enable row level security;

-- Profiles: public read, own write
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Squads: own read/write
create policy "Users can view own squad" on public.squads for select using (auth.uid() = user_id);
create policy "Users can insert own squad" on public.squads for insert with check (auth.uid() = user_id);
create policy "Users can update own squad" on public.squads for update using (auth.uid() = user_id);
create policy "Users can delete own squad" on public.squads for delete using (auth.uid() = user_id);

-- Tactics: own read/write
create policy "Users can view own tactics" on public.tactics for select using (auth.uid() = user_id);
create policy "Users can insert own tactics" on public.tactics for insert with check (auth.uid() = user_id);
create policy "Users can update own tactics" on public.tactics for update using (auth.uid() = user_id);
create policy "Users can delete own tactics" on public.tactics for delete using (auth.uid() = user_id);

-- Matches: participants can view
create policy "Match participants can view" on public.matches for select
  using (auth.uid() = home_user_id or auth.uid() = away_user_id);
create policy "Completed matches are public" on public.matches for select
  using (status = 'completed');
create policy "Users can insert matches" on public.matches for insert
  with check (auth.uid() = home_user_id);

-- Queue: own
create policy "Users can view own queue" on public.matchmaking_queue for select using (auth.uid() = user_id);
create policy "Users can join queue" on public.matchmaking_queue for insert with check (auth.uid() = user_id);
create policy "Users can leave queue" on public.matchmaking_queue for delete using (auth.uid() = user_id);

-- Invites: participants
create policy "Invite participants can view" on public.friend_invites for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id or to_user_id is null);
create policy "Users can create invites" on public.friend_invites for insert
  with check (auth.uid() = from_user_id);
create policy "Users can update invites" on public.friend_invites for update
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Draft sessions: participants
create policy "Draft participants can view" on public.draft_sessions for select
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Draft participants can update" on public.draft_sessions for update
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Season rewards: own
create policy "Users can view own rewards" on public.season_rewards for select using (auth.uid() = user_id);
create policy "Users can claim own rewards" on public.season_rewards for update using (auth.uid() = user_id);
