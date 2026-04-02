create table if not exists public.multiplayer_sessions (
  id uuid primary key,
  room_code text not null unique,
  status text not null check (status in ('waiting', 'active', 'completed')),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  session_version integer not null default 1,
  last_event_number integer not null default 0,
  session_snapshot jsonb not null
);

create index if not exists multiplayer_sessions_status_updated_idx
  on public.multiplayer_sessions (status, updated_at desc);

create index if not exists multiplayer_sessions_created_by_user_idx
  on public.multiplayer_sessions (created_by_user_id);

create table if not exists public.multiplayer_session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.multiplayer_sessions(id) on delete cascade,
  event_number integer not null,
  event_type text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (session_id, event_number)
);

create index if not exists multiplayer_session_events_session_created_idx
  on public.multiplayer_session_events (session_id, created_at desc);

alter table public.multiplayer_sessions enable row level security;
alter table public.multiplayer_session_events enable row level security;

drop policy if exists "multiplayer_sessions_participant_read" on public.multiplayer_sessions;
create policy "multiplayer_sessions_participant_read"
  on public.multiplayer_sessions
  for select
  to authenticated
  using (
    created_by_user_id = auth.uid()
    or exists (
      select 1
      from jsonb_array_elements(session_snapshot -> 'participants') as participant
      where participant ->> 'userId' = auth.uid()::text
    )
  );

drop policy if exists "multiplayer_session_events_participant_read" on public.multiplayer_session_events;
create policy "multiplayer_session_events_participant_read"
  on public.multiplayer_session_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.multiplayer_sessions sessions
      where sessions.id = multiplayer_session_events.session_id
        and (
          sessions.created_by_user_id = auth.uid()
          or exists (
            select 1
            from jsonb_array_elements(sessions.session_snapshot -> 'participants') as participant
            where participant ->> 'userId' = auth.uid()::text
          )
        )
    )
  );
