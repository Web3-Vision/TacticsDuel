create table public.matchmaking_queue_claims (
  id uuid primary key default gen_random_uuid(),
  claimer_queue_id uuid not null unique references public.matchmaking_queue(id) on delete cascade,
  opponent_queue_id uuid not null unique references public.matchmaking_queue(id) on delete cascade,
  claimer_user_id uuid not null references public.profiles(id) on delete cascade,
  opponent_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'released', 'finalized', 'expired')),
  release_reason text,
  match_id uuid references public.matches(id) on delete set null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  finalized_at timestamptz
);

create index idx_matchmaking_queue_claims_status_expires
  on public.matchmaking_queue_claims(status, expires_at desc);

create index idx_matchmaking_queue_claims_match_id
  on public.matchmaking_queue_claims(match_id);

create table public.match_session_snapshots (
  session_id text primary key,
  room_code text not null,
  match_id uuid references public.matches(id) on delete set null,
  status text not null,
  phase text not null,
  turn_number int not null default 1,
  active_side text not null,
  version int not null default 1,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_event_type text not null,
  last_event_at timestamptz not null default now()
);

create index idx_match_session_snapshots_status_updated
  on public.match_session_snapshots(status, updated_at desc);

create table public.match_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.match_session_snapshots(session_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null,
  connected boolean not null default true,
  joined_at timestamptz not null,
  last_seen_at timestamptz not null,
  unique(session_id, user_id)
);

create index idx_match_session_participants_connected
  on public.match_session_participants(session_id, connected, last_seen_at desc);

create table public.match_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.match_session_snapshots(session_id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  turn_number int,
  version int not null,
  created_at timestamptz not null default now()
);

create index idx_match_session_events_type_created
  on public.match_session_events(event_type, created_at desc);

create index idx_match_session_events_session_created
  on public.match_session_events(session_id, created_at desc);

create or replace function public.claim_matchmaking_opponent(
  p_user_id uuid,
  p_elo int,
  p_elo_range int,
  p_lease_seconds int default 30
)
returns table (
  claim_id uuid,
  claimer_queue_id uuid,
  opponent_queue_id uuid,
  opponent_user_id uuid,
  opponent_elo int,
  opponent_joined_at timestamptz,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self public.matchmaking_queue%rowtype;
  v_opponent public.matchmaking_queue%rowtype;
  v_claim public.matchmaking_queue_claims%rowtype;
begin
  update public.matchmaking_queue_claims
  set status = 'expired',
      released_at = now(),
      release_reason = coalesce(release_reason, 'lease_expired')
  where status = 'active'
    and expires_at <= now();

  select *
  into v_claim
  from public.matchmaking_queue_claims
  where claimer_user_id = p_user_id
    and status = 'active'
    and expires_at > now()
  order by claimed_at desc
  limit 1;

  if found then
    select *
    into v_opponent
    from public.matchmaking_queue
    where id = v_claim.opponent_queue_id;

    if found then
      return query
      select
        v_claim.id,
        v_claim.claimer_queue_id,
        v_claim.opponent_queue_id,
        v_claim.opponent_user_id,
        v_opponent.elo_rating,
        v_opponent.joined_at,
        v_claim.expires_at;
      return;
    end if;
  end if;

  select *
  into v_self
  from public.matchmaking_queue
  where user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  select q.*
  into v_opponent
  from public.matchmaking_queue q
  left join public.matchmaking_queue_claims c
    on c.opponent_queue_id = q.id
   and c.status = 'active'
   and c.expires_at > now()
  where q.user_id <> p_user_id
    and q.elo_rating between p_elo - p_elo_range and p_elo + p_elo_range
    and c.id is null
  order by q.joined_at asc
  for update of q skip locked
  limit 1;

  if not found then
    return;
  end if;

  insert into public.matchmaking_queue_claims (
    claimer_queue_id,
    opponent_queue_id,
    claimer_user_id,
    opponent_user_id,
    expires_at
  )
  values (
    v_self.id,
    v_opponent.id,
    p_user_id,
    v_opponent.user_id,
    now() + make_interval(secs => greatest(5, p_lease_seconds))
  )
  returning *
  into v_claim;

  return query
  select
    v_claim.id,
    v_claim.claimer_queue_id,
    v_claim.opponent_queue_id,
    v_claim.opponent_user_id,
    v_opponent.elo_rating,
    v_opponent.joined_at,
    v_claim.expires_at;
end;
$$;

create or replace function public.finalize_matchmaking_claim(
  p_claim_id uuid,
  p_match_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.matchmaking_queue_claims%rowtype;
begin
  select *
  into v_claim
  from public.matchmaking_queue_claims
  where id = p_claim_id
    and status = 'active'
  for update;

  if not found or v_claim.expires_at <= now() then
    return false;
  end if;

  update public.matchmaking_queue_claims
  set status = 'finalized',
      match_id = p_match_id,
      finalized_at = now()
  where id = p_claim_id;

  delete from public.matchmaking_queue
  where id in (v_claim.claimer_queue_id, v_claim.opponent_queue_id);

  return true;
end;
$$;

create or replace function public.release_matchmaking_claim(
  p_claim_id uuid,
  p_reason text default 'released'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matchmaking_queue_claims
  set status = case when expires_at <= now() then 'expired' else 'released' end,
      release_reason = p_reason,
      released_at = now()
  where id = p_claim_id
    and status = 'active';

  return found;
end;
$$;

grant execute on function public.claim_matchmaking_opponent(uuid, int, int, int) to authenticated, service_role;
grant execute on function public.finalize_matchmaking_claim(uuid, uuid) to authenticated, service_role;
grant execute on function public.release_matchmaking_claim(uuid, text) to authenticated, service_role;
