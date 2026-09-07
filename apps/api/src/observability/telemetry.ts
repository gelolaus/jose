import { randomUUID } from "node:crypto";

export type MetricName =
  | "http_requests"
  | "http_latency_ms"
  | "callback_failures"
  | "save_failures"
  | "database_errors"
  | "rate_limited";

type CounterMap = Map<string, number>;

const counters: CounterMap = new Map();
const latencySum: CounterMap = new Map();
const latencyCount: CounterMap = new Map();

function key(name: MetricName, labels: Record<string, string> = {}): string {
  const labelText = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return labelText ? `${name}|${labelText}` : name;
}

export function incrMetric(
  name: MetricName,
  labels: Record<string, string> = {},
  by = 1,
) {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + by);
}

export function observeLatencyMs(
  labels: Record<string, string>,
  ms: number,
) {
  const sumKey = key("http_latency_ms", { ...labels, agg: "sum" });
  const countKey = key("http_latency_ms", { ...labels, agg: "count" });
  latencySum.set(sumKey, (latencySum.get(sumKey) ?? 0) + ms);
  latencyCount.set(countKey, (latencyCount.get(countKey) ?? 0) + 1);
  incrMetric("http_requests", labels);
}

export function snapshotMetrics(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of counters) out[k] = v;
  for (const [k, v] of latencySum) out[k] = v;
  for (const [k, v] of latencyCount) out[k] = v;
  return out;
}

export function resetMetrics() {
  counters.clear();
  latencySum.clear();
  latencyCount.clear();
}

const SENSITIVE_KEY =
  /(password|secret|token|authorization|cookie|email|answer|payload|client_secret|auth_token|admission_email|code_hash|token_hash|events_json|secret_json)/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_RE = /bearer\s+\S+/gi;
const QUERY_SECRET_RE = /(authToken|access_token|client_secret|JOSE_[A-Z_]*SECRET)=([^&\s]+)/gi;

export function sanitizeString(value: string): string {
  let next = value
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(QUERY_SECRET_RE, "$1=[redacted]");
  if (next.length > 200) next = `${next.slice(0, 200)}…`;
  return next;
}

export function sanitizeForLogs(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForLogs(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = sanitizeForLogs(v, depth + 1);
  }
  return out;
}

export function createSupportReference(requestId: string): string {
  return `JOSE-${requestId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function newRequestId(incoming?: string | string[]): string {
  if (typeof incoming === "string" && incoming.trim()) {
    return incoming.trim().slice(0, 64);
  }
  if (Array.isArray(incoming) && incoming[0]?.trim()) {
    return incoming[0].trim().slice(0, 64);
  }
  return randomUUID();
}

export type StructuredLog = {
  level: "info" | "warn" | "error";
  msg: string;
  requestId?: string;
  supportRef?: string;
  path?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  error?: unknown;
  [key: string]: unknown;
};

export function writeStructuredLog(entry: StructuredLog) {
  const safe = sanitizeForLogs(entry) as StructuredLog;
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify(safe);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
