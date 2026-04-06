# TacticsDuel

TacticsDuel is a football-management web app built with Next.js 16, React 19, Supabase, Zustand, and a custom match simulation engine. This README focuses on how the project is structured, how the main systems work, what is currently implemented, and what is still left to finish.

## What The App Does

The app is built around a competitive club-management loop:

1. A user signs up or logs in.
2. The user completes onboarding and creates a manager identity.
3. The user builds a squad, selects a formation, and saves tactics.
4. The user can enter ranked matchmaking, create friend invites, or use live draft and session-based matchday flows.
5. Matches are simulated on the server, progression is updated, and narrative content is written back into inbox/news/recap feeds.
6. The user can also manage the club through missions, transfer market actions, profile settings, and progression screens.

## Tech Stack

- Framework: Next.js 16 App Router
- UI: React 19, local IBM Plex fonts, Tailwind v4-style setup
- Data/Auth: Supabase SSR + Supabase client/server helpers
- Client state: Zustand
- Testing: Vitest
- Linting/typing: ESLint 9, TypeScript 5

## How The Project Works

### Routing

- `src/app` uses App Router route groups:
- `(auth)` contains login and signup pages
- `(game)` contains the authenticated game surfaces such as home, club, squad, missions, play, match, draft, and profile
- `src/proxy.ts` refreshes auth state and redirects users between auth/game routes when needed

### Data flow

- Server Components and route handlers use `createClient()` from `src/lib/supabase/server.ts`
- Client-side interactions use `src/lib/supabase/client.ts`
- Auth/session refresh and route guarding happen before requests are rendered
- Persistent game state lives in Supabase tables defined by the SQL migrations in `supabase/migrations`

### State management

- Local interactive squad state lives in Zustand in `src/lib/stores/squad-store.ts`
- Match UI state lives in `src/lib/stores/match-store.ts`
- Pure game/domain logic is mostly kept in `src/lib/*` so it can be tested outside the UI

### Simulation and game logic

- `src/lib/engine/match-engine.ts` runs server-side match simulation
- `src/lib/engine/elo.ts` calculates ranked ELO and division point changes
- `src/lib/engine/ai-opponent.ts` generates AI squads/tactics for ghost or fallback opponents
- `src/lib/engine/narrative-pipeline.ts` persists recap/news/inbox artifacts after matches

### Multiplayer and competitive systems

- `src/lib/multiplayer/competitive-flow.ts` defines ranked-readiness and competitive error behavior
- `src/lib/multiplayer/live-draft.ts` and `src/app/api/draft/*` support live draft flows
- `src/lib/multiplayer/session-service.ts` and `src/app/api/match/session/route.ts` support session-style live matchday coordination
- `src/app/api/match/queue/route.ts` handles ranked queue entry and queue status

### Market and club management

- `src/app/api/market/*` handles listings, bids, and settlement
- `src/lib/transfer-market.ts` and `src/lib/market/listings-view-model.ts` contain transfer validation and bid-guard rules
- `src/app/(game)/club/*` and `src/components/squad/*` provide the main club and squad workflows

### Missions and progression

- `src/app/api/missions/route.ts` creates daily/weekly missions if they do not exist yet
- Reward claiming and profile coin updates happen through route handlers
- Home/dashboard/profile surfaces pull progression, results, and narrative summaries from Supabase

## Project Structure

```text
src/
  app/                App Router pages and API routes
  components/         UI for squad, match, market, layout, narrative, share
  lib/
    engine/           Match sim, ELO, AI, missions, narrative pipeline
    multiplayer/      Queue/session/draft/readiness logic
    squad/            Persisted squad and squad hub logic
    market/           Transfer listing view models and guards
    stores/           Zustand client stores
    supabase/         SSR/client/auth helpers
supabase/
  migrations/         Database schema history
docs/                 Contracts, notes, roadmap
public/               Fonts, icons, manifest, service worker
```

## Main User Flows Implemented

### 1. Authentication and onboarding

- Login and signup pages exist
- Auth callback route exists
- Proxy-based route guarding is implemented
- Onboarding page builds initial manager and squad setup flow

### 2. Squad and tactics

- Users can build a squad locally in Zustand
- Squad data can be saved to and loaded from Supabase
- Tactics are saved separately and used later by ranked and match simulation flows

### 3. Ranked and play

- Ranked-readiness checks exist
- Queue APIs exist
- Match/session APIs exist
- Match simulation endpoint exists and updates scores, stats, ELO, division points, and narrative artifacts

### 4. Transfer market

- Listing creation exists
- Bid validation exists
- Settlement routes exist
- Market board UI exists

### 5. Missions and narrative

- Daily and weekly missions are generated on demand
- Mission claiming exists
- Inbox/news/round recap surfaces exist
- Narrative persistence is connected to match outcomes

## Setup

### Requirements

- Node.js 20+
- npm
- A Supabase project with the required schema

### Environment variables

At minimum, the app expects:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

There are also Magic auth helpers in the repo, so depending on the flow you want to use you may need related Magic environment variables as well.

### Install and run

```bash
npm install
npm run dev
```

### Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run ci
```

`npm run ci` currently runs lint, typecheck, and tests.

## Current Project Status

As of the latest audit:

- TypeScript passes
- Unit tests pass
- Core domain modules exist for engine, multiplayer, squad, market, missions, and narrative
- The README, roadmap, and Next 16 proxy cleanup have been updated

The biggest remaining gaps are:

- end-to-end verification of Supabase-backed flows
- production build validation in CI
- clearer setup/bootstrap documentation
- more integration coverage for onboarding, ranked queue, match simulation, market settlement, and live draft

## Important Docs

- Roadmap and audit: [docs/project-roadmap.md](./docs/project-roadmap.md)
- Competitive state contract: [docs/competitive-flow-state-transitions.md](./docs/competitive-flow-state-transitions.md)
- Observability contract: [docs/observability/realtime-match-observability-contract.md](./docs/observability/realtime-match-observability-contract.md)

## Recommended Next Steps

If you are continuing work on this repo, start here:

1. Verify the local Supabase setup from scratch using the migrations.
2. Run through the real user journey: signup, onboarding, squad save, tactics save, queue, simulate match.
3. Add integration coverage for the route handlers that mutate progression and market state.
4. Add `npm run build` to CI once build behavior is confirmed locally.
