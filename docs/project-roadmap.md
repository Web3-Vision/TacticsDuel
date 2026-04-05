# TacticsDuel Project Audit And Roadmap

Audit date: 2026-04-05

## Executive Summary

TacticsDuel is past the prototype stage. The repo already contains a coherent product surface:

- App Router game shell with auth, onboarding, home, club, squad, market, missions, profile, play, match, draft, and narrative screens
- Domain logic for squad management, market validation, match simulation, ranked readiness, live draft, session state, and observability
- Supabase migrations for the core live data model
- Good unit-test coverage across `src/lib` with a passing TypeScript check

The biggest gaps are not “missing app code everywhere.” They are:

- framework cleanup for Next 16 upgrades
- stronger build and integration verification
- documentation that matches the actual product
- a clear finishing pass on live gameplay loops and operations

## What Is Working

These areas have direct code evidence and, in many cases, automated tests:

### Product surfaces

- Landing, login, signup, onboarding, home, club, squad, tactics, missions, inbox, news, divisions, history, profile, match, queue, and draft pages exist under `src/app`
- The game shell is structured into `(auth)` and `(game)` route groups, which is a healthy App Router organization
- Shared UI exists for match viewing, squad management, transfer market, narrative feed, and layout chrome

### Domain systems

- Match engine, ELO, team strength, mission logic, and narrative pipeline live in `src/lib/engine`
- Ranked readiness, live draft, session state, and matchday state models live in `src/lib/multiplayer`
- Squad persistence and squad hub state live in `src/lib/squad`
- Transfer market validation and listing guard logic live in `src/lib/transfer-market.ts` and `src/lib/market/listings-view-model.ts`
- Structured observability helpers and a written telemetry contract already exist

### Data model

- Supabase migrations cover initial schema, ranked cycles, onboarding fields, transfer market, narrative pipeline, wallet support, and account controls
- Route handlers are present for profile, missions, rewards, match queue/session/simulate, transfer listings/bids/settlement, invites, and draft actions

### Automated verification

- `npm run typecheck` passes
- Most Vitest coverage passes and spans engine, market, multiplayer, squad, narrative, observability, Supabase helpers, and profile APIs
- CI already runs lint, typecheck, and tests in GitHub Actions

## What Was Not Working During Audit

These were concrete issues observed during the audit:

### Broken or noisy checks

- `src/lib/market/listings-view-model.test.ts` failed because tests depended on the real calendar date instead of a fixed `nowMs`
- `next build` warned that `src/middleware.ts` uses a deprecated convention in Next 16 and should move to `proxy`
- `next build` warned that Turbopack inferred the wrong workspace root because another lockfile exists higher in the filesystem
- Lint produced warning-only noise from unused variables and a few hook dependency issues

### Project hygiene gaps

- `README.md` was still the default Create Next App template and did not describe the product
- CI did not validate production build output
- There is no single project status document that explains what is done, what is unstable, and what is next

### Areas that look unfinished or unverified

- There is strong unit coverage, but little evidence of integration or browser-level verification for the full user journey
- Multiplayer, live draft, and transfer market features depend on Supabase-backed route behavior that is only partially exercised by tests
- Operational guidance is still thin for local setup, seed data, and release readiness

## Cleanup Completed In This Pass

- Stabilized the market listing tests by providing an explicit `nowMs`
- Migrated request interception from `src/middleware.ts` to `src/proxy.ts` for Next 16 compatibility
- Added `turbopack.root` in `next.config.ts` to stop workspace root mis-detection
- Cleared the obvious lint warnings caused by unused variables and brittle effect dependencies
- Replaced the placeholder README with a project-specific overview
- Added this roadmap document so planning lives in the repo

## What Is Left

This is the remaining work, grouped by importance.

### 1. Ship-readiness essentials

- Add `npm run build` to the CI workflow or the `ci` script
- Verify every critical route against a real Supabase-backed local environment
- Add a repeatable local bootstrap guide: env vars, migration flow, and sample user setup
- Decide which pages are production-ready versus internal/dev-only surfaces

### 2. Gameplay loop completion

- Finish the end-to-end ranked loop: squad readiness, queue, match creation, simulation, results persistence, rewards, and progression feedback
- Tighten the transfer market lifecycle: listing creation, bidding, expiry, settlement, roster mutation, and UI feedback states
- Validate the live draft and friend invite loop with real-time sync and reconnect scenarios
- Connect missions and narrative updates more clearly to player actions and match outcomes

### 3. Product quality

- Add browser or integration tests for onboarding, squad save, tactics save, market actions, and queue entry
- Audit empty/loading/error states across the main game pages for consistency
- Review pages for duplicate navigation concepts like `/club/*` versus top-level `/squad`, `/play`, `/match`, and decide what stays canonical
- Add stronger analytics or admin/debug surfaces for failed queue and session flows

### 4. Codebase organization

- Standardize route handler response shapes, especially errors
- Separate pure domain logic from route-handler orchestration more consistently
- Consolidate duplicated route-path knowledge between auth/proxy logic and page navigation
- Add architecture docs for state ownership: Supabase, Zustand, server components, and client-side session state

## Recommended Roadmap

### Phase 1: Stability And Release Hygiene

- Make CI include a production build
- Finish lint cleanup and keep warnings at zero
- Verify all migrations apply cleanly from scratch
- Add setup docs and a release checklist

### Phase 2: Core Loop Hardening

- Test and patch onboarding -> squad -> tactics -> queue -> match -> rewards
- Test and patch squad/market ownership rules and settlement paths
- Validate reconnection and concurrency for live session features

### Phase 3: UX And Progression

- Improve progression visibility on home, divisions, missions, and post-match screens
- Strengthen narrative generation so inbox/news/recap feel tied to player actions
- Polish sharing surfaces and manager profile identity

### Phase 4: Scale And Operations

- Add deeper observability dashboards or log pipelines
- Add admin tooling for queue, stuck sessions, and failed market settlements
- Add stronger data repair or reconciliation scripts for live operations

## Suggested Definition Of “MVP Complete”

The project should be considered MVP-complete when:

- a new user can sign up, finish onboarding, save squad and tactics, and enter a match flow
- match results update progression, missions, and narrative surfaces reliably
- transfer market actions work end to end without manual database repair
- the app builds cleanly, CI is green, and key user journeys have integration coverage
- the README and docs are enough for another engineer to run and extend the project
