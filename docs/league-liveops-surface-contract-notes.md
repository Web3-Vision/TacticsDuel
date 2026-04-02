# League + Live Ops Surface Contract Notes

This note documents backend/API hooks needed to keep the League HQ and live-ops frontend aligned with backend truth.

## Implemented contracts

- `POST /api/rewards/season/claim`
  - Claims a pending season reward through `public.claim_season_reward(uuid)`.
  - Response shape:
    - `reward.id`
    - `reward.season`
    - `reward.highestDivision`
    - `reward.coinsAwarded`
    - `reward.claimed`
    - `reward.alreadyClaimed`
- `GET /api/league/ladder?division=<n>&limit=<n>&cursor=<cursor>`
  - Returns deterministic ladder rows ordered by `elo_rating DESC, updated_at ASC, id ASC`.
  - Response shape:
    - `division`
    - `rows[]`
    - `nextCursor`
- `GET /api/live-ops/cadence`
  - Returns `cadence.generatedAt`, `cadence.dailyResetAt`, `cadence.weeklyResetAt`, and `cadence.seasonEndsAt`.
- `GET /api/live-ops/events`
  - Returns a dedicated event payload:
    - `events[].title`
    - `events[].summary`
    - `events[].startsAt`
    - `events[].endsAt`
    - `events[].entryHref`
    - `events[].priority`
    - `events[].category`

## Backend details

- Ranked season completion now emits pending `season_rewards` entries instead of directly crediting coins, so the claim path is meaningful end to end.
- Ranked progression is computed through a shared helper for both home and away players in ranked simulations.
- `missions` now support optional urgency metadata:
  - `is_featured`
  - `recommended_mode`
  - `priority_weight`

## QA focus

- Validate reward claiming is idempotent under repeated POSTs.
- Validate division ladder pagination stays stable when ELO ties exist.
- Validate cadence labels match the API payload instead of page-local derivation.
- Validate live event wire renders dedicated cards before inbox/news fallback content.
