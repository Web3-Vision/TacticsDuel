# Multiplayer Reliability Handoff

This handoff covers the server-side hardening added for live multiplayer session control.

## What changed

- Disconnected participants can no longer submit tactical commands until they reconnect.
- Rejected `submit_turn` responses now include an authoritative `sessionState` hint so the client can recover from stale turn, phase, or connection state.
- Session API emits `turn_submission_rejected` telemetry with the authoritative session snapshot fields needed for operator triage.

## Validation commands

Run the focused regression suite:

```bash
npm -C TacticsDuel test -- src/lib/multiplayer/session-service.test.ts src/lib/observability/realtime.test.ts
```

Optional broader multiplayer pass:

```bash
npm -C TacticsDuel test -- src/lib/multiplayer/session-service.test.ts src/lib/multiplayer/competitive-flow.test.ts src/lib/observability/realtime.test.ts
```

## QA scenarios

1. Create a live session with two participants.
2. Disconnect the active-side participant.
3. Attempt `submit_turn` without reconnecting and verify the API returns `PARTICIPANT_DISCONNECTED` plus `sessionState.you.connected: false`.
4. Reconnect the same participant and verify the same command succeeds on the next attempt.
5. Force a stale client turn number and verify the API returns `turn_submission_rejected` telemetry with authoritative turn, phase, and active side context.

## Remaining risks

- Session state is still stored in process memory, so cross-instance resilience is not addressed by this change.
- The current recovery hint is API-only; any client auto-resync behavior still depends on consumers reading `sessionState` and refreshing local session state.
