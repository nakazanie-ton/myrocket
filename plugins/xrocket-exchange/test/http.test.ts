import { request as httpRequest } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../src/client.js";
import {
  loadHostedHttpOptions,
  startHostedHttpServer,
  type HostedHttpOptions,
  type HostedHttpServer,
} from "../src/http.js";
import type { FunnelSnapshot } from "../src/funnel-metrics.js";
import { HOSTED_MCP_URL, XROCKET_MAINNET_URL } from "../src/links.js";
import { hostedPublicConfig } from "../src/public-server.js";

const servers: HostedHttpServer[] = [];
const clients: Client[] = [];
const PUBLIC_TOOL_NAMES = [
  "xrocket_asset_info",
  "xrocket_market_candles",
  "xrocket_market_orderbook",
  "xrocket_market_snapshot",
  "xrocket_market_symbols",
  "xrocket_market_tickers",
  "xrocket_market_trades",
  "xrocket_onboarding_links",
  "xrocket_rates",
  "xrocket_trade_fees",
] as const;

afterEach(async () => {
  while (clients.length) await clients.pop()!.close();
  while (servers.length) await servers.pop()!.close();
});

async function start(
  allowedOrigins = "client.example",
  fetchImpl?: FetchLike,
  overrides: Partial<HostedHttpOptions> = {},
): Promise<HostedHttpServer> {
  const server = await startHostedHttpServer(
    {
      ...loadHostedHttpOptions({
        HOST: "127.0.0.1",
        PORT: "0",
        XROCKET_HTTP_ALLOWED_ORIGINS: allowedOrigins,
      }),
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
      ...overrides,
    },
  );
  servers.push(server);
  return server;
}

