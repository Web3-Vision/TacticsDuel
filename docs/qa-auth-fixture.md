# QA Auth Fixture (SPOA-74)

This fixture unblocks authenticated QA coverage for `/profile` and `/club/team-hub` in local runs.

## Safety

- Seeding script refuses non-local Supabase hosts by default.
- Override is explicit: set `QA_FIXTURE_ALLOW_REMOTE=1` only when intentional.
- Password login UI is disabled by default and only enabled when `NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN=true`.

## Local Setup

1. Export local Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Optional fixture overrides:
   - `QA_FIXTURE_EMAIL`
   - `QA_FIXTURE_PASSWORD`
   - `QA_FIXTURE_USERNAME`
   - `QA_FIXTURE_CLUB_NAME`
   - `QA_FIXTURE_MANAGER_NAME`
   - `QA_FIXTURE_AGE`
   - `QA_FIXTURE_FAVORITE_TEAM`
3. Run fixture seed:

```bash
npm run qa:auth-fixture
```

4. Start app with QA password login enabled:

```bash
NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN=true npm run dev
```

5. Open `/login`, use **Local QA Password Login**, then validate:
   - `/profile`
   - `/club/team-hub`

The seed output prints the canonical fixture credentials and `user_id` so QA can copy them directly into the password-login flow.

## Deterministic Defaults

- Email: `qa.spoa73@example.com`
- Password: `SPOA73-qa-local-only`
- Username: `qa_spoa73`
- Club: `QA SPOA 73 FC`

## Expected `/api/profile` PATCH Mutations

When profile save is executed via manager profile panel, the API mutates only the provided fields:

- `manager_name`: trimmed string, `null` if blank
- `age`: integer 13..80, `null` if cleared
- `favorite_team`: trimmed string, `null` if blank
- `manager_avatar_archetype`: enum-validated
- `manager_hair_style`: enum-validated
- `manager_hair_color`: enum-validated
- `manager_skin_tone`: enum-validated
- `manager_beard_style`: enum-validated

Compatibility note:
- If `profiles.manager_name` is absent in the active schema, `/api/profile` transparently falls back to persisting manager name in `username` so `/profile` reload still reflects the saved manager identity.

When account status is changed:

- `account_status=paused`: sets `paused_at=now`, `deactivated_at=null`
- `account_status=active`: sets `paused_at=null`, `deactivated_at=null`
- `account_status=deactivated`: sets `deactivated_at=now`, `paused_at=null`

Expected auth behavior:

- Unauthenticated PATCH returns `401 Unauthorized`.
- Deactivated account cannot be reactivated via `/api/profile`.
