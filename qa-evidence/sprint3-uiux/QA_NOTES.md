# Sprint 3 UI/UX QA Evidence

Date: 2026-03-31
Environment: local `next dev` on `http://localhost:3000`
Capture tool: `agent-browser`

## Screenshots

Desktop:
- `qa-evidence/sprint3-uiux/desktop-landing.png`
- `qa-evidence/sprint3-uiux/desktop-login.png`
- `qa-evidence/sprint3-uiux/desktop-signup.png`
- `qa-evidence/sprint3-uiux/desktop-home.png`
- `qa-evidence/sprint3-uiux/desktop-play.png`
- `qa-evidence/sprint3-uiux/desktop-team-hub.png`
- `qa-evidence/sprint3-uiux/desktop-market.png`

Mobile (390x844):
- `qa-evidence/sprint3-uiux/mobile-landing.png`
- `qa-evidence/sprint3-uiux/mobile-login.png`
- `qa-evidence/sprint3-uiux/mobile-signup.png`
- `qa-evidence/sprint3-uiux/mobile-home.png`
- `qa-evidence/sprint3-uiux/mobile-play.png`
- `qa-evidence/sprint3-uiux/mobile-team-hub.png`
- `qa-evidence/sprint3-uiux/mobile-market.png`

## Route Notes

- Public routes (`/`, `/login`, `/signup`) render as expected and were captured directly.
- Protected routes were re-captured in an authenticated session for QA user `qa.sprint3@example.com`.
- URL verification command used at capture time: `agent-browser get url` (recorded in `qa-evidence/sprint3-uiux/route-capture-log.txt`).

### Authenticated Protected Route Verification

| Image | Requested Route | Verified URL | Unique visible state |
| --- | --- | --- | --- |
| `desktop-home.png` | `/home` | `http://localhost:3000/home` | "Next Best Action" panel with ranked readiness checklist and quick CTA stack. |
| `desktop-play.png` | `/play` | `http://localhost:3000/play` | Match mode actions (ranked/AI/friend) with play-specific queue controls. |
| `desktop-team-hub.png` | `/club/team-hub` | `http://localhost:3000/club/team-hub` | "Squad Readiness Board" with Starting XI and Bench Unit roster tiles. |
| `desktop-market.png` | `/club/market` | `http://localhost:3000/club/market` | Transfer market board with listing cards and bid/market actions. |
| `mobile-home.png` | `/home` | `http://localhost:3000/home` | Mobile home summary with readiness CTA emphasis and compact shell. |
| `mobile-play.png` | `/play` | `http://localhost:3000/play` | Mobile play flow with mode selection and friend-match actions. |
| `mobile-team-hub.png` | `/club/team-hub` | `http://localhost:3000/club/team-hub` | Mobile team hub metrics plus lineup/bench sections in stacked layout. |
| `mobile-market.png` | `/club/market` | `http://localhost:3000/club/market` | Mobile transfer market list and market controls in compact card layout. |

- Integrity check (SHA1) for updated protected-route captures shows all unique hashes across desktop/mobile protected route files.
- State transition check:
  - Unauthenticated navigation to protected routes still redirects to `/login`.
  - Authenticated navigation bypasses `/login` and resolves to the requested protected routes listed above.

## Accessibility Baseline Spot-Checks

- Focus visibility: visible high-contrast ring on tab focus for primary form fields and CTA buttons on login/signup.
- Contrast: text and interactive controls on auth/landing shells appear to maintain clear foreground/background separation.
- Keyboard sanity: tab navigation reaches primary CTAs and form controls in logical order on auth flows.

## Responsive Baseline Spot-Checks

- Landing/auth shells preserve hierarchy at mobile width (390px) with no immediate clipping in the primary card/layout.
- CTA and form controls remain tap-target sized in mobile captures.
- Desktop captures maintain spacing and typographic hierarchy without collapsed content in the sampled routes.
