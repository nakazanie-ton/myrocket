import { describe, expect, it, vi } from "vitest";
import {
  createFunnelMetrics,
  FUNNEL_METRIC_NAMES,
  type FunnelSnapshot,
} from "../src/funnel-metrics.js";

describe("hosted funnel metrics", () => {
  it("emits only aggregate allowlisted counters and resets each interval", () => {
    const snapshots: FunnelSnapshot[] = [];
    const times = [
      new Date("2026-08-24T10:00:00.000Z"),
      new Date("2026-08-24T10:05:00.000Z"),
      new Date("2026-08-24T10:10:00.000Z"),
    ];
    const metrics = createFunnelMetrics({
      sink: (snapshot) => snapshots.push(snapshot),
      intervalMs: 60_000,
      now: () => times.shift()!,
    });

    metrics.record("landing_views");
    metrics.record("public_tool_calls");
    metrics.record("public_tool_calls");
    metrics.flush();
    metrics.record("open_clicks");
    metrics.close();
    metrics.record("landing_views");

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      intervalStartedAt: "2026-08-24T10:00:00.000Z",
      intervalEndedAt: "2026-08-24T10:05:00.000Z",
      landing_views: 1,
      open_clicks: 0,
      mcp_initializations: 0,
      public_tool_calls: 2,
      onboarding_tool_calls: 0,
    });
    expect(snapshots[1]).toMatchObject({
      intervalStartedAt: "2026-08-24T10:05:00.000Z",
      intervalEndedAt: "2026-08-24T10:10:00.000Z",
      landing_views: 0,
      open_clicks: 1,
      public_tool_calls: 0,
    });
    expect(Object.keys(snapshots[0]!).sort()).toEqual(
      ["service", "version", "intervalStartedAt", "intervalEndedAt", ...FUNNEL_METRIC_NAMES].sort(),
    );
  });

  it("does not emit empty intervals or let an analytics sink break the service", () => {
    const sink = vi.fn(() => {
      throw new Error("log sink unavailable");
    });
    const metrics = createFunnelMetrics({ sink, intervalMs: 60_000 });

    expect(() => metrics.flush()).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
    metrics.record("mcp_initializations");
    expect(() => metrics.close()).not.toThrow();
    expect(sink).toHaveBeenCalledOnce();
  });
});
