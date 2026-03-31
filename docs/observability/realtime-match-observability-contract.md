# Realtime Match Observability Contract

Date: 2026-03-31
Owner: Founding Engineer
Scope: Matchmaking queue, match session lifecycle, match simulation

## Services

- `match.queue`: `/api/match/queue` (`POST`, `GET`, `DELETE`)
- `match.session`: `/api/match/session` (`POST`, `GET`)
- `match.simulate`: `/api/match/simulate` (`POST`)

## Structured Log Events

### `api_result`

Emitted for every API response.

Required fields:

- `timestamp`
- `kind` = `api_result`
- `service`
- `operation`
- `traceId`
- `status`
- `outcome` (`ok` | `client_error` | `error`)
- `durationMs`

Optional fields:

- `errorCode`
- request-specific context (`sessionId`, `matchId`, `action`, `waitSeconds`, `userId`)
- sub-operation latency fields (`*Ms`) for hotspot isolation (for example `matchmakingMs`, `queueInsertMs`, `simulationMs`, `matchUpdateMs`)

### `domain_event`

Emitted at critical lifecycle points.

Current events:

- `match.queue` -> `match_found_immediately`
- `match.queue` -> `ghost_match_created`
- `match.session` -> `participant_reconnected`
- `match.session` -> `participant_disconnected`
- `match.session` -> `turn_desync_detected`
- `match.simulate` -> `ai_away_squad_generated`

## Metrics

Metrics are aggregated in-process and keyed by tags.

### Counter: `api_request_total`

Tags:

- `service`
- `operation`
- `outcome`
- `status`
- `errorCode` (when available)

### Latency summary: `api_request_latency_ms`

Tracks count/sum/max per tag set.

Tags:

- `service`
- `operation`
- `outcome`

## Trace Contract

- Every request receives an `x-trace-id` response header.
- `traceId` is included in all `api_result` and `domain_event` logs for correlation.

## Error Taxonomy

- Session domain errors map to existing `SessionError` codes (for example `NOT_YOUR_TURN`, `ROOM_FULL`).
- Route-level failures use explicit error codes where practical (for example `MATCH_NOT_FOUND`, `QUEUE_INSERT_FAILED`, `INTERNAL_ERROR`).

## Debugging Flow

1. Start from `x-trace-id` from failing client request.
2. Find matching `api_result` for status/outcome and request duration.
3. Follow `domain_event` entries with same `traceId` to inspect lifecycle transitions.
4. Use `api_request_total`/`api_request_latency_ms` tag sets to confirm whether issue is isolated or systemic.
