import { VERSION } from "./version.js";

export const FUNNEL_METRIC_NAMES = [
  "landing_views",
  "open_clicks",
  "mcp_initializations",
  "public_tool_calls",
  "onboarding_tool_calls",
] as const;

export type FunnelMetricName = (typeof FUNNEL_METRIC_NAMES)[number];

export interface FunnelSnapshot extends Record<FunnelMetricName, number> {
  service: "xrocket-mcp";
  version: string;
  intervalStartedAt: string;
  intervalEndedAt: string;
}

export interface FunnelMetrics {
  record: (metric: FunnelMetricName) => void;
  flush: () => void;
  close: () => void;
}

interface FunnelMetricsOptions {
  sink: (snapshot: FunnelSnapshot) => void;
  intervalMs?: number;
  now?: () => Date;
}

const DEFAULT_INTERVAL_MS = 5 * 60_000;

function emptyCounts(): Record<FunnelMetricName, number> {
  return {
    landing_views: 0,
    open_clicks: 0,
    mcp_initializations: 0,
    public_tool_calls: 0,
    onboarding_tool_calls: 0,
  };
}
export function createFunnelMetrics(options: FunnelMetricsOptions): FunnelMetrics {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new Error("Funnel metrics interval must be a positive integer");
  }
  const now = options.now ?? (() => new Date());
  let intervalStartedAt = now();
  let counts = emptyCounts();
  let closed = false;

  const flush = () => {
    if (closed) return;
    const intervalEndedAt = now();
    const hasActivity = FUNNEL_METRIC_NAMES.some((name) => counts[name] > 0);
    if (hasActivity) {
      const snapshot: FunnelSnapshot = {
        service: "xrocket-mcp",
        version: VERSION,
        intervalStartedAt: intervalStartedAt.toISOString(),
        intervalEndedAt: intervalEndedAt.toISOString(),
        ...counts,
      };
      try {
        options.sink(snapshot);
      } catch {
        // Analytics must never affect MCP or landing-page availability.
      }
    }
    counts = emptyCounts();
    intervalStartedAt = intervalEndedAt;
  };

  const timer = setInterval(flush, intervalMs);
  timer.unref();

  return {
    record: (metric) => {
      if (!closed) counts[metric] += 1;
    },
    flush,
    close: () => {
      if (closed) return;
      clearInterval(timer);
      flush();
      closed = true;
    },
  };
}