function rawRequest(
  port: number,
  options: { method: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: "127.0.0.1",
        port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.once("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

describe("hosted Streamable HTTP server", () => {
  it("hard-codes a public mainnet profile with every write gate disabled", () => {
    const config = hostedPublicConfig();
    expect(config).not.toHaveProperty("apiToken");
    expect(config).toMatchObject({
      profile: "public",
      environment: "mainnet",
      enableTrading: false,
      enableTransfers: false,
      enableWithdrawals: false,
      allowMainnetWrites: false,
    });
  });

  it("ignores private and write environment settings", () => {
    const options = loadHostedHttpOptions({
      HOST: "127.0.0.1",
      PORT: "0",
      XROCKET_API_TOKEN: "must-not-be-read",
      XROCKET_PROFILE: "full",
      XROCKET_ENABLE_TRADING: "true",
      XROCKET_ENABLE_TRANSFERS: "true",
      XROCKET_ENABLE_WITHDRAWALS: "true",
      XROCKET_ALLOW_MAINNET_WRITES: "true",
    });
    expect(options).not.toHaveProperty("apiToken");
    expect(options).not.toHaveProperty("profile");
    expect(options).not.toHaveProperty("enableTrading");
  });

  it("serves health and the exact public MCP catalog over Streamable HTTP", async () => {
    const server = await start();
    const health = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      status: "ok",
      profile: "public",
      environment: "mainnet",
      transport: "streamable-http",
    });

    const client = new Client({ name: "xrocket-http-test", version: "1.0.0" });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)),
    );
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(PUBLIC_TOOL_NAMES);

    const onboarding = await client.callTool({
      name: "xrocket_onboarding_links",
      arguments: {},
    });
    expect(onboarding.isError).not.toBe(true);

    await expect(
      client.callTool({
        name: "xrocket_account_overview",
        arguments: {},
      }),
    ).rejects.toThrow("Tool xrocket_account_overview not found");
  });

  it("serves a secure zero-install landing page and fixed Open xRocket redirect", async () => {
    const server = await start();
    const landing = await rawRequest(server.port, { method: "GET", path: "/" });
    expect(landing.status).toBe(200);
    expect(landing.headers["content-type"]).toContain("text/html");
    expect(landing.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(landing.headers["referrer-policy"]).toBe("no-referrer");
    expect(landing.headers["set-cookie"]).toBeUndefined();
    expect(landing.body).toContain(HOSTED_MCP_URL);
    expect(landing.body).toContain('href="/open"');
    expect(landing.body).not.toMatch(/referral|affiliate|commission/i);
    expect(landing.body).not.toContain("start=kaban");

    const script = await rawRequest(server.port, { method: "GET", path: "/landing.js" });
    expect(script.status).toBe(200);
    expect(script.body).toContain("navigator.clipboard.writeText");
    expect(script.body).not.toContain("fetch(");

    const head = await rawRequest(server.port, { method: "HEAD", path: "/" });
    expect(head.status).toBe(200);
    expect(head.body).toBe("");

    const open = await rawRequest(server.port, {
      method: "GET",
      path: "/open?next=https://evil.example",
    });
    expect(open.status).toBe(302);
    expect(open.headers.location).toBe(XROCKET_MAINNET_URL);
    expect(open.headers["referrer-policy"]).toBe("no-referrer");

    const rejected = await rawRequest(server.port, { method: "POST", path: "/open" });
    expect(rejected.status).toBe(405);
  });

  it("rejects an untrusted Host before serving landing routes", async () => {
    const server = await start();
    const response = await rawRequest(server.port, {
      method: "GET",
      path: "/",
      headers: { Host: "evil.example" },
    });
    expect(response.status).toBe(403);
  });

  it("emits only aggregate funnel counts for successful activity", async () => {
    const snapshots: FunnelSnapshot[] = [];
    const server = await start("client.example", undefined, {
      onFunnelSnapshot: (snapshot) => snapshots.push(snapshot),
    });
    await rawRequest(server.port, { method: "GET", path: "/" });
    await rawRequest(server.port, { method: "GET", path: "/open" });
    const failedInitialize = await rawRequest(server.port, {
      method: "POST",
      path: "/mcp",
      headers: {
        Host: "127.0.0.1",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 99 }),
    });
    expect(failedInitialize.body).toContain("error");

    const client = new Client({ name: "xrocket-metrics-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`)),
    );
    const invalidToolCall = await client.callTool({
      name: "xrocket_market_symbols",
      arguments: { symbol: "" },
    });
    expect(invalidToolCall.isError).toBe(true);
    await client.callTool({ name: "xrocket_onboarding_links", arguments: {} });
    await client.close();
    await server.close();

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      landing_views: 1,
      open_clicks: 1,
      mcp_initializations: 1,
      public_tool_calls: 1,
      onboarding_tool_calls: 1,
    });
    expect(JSON.stringify(snapshots[0])).not.toContain("xrocket-metrics-test");
    expect(JSON.stringify(snapshots[0])).not.toContain("arguments");
  });

  it("rejects unknown hosts and origins before MCP dispatch", async () => {
    const server = await start();
    const badHost = await rawRequest(server.port, {
      method: "POST",
      path: "/mcp",
      headers: {
        Host: "evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
    });
    expect(badHost.status).toBe(403);

    const badOrigin = await rawRequest(server.port, {
      method: "OPTIONS",
      path: "/mcp",
      headers: { Host: "127.0.0.1", Origin: "https://evil.example" },
    });
    expect(badOrigin.status).toBe(403);
  });

  it("answers an allowed browser preflight with a narrow CORS policy", async () => {
    const server = await start();
    const response = await rawRequest(server.port, {
      method: "OPTIONS",
      path: "/mcp",
      headers: {
        Host: "127.0.0.1",
        Origin: "https://client.example",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://client.example");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("rejects oversized request bodies before parsing", async () => {
    const server = await start();
    const response = await rawRequest(server.port, {
      method: "POST",
      path: "/mcp",
      headers: {
        Host: "127.0.0.1",
        "Content-Type": "application/json",
        "Content-Length": String(256 * 1024 + 1),
      },
    });
    expect(response.status).toBe(413);
    expect(response.body).toContain("Request body is too large");
  });

  it("rejects JSON-RPC batches before any tool can reach xRocket", async () => {
    const upstreamFetch = vi.fn<FetchLike>();
    const server = await start("client.example", upstreamFetch);
    const response = await rawRequest(server.port, {
      method: "POST",
      path: "/mcp",
      headers: {
        Host: "127.0.0.1",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
      },
      body: JSON.stringify([
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: "xrocket_market_symbols", arguments: {} },
          id: 1,
        },
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: "xrocket_market_symbols", arguments: {} },
          id: 2,
        },
      ]),
    });
    expect(response.status).toBe(400);
    expect(response.body).toContain("JSON-RPC batch requests are not accepted");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("rejects compressed bodies and unrelated HTTP methods", async () => {
    const server = await start();
    const compressed = await rawRequest(server.port, {
      method: "POST",
      path: "/mcp",
      headers: {
        Host: "127.0.0.1",
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: "not-really-gzip",
    });
    expect(compressed.status).toBe(415);

    const unrelatedMethod = await rawRequest(server.port, {
      method: "PUT",
      path: "/mcp",
      headers: { Host: "127.0.0.1" },
    });
    expect(unrelatedMethod.status).toBe(405);
    expect(unrelatedMethod.headers.allow).toContain("POST");
  });
});
