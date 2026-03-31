import { beforeEach, describe, expect, it, vi } from "vitest";
import { logDomainEvent, recordApiResult } from "./realtime";

type MetricRegistry = Map<string, { count: number; sum: number; max: number }>;

function getMetricRegistry(): MetricRegistry {
  const globalWithMetrics = globalThis as typeof globalThis & {
    __tacticsDuelMetrics?: MetricRegistry;
  };

  if (!globalWithMetrics.__tacticsDuelMetrics) {
    globalWithMetrics.__tacticsDuelMetrics = new Map<string, { count: number; sum: number; max: number }>();
  }

  return globalWithMetrics.__tacticsDuelMetrics;
}

describe("realtime observability smoke tests", () => {
  beforeEach(() => {
    getMetricRegistry().clear();
    vi.restoreAllMocks();
  });

  it("emits api_result telemetry with trace id and latency metrics", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordApiResult({
      service: "match.session",
      operation: "POST",
      traceId: "trace-qa-1",
      startedAtMs: Date.now() - 25,
      status: 409,
      context: {
        action: "reconnect",
        sessionId: "session-1",
      },
      errorCode: "INVALID_TURN",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe("api_result");
    expect(payload.service).toBe("match.session");
    expect(payload.operation).toBe("POST");
    expect(payload.traceId).toBe("trace-qa-1");
    expect(payload.status).toBe(409);
    expect(payload.outcome).toBe("client_error");
    expect(payload.errorCode).toBe("INVALID_TURN");
    expect(payload.durationMs).toEqual(expect.any(Number));

    const keys = Array.from(getMetricRegistry().keys());
    expect(keys.some((key) => key.startsWith("api_request_total|"))).toBe(true);
    expect(keys.some((key) => key.startsWith("api_request_latency_ms|"))).toBe(true);
  });

  it("keeps action/session context on client error api_result events", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordApiResult({
      service: "match.session",
      operation: "POST",
      traceId: "trace-qa-ctx",
      startedAtMs: Date.now() - 7,
      status: 409,
      context: {
        action: "submit_turn",
        sessionId: "session-desync-1",
      },
      errorCode: "INVALID_TURN",
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.action).toBe("submit_turn");
    expect(payload.sessionId).toBe("session-desync-1");
    expect(payload.errorCode).toBe("INVALID_TURN");
  });

  it("emits domain_event telemetry for lifecycle milestones", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDomainEvent({
      service: "match.queue",
      event: "ghost_match_created",
      traceId: "trace-qa-2",
      context: {
        userId: "user-1",
        matchId: "match-1",
        waitSeconds: 31,
      },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe("domain_event");
    expect(payload.service).toBe("match.queue");
    expect(payload.event).toBe("ghost_match_created");
    expect(payload.traceId).toBe("trace-qa-2");
    expect(payload.waitSeconds).toBe(31);
  });

  it("emits reconnect domain_event telemetry with session context", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDomainEvent({
      service: "match.session",
      event: "participant_reconnected",
      traceId: "trace-qa-3",
      context: {
        action: "reconnect",
        sessionId: "session-2",
        userId: "user-2",
      },
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.kind).toBe("domain_event");
    expect(payload.service).toBe("match.session");
    expect(payload.event).toBe("participant_reconnected");
    expect(payload.sessionId).toBe("session-2");
    expect(payload.userId).toBe("user-2");
  });
});
