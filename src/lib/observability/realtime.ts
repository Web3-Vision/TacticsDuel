type Primitive = string | number | boolean | null | undefined;

type Context = Record<string, Primitive>;

interface ApiResultInput {
  service: "match.queue" | "match.session" | "match.simulate";
  operation: string;
  traceId: string;
  startedAtMs: number;
  status: number;
  context?: Context;
  errorCode?: string;
}

interface DomainEventInput {
  service: ApiResultInput["service"];
  event: string;
  traceId: string;
  context?: Context;
}

interface MetricSample {
  count: number;
  sum: number;
  max: number;
}

type MetricRegistry = Map<string, MetricSample>;

function getMetricRegistry(): MetricRegistry {
  const globalWithMetrics = globalThis as typeof globalThis & {
    __tacticsDuelMetrics?: MetricRegistry;
  };

  if (!globalWithMetrics.__tacticsDuelMetrics) {
    globalWithMetrics.__tacticsDuelMetrics = new Map<string, MetricSample>();
  }

  return globalWithMetrics.__tacticsDuelMetrics;
}

function metricKey(name: string, tags: Context): string {
  const sortedTags = Object.entries(tags)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
  return `${name}|${sortedTags}`;
}

function updateMetric(name: string, tags: Context, value = 1) {
  const registry = getMetricRegistry();
  const key = metricKey(name, tags);
  const existing = registry.get(key);

  if (existing) {
    existing.count += 1;
    existing.sum += value;
    existing.max = Math.max(existing.max, value);
    return;
  }

  registry.set(key, {
    count: 1,
    sum: value,
    max: value,
  });
}

function cleanContext(context: Context = {}): Context {
  return Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));
}

export function createTraceId(): string {
  return crypto.randomUUID();
}

export function logDomainEvent(input: DomainEventInput) {
  const context = cleanContext(input.context);
  console.info(
    JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      kind: "domain_event",
      service: input.service,
      event: input.event,
      traceId: input.traceId,
      ...context,
    })
  );
}

export function recordApiResult(input: ApiResultInput) {
  const durationMs = Date.now() - input.startedAtMs;
  const outcome = input.status >= 500 ? "error" : input.status >= 400 ? "client_error" : "ok";
  const context = cleanContext(input.context);

  updateMetric("api_request_total", {
    service: input.service,
    operation: input.operation,
    outcome,
    status: input.status,
    errorCode: input.errorCode,
  });

  updateMetric("api_request_latency_ms", {
    service: input.service,
    operation: input.operation,
    outcome,
  }, durationMs);

  console.info(
    JSON.stringify({
      level: outcome === "ok" ? "info" : "warn",
      timestamp: new Date().toISOString(),
      kind: "api_result",
      service: input.service,
      operation: input.operation,
      traceId: input.traceId,
      status: input.status,
      outcome,
      durationMs,
      errorCode: input.errorCode,
      ...context,
    })
  );
}
