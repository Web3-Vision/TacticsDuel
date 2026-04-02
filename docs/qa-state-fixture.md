# QA State Fixture (SPOA-107)

This fixture seeds deterministic `/play` and `/draft/[id]` QA states for the SPOA-105 scenario matrix.

## Safety

- The script refuses non-local Supabase hosts by default.
- Override is explicit: set `QA_FIXTURE_ALLOW_REMOTE=1` only when intentional.
- It only mutates fixture-owned users and their related invites/draft sessions.

## Local Setup

1. Export Supabase env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Optional route base override:
   - `QA_BASE_URL` (defaults to `http://localhost:3000`)
3. Run the seed. It prints the exact `/play` and `/draft/[id]` URLs for the seeded matrix:

```bash
npm run qa:state-fixture
```

4. Start the app with QA password login enabled:

```bash
NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN=true npm run dev
```

## Default Test Identities

- Host
  - Email: `qa.spoa107.host@example.com`
  - Password: `SPOA107-host-local-only`
  - Username: `qa_spoa107_host`
- Guest
  - Email: `qa.spoa107.guest@example.com`
  - Password: `SPOA107-guest-local-only`
  - Username: `qa_spoa107_guest`

Both users are seeded with:

- a saved 4-3-3 squad with 11 starters
- saved tactics
- `squad_locked=true`

That makes `/play` load in ranked-ready state for either account.

## Seeded `/play` Coverage

- QA route overrides are available only when the app runs with `NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN=true`.
- Ranked-ready
  - Login as host or guest.
  - Open the printed `route_play_host`.
  - Expected: ranked card shows ready state and unlocks `/play/confirm?mode=ranked`.
- Friend create
  - Open the printed `route_play_friend_create`.
  - Optional mode override:
    - append `&qaInviteMode=bring_squad`
    - append `&qaInviteMode=live_draft`
  - Expected: create mode is immediately usable because the seeded account satisfies bring-squad readiness.
- Friend join
  - Login as guest.
  - Open one of the printed join routes:
    - `route_play_friend_join_bring_squad`
    - `route_play_friend_join_live_draft`
  - Expected: join view opens directly with the code prefilled.
- Friend pending
  - Login as host.
  - Open the printed `route_play_friend_pending`.
  - Expected pending codes:
    - `S107SQD1`
    - `S107DRP1`

## Seeded `/draft/[id]` Coverage

The script prints the actual route URLs after seeding. It creates these deterministic states:

- Waiting
  - `status=waiting`
  - `current_picker=null`
  - Expected UI: "Awaiting sync"
- Active turn
  - `status=drafting`
  - `current_picker=host`
  - Expected UI for host: "On your clock"
- Opponent turn
  - `status=drafting`
  - `current_picker=guest`
  - Expected UI for host: opponent controls the current pick
- Completion
  - `status=completed`
  - full 22-pick history
  - Expected UI: completed badge and locked board

The broader `/draft/[id]` QA control overlays from the mixed local workspace are intentionally deferred from this candidate. Treat the printed draft URLs as persisted-session fixtures only.

## Reset Behavior

Each run removes prior fixture-owned invites and draft sessions for the two seeded users, then recreates the deterministic matrix from scratch.
