# Competitive Flow State Transitions

This note defines the expected state machine for the competitive funnel.

## Ranked Readiness

A player is allowed into ranked queue only when all checks pass in this order:

1. Local lineup has at least 11 selected players.
2. Server has 11 saved starters.
3. Tactics row exists for the player.
4. `profiles.squad_locked` is `true`.

Readiness result codes:

- `missing_local_players`
- `missing_saved_squad`
- `missing_tactics`
- `squad_unlocked`
- `ready`

## Queue Lifecycle

`POST /api/match/queue` returns:

- `queued`: player entered queue successfully.
- `match_found`: player was matched immediately.

`GET /api/match/queue` returns:

- `searching`: player is still queued.
- `match_found`: player has a pending/accepted/simulating match.
- `not_in_queue`: player is not queued and no active match is pending.

## Invite Lifecycle

`POST /api/match/invite` returns:

- `invite_created`

`GET /api/match/invite?code=...` returns:

- `invite_ready`

`PATCH /api/match/invite` returns:

- `match_ready` for `bring_squad`
- `draft_ready` for `live_draft`

## Error Contract

All competitive endpoints return machine-readable errors as:

```json
{
  "ok": false,
  "error": {
    "code": "SQUAD_NOT_LOCKED",
    "message": "Lock your squad before joining ranked queue.",
    "retryable": false
  }
}
```
