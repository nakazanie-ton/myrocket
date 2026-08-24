import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig, type XrocketConfig } from "../src/config.js";
import type { FetchLike } from "../src/client.js";
import { createXrocketServer } from "../src/server.js";
import { VERSION } from "../src/version.js";

const connected: Array<{ client: Client; server: McpServer }> = [];

async function connect(config: XrocketConfig, fetchImpl: FetchLike) {
  const server = createXrocketServer({ config, fetch: fetchImpl });
  const client = new Client({ name: "xrocket-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connected.push({ client, server });
  return { client, server };
}

afterEach(async () => {
  while (connected.length) {
    const pair = connected.pop()!;
    await pair.client.close();
    await pair.server.close();
  }
});

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const neverFetch: FetchLike = async () => {
  throw new Error("unexpected fetch");
};

function contentJson(result: { content?: unknown }): Record<string, unknown> {
  const content = result.content as Array<{ type: string; text?: string }>;
  return JSON.parse(content[0]!.text!) as Record<string, unknown>;
}

const expectedPublic = [
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
];
const expectedPrivate = [
  "xrocket_account_balances",
  "xrocket_account_overview",
  "xrocket_orders",
  "xrocket_transfers",
  "xrocket_withdrawal_quotas",
  "xrocket_withdrawals",
];
const expectedWrites = [
  "xrocket_order_cancel_execute",
  "xrocket_order_cancel_prepare",
  "xrocket_order_execute",
  "xrocket_order_prepare",
  "xrocket_transfer_execute",
  "xrocket_transfer_prepare",
  "xrocket_withdrawal_execute",
  "xrocket_withdrawal_prepare",
];

describe("MCP tool contract", () => {
  it.each([
    ["public", expectedPublic],
    ["private-read", [...expectedPublic, ...expectedPrivate]],
    ["full", [...expectedPublic, ...expectedPrivate, ...expectedWrites]],
  ] as const)("exposes only the %s profile catalog", async (profile, expected) => {
    const config = loadConfig({
      XROCKET_PROFILE: profile,
      ...(profile === "public" ? {} : { XROCKET_API_TOKEN: "test-token" }),
    });
    const { client } = await connect(config, neverFetch);
    expect(client.getInstructions()).toContain("xrocket_market_snapshot");
    expect(client.getInstructions()).toContain("never ask them to paste the token into chat");
    expect(client.getInstructions()).toContain("xrocket-mcp trading-config");
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([...expected].sort());
    for (const tool of tools.tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.annotations).toBeDefined();
    }
    const publicRead = tools.tools.find((tool) => tool.name === "xrocket_market_symbols")!;
    expect(publicRead.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    if (profile === "full") {
      const prepare = tools.tools.find((tool) => tool.name === "xrocket_order_prepare")!;
      expect(prepare.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      });
      const execute = tools.tools.find((tool) => tool.name === "xrocket_withdrawal_execute")!;
      expect(execute.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      });
      expect(Object.keys((execute.inputSchema.properties ?? {}) as object)).toEqual([
        "approvalReceipt",
      ]);
    }
  });

  it("resolves a base asset and returns a readable composite market snapshot", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/symbols" && !url.pathname.includes("GRAM-USDT")) {
        return json({
          symbols: [
            { symbol: "GRAM-BTC", baseAsset: "GRAM", quoteAsset: "BTC" },
            { symbol: "GRAM-USDT", baseAsset: "GRAM", quoteAsset: "USDT" },
          ],
        });
      }
      if (url.pathname === "/api/v1/symbols/GRAM-USDT") {
        return json({ symbol: "GRAM-USDT", baseAsset: "GRAM", quoteAsset: "USDT" });
      }
      if (url.pathname === "/api/v1/ticker/24h") {
        return json({ tickers: [{ symbol: "GRAM-USDT", last: "0.0032", high: "0.004", low: "0.003", changeRate: "2.5" }] });
      }
      if (url.pathname === "/api/v1/orderbook") {
        return json({ bids: [["0.0030", "2"], ["0.0031", "1"]], asks: [["0.0034", "2"], ["0.0033", "1"]] });
      }
      if (url.pathname === "/api/v1/trades") return json({ trades: [] });
      if (url.pathname === "/api/v1/trade-fees") {
        return json({ fees: [{ symbol: "GRAM-USDT", standard: { maker: "0.001", taker: "0.002" } }] });
      }
      throw new Error(`unexpected ${url.pathname}`);
    });
    const { client } = await connect(loadConfig({}), fetchMock);
    const result = await client.callTool({
      name: "xrocket_market_snapshot",
      arguments: { market: "gram" },
    });
    expect(result.isError).not.toBe(true);
    const text = (result.content?.[0] as { type: string; text: string }).text;
    expect(text).toContain("# GRAM-USDT on xRocket (mainnet)");
    expect(text).toContain("[Open xRocket](https://t.me/xRocket?start=kaban)");
    const fallback = JSON.parse(
      (result.content?.[1] as { type: string; text: string }).text,
    ) as { summary: { symbol: string } };
    expect(fallback.summary.symbol).toBe("GRAM-USDT");
    expect(result.structuredContent).toMatchObject({
      result: {
        summary: {
          symbol: "GRAM-USDT",
          bestBid: "0.0031",
          bestAsk: "0.0033",
          makerFee: "0.001",
          takerFee: "0.002",
        },
        actions: {
          tradeWithMcp: {
            label: "Trade with MCP",
            url: "https://xrocket-mcp-production.up.railway.app/#trade",
          },
          openXrocket: {
            label: "Open xRocket",
            url: "https://t.me/xRocket?start=kaban",
          },
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("returns exact candidates instead of guessing an ambiguous base asset", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      json({
        symbols: [
          { symbol: "ABC-BTC", baseAsset: "ABC", quoteAsset: "BTC" },
          { symbol: "ABC-ETH", baseAsset: "ABC", quoteAsset: "ETH" },
        ],
      }),
    );
    const { client } = await connect(loadConfig({}), fetchMock);
    const result = await client.callTool({
      name: "xrocket_market_snapshot",
      arguments: { market: "ABC" },
    });
    expect(result.isError).toBe(true);
    expect(contentJson(result).message).toContain("ABC-BTC, ABC-ETH");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a composite response contains another market", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/symbols") {
        return json({ symbols: [{ symbol: "GRAM-USDT", baseAsset: "GRAM", quoteAsset: "USDT" }] });
      }
      if (url.pathname === "/api/v1/symbols/GRAM-USDT") {
        return json({ symbol: "GRAM-USDT", baseAsset: "GRAM", quoteAsset: "USDT" });
      }
      if (url.pathname === "/api/v1/ticker/24h") {
        return json({ tickers: [{ symbol: "BTC-USDT", last: "100000" }] });
      }
      if (url.pathname === "/api/v1/orderbook") return json({ bids: [], asks: [] });
      if (url.pathname === "/api/v1/trades") return json({ trades: [] });
      if (url.pathname === "/api/v1/trade-fees") {
        return json({ fees: [{ symbol: "GRAM-USDT", standard: {} }] });
      }
      throw new Error(`unexpected ${url.pathname}`);
    });
    const { client } = await connect(loadConfig({}), fetchMock);
    const result = await client.callTool({
      name: "xrocket_market_snapshot",
      arguments: { market: "GRAM-USDT" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(contentJson(result).message).toBe(
      "Unexpected xRocket ticker response: GRAM-USDT row is missing",
    );
  });

  it("returns a private whole-account overview without inventing valuation", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/funding/balances")) return json({ balances: [{ asset: "USDT" }] });
      if (path.endsWith("/trading/balances")) return json({ balances: [{ asset: "GRAM" }] });
      if (path.endsWith("/orders/active")) return json({ orders: [{ orderId: "1" }] });
      throw new Error(`unexpected ${path}`);
    });
    const { client } = await connect(
      loadConfig({ XROCKET_API_TOKEN: "test-token" }),
      fetchMock,
    );
    const result = await client.callTool({ name: "xrocket_account_overview", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      result: {
        valuation: "not calculated",
        fundingBalances: { balances: [{ asset: "USDT" }] },
        tradingBalances: { balances: [{ asset: "GRAM" }] },
        activeOrders: { orders: [{ orderId: "1" }] },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns the configured onboarding links without making a request", async () => {
    const { client } = await connect(loadConfig({}), neverFetch);
    const result = await client.callTool({ name: "xrocket_onboarding_links", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(contentJson(result)).toMatchObject({
      mainnet: "https://t.me/xRocket?start=kaban",
      testnet: "https://t.me/xrocket_testnet_bot?start=kaban",
      tradingSetup: {
        hostedEndpointCanTrade: false,
        apiTokenMenu: "Menu > Settings > Exchange settings > API token",
        testnetCommand: `npx -y xrocket-mcp@${VERSION} trading-config`,
        mainnetCommand: `npx -y xrocket-mcp@${VERSION} trading-config --mainnet`,
      },
    });
  });

  it("accepts only documented candle intervals", async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async () => json([]));
    const { client } = await connect(loadConfig({}), fetchMock);
    const baseArguments = {
      symbol: "TON-USDT",
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-08-01T01:00:00.000Z",
    };
    for (const type of ["3min", "6hour"]) {
      const rejected = await client.callTool({
        name: "xrocket_market_candles",
        arguments: { ...baseArguments, type },
      });
      expect(rejected.isError).toBe(true);
    }
    const accepted = await client.callTool({
      name: "xrocket_market_candles",
      arguments: { ...baseArguments, type: "8hour" },
    });
    expect(accepted.isError).not.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a market order containing both size and funds before any API request", async () => {
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
    });
    const { client } = await connect(config, neverFetch);
    const rejected = await client.callTool({
      name: "xrocket_order_prepare",
      arguments: {
        order: {
          clientOrderId: "invalid-both",
          symbol: "TON-USDT",
          side: "buy",
          type: "market",
          size: "1",
          funds: "2",
          timeInForce: "IOC",
        },
      },
    });
    expect(rejected.isError).toBe(true);
  });

  it("stops preparation when a successful balance response has an unknown shape", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/v1/orders/estimate") return json({ estimate: "ok" });
      if (path === "/api/v1/symbols/GRAM-USDT") {
        return json({ baseAsset: "GRAM", quoteAsset: "USDT" });
      }
      if (path === "/api/v1/accounts/trading/balances") return json({ data: [] });
      if (path === "/api/v1/trade-fees") return json([]);
      throw new Error(`unexpected ${path}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
      }),
      fetchMock,
    );
    const result = await client.callTool({
      name: "xrocket_order_prepare",
      arguments: {
        order: {
          clientOrderId: "shape-drift",
          symbol: "GRAM-USDT",
          side: "buy",
          type: "market",
          funds: "1",
          timeInForce: "IOC",
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(contentJson(result)).toMatchObject({
      code: "TOOL_ERROR",
      message: "Unexpected xRocket balance response shape; preparation stopped",
    });
  });

  it("stops preparation when a balance row omits its asset identifier", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/v1/orders/estimate") return json({ estimate: "ok" });
      if (path === "/api/v1/symbols/GRAM-USDT") {
        return json({ baseAsset: "GRAM", quoteAsset: "USDT" });
      }
      if (path === "/api/v1/accounts/trading/balances") {
        return json({ balances: [{ available: "100" }] });
      }
      if (path === "/api/v1/trade-fees") return json([]);
      throw new Error(`unexpected ${path}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
      }),
      fetchMock,
    );
    const result = await client.callTool({
      name: "xrocket_order_prepare",
      arguments: {
        order: {
          clientOrderId: "row-shape-drift",
          symbol: "GRAM-USDT",
          side: "buy",
          type: "market",
          funds: "1",
          timeInForce: "IOC",
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(contentJson(result)).toMatchObject({
      code: "TOOL_ERROR",
      message: "Unexpected xRocket balance row shape; preparation stopped",
    });
  });

  it("forwards repeated assets for transfer and withdrawal history", async () => {
    const urls: URL[] = [];
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      urls.push(new URL(String(input)));
      return json([]);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "private-read",
      XROCKET_API_TOKEN: "test-token",
    });
    const { client } = await connect(config, fetchMock);
    await client.callTool({
      name: "xrocket_transfers",
      arguments: { view: "history", assets: ["TONCOIN", "USDT"] },
    });
    await client.callTool({
      name: "xrocket_withdrawals",
      arguments: { view: "history", assets: ["BTC", "USDT"] },
    });
    expect(urls[0]!.searchParams.getAll("assets")).toEqual(["TONCOIN", "USDT"]);
    expect(urls[1]!.searchParams.getAll("assets")).toEqual(["BTC", "USDT"]);
  });

  it("prepares, gates, executes once, and binds an order receipt to exact decimal strings", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/orders/estimate") return json({ fee: "0.01" });
      if (url.pathname === "/api/v1/symbols/TON-USDT") {
        return json({ baseAsset: "TONCOIN", quoteAsset: "USDT", minOrderSize: "0.1" });
      }
      if (url.pathname === "/api/v1/accounts/trading/balances") {
        return json({ balances: [{ asset: "USDT" }, { asset: "BTC" }] });
      }
      if (url.pathname === "/api/v1/trade-fees") return json([{ symbol: "TON-USDT" }]);
      if (url.pathname === "/api/v1/orders" && init?.method === "POST") {
        return json({ orderId: "42", status: "active" });
      }
      throw new Error(`unexpected ${init?.method} ${url.pathname}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
    });
    const { client } = await connect(config, fetchMock);
    const order = {
      clientOrderId: "agent-order-1",
      symbol: "TON-USDT",
      side: "buy",
      type: "limit",
      size: "1.00",
      price: "2.50",
      timeInForce: "GTC",
    };
    const prepared = await client.callTool({
      name: "xrocket_order_prepare",
      arguments: { order },
    });
    const receipt = contentJson(prepared).approvalReceipt as string;
    expect(contentJson(prepared).execution).toMatchObject({
      ready: false,
      blocker: "trading execution is disabled",
      nextStep: expect.stringContaining("XROCKET_ENABLE_TRADING=true"),
    });
    expect(
      (contentJson(prepared).execution as { nextStep: string }).nextStep,
    ).toContain("re-run prepare");
    expect(contentJson(prepared).instruction).toContain("do not attempt xrocket_order_execute");
    expect(contentJson(prepared).tradingBalances).toEqual({
      requestedAssets: ["TONCOIN", "USDT"],
      balances: [{ asset: "USDT" }],
    });

    const gated = await client.callTool({
      name: "xrocket_order_execute",
      arguments: { approvalReceipt: receipt, order },
    });
    expect(gated.isError).toBe(true);
    expect(contentJson(gated).message).toContain("XROCKET_ENABLE_TRADING");
    expect(fetchMock).toHaveBeenCalledTimes(4);

    config.enableTrading = true;
    const executed = await client.callTool({
      name: "xrocket_order_execute",
      arguments: { approvalReceipt: receipt, order: { ...order, size: "999" } },
    });
    expect(executed.isError).not.toBe(true);
    expect(contentJson(executed)).toMatchObject({ clientOrderId: "agent-order-1" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const orderRequest = fetchMock.mock.calls.find(
      ([input, init]) => new URL(String(input)).pathname === "/api/v1/orders" && init?.method === "POST",
    );
    expect(JSON.parse(String(orderRequest?.[1]?.body))).toEqual(order);

    const replay = await client.callTool({
      name: "xrocket_order_execute",
      arguments: { approvalReceipt: receipt },
    });
    expect(replay.isError).toBe(true);
    expect(contentJson(replay).message).toContain("already been consumed");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("generates bounded client identifiers when prepare callers omit them", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.body) bodies.push(JSON.parse(String(init.body)) as unknown);
      if (path === "/api/v1/orders/estimate") return json({ estimate: "ok" });
      if (path === "/api/v1/symbols/GRAM-USDT") return json({ baseAsset: "GRAM", quoteAsset: "USDT" });
      if (path === "/api/v1/accounts/trading/balances") return json({ balances: [] });
      if (path === "/api/v1/trade-fees") return json({ fees: [] });
      throw new Error(`unexpected ${path}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
      }),
      fetchMock,
    );
    const result = await client.callTool({
      name: "xrocket_order_prepare",
      arguments: {
        order: {
          symbol: "GRAM-USDT",
          side: "buy",
          type: "market",
          funds: "1",
          timeInForce: "IOC",
        },
      },
    });
    expect(result.isError).not.toBe(true);
    const prepared = contentJson(result).order as { clientOrderId: string };
    expect(prepared.clientOrderId).toMatch(/^order-[0-9a-f-]{36}$/);
    expect(prepared.clientOrderId.length).toBeLessThanOrEqual(64);
    expect(bodies[0]).toMatchObject({ clientOrderId: prepared.clientOrderId });
  });

  it("consumes a receipt before an ambiguous order write and tells the agent not to retry", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/v1/orders/estimate") return json({ estimate: "ok" });
      if (path === "/api/v1/symbols/TON-USDT") return json({ symbol: "TON-USDT" });
      if (path === "/api/v1/accounts/trading/balances") return json([]);
      if (path === "/api/v1/trade-fees") return json([]);
      if (path === "/api/v1/orders") throw new TypeError("socket reset");
      throw new Error(`unexpected ${path}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_TRADING: "true",
    });
    const { client } = await connect(config, fetchMock);
    const order = {
      clientOrderId: "ambiguous-order",
      symbol: "TON-USDT",
      side: "buy",
      type: "market",
      funds: "5.00",
      timeInForce: "IOC",
    };
    const prepared = await client.callTool({ name: "xrocket_order_prepare", arguments: { order } });
    const receipt = contentJson(prepared).approvalReceipt as string;
    const result = await client.callTool({
      name: "xrocket_order_execute",
      arguments: { approvalReceipt: receipt },
    });
    expect(result.isError).toBe(true);
    expect(contentJson(result)).toMatchObject({
      code: "WRITE_OUTCOME_UNKNOWN",
      clientId: "ambiguous-order",
      doNotRetry: true,
    });
    const replay = await client.callTool({
      name: "xrocket_order_execute",
      arguments: { approvalReceipt: receipt },
    });
    expect(contentJson(replay).code).toBe("APPROVAL_RECEIPT_ERROR");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("prepares and executes cancellation using only the stored receipt intent", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname !== "/api/v1/order") throw new Error(`unexpected ${url.pathname}`);
      if (init?.method === "GET") return json({ orderId: "42", status: "active" });
      if (init?.method === "DELETE") return json({ orderId: "42", status: "canceled" });
      throw new Error(`unexpected method ${init?.method}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_TRADING: "true",
    });
    const { client } = await connect(config, fetchMock);
    const prepared = await client.callTool({
      name: "xrocket_order_cancel_prepare",
      arguments: { cancellation: { orderId: "42", clientOrderId: "agent-order-42" } },
    });
    const executed = await client.callTool({
      name: "xrocket_order_cancel_execute",
      arguments: { approvalReceipt: contentJson(prepared).approvalReceipt },
    });
    expect(executed.isError).not.toBe(true);
    expect(contentJson(executed).identifier).toBe("42");
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")!;
    expect(new URL(String(deleteCall[0])).searchParams.get("orderId")).toBe("42");
    expect(new URL(String(deleteCall[0])).searchParams.get("clientOrderId")).toBe(
      "agent-order-42",
    );
    expect(Object.keys((await client.listTools()).tools.find(
      (tool) => tool.name === "xrocket_order_cancel_execute",
    )!.inputSchema.properties ?? {})).toEqual(["approvalReceipt"]);
  });

  it("uses separate transfer and withdrawal gates and preserves decimal strings in write bodies", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.body) bodies.push(JSON.parse(String(init.body)) as unknown);
      if (path.endsWith("/balances")) {
        return json({
          balances: [
            { asset: "USDT", available: "100.00" },
            { asset: "BTC", available: "50.00" },
          ],
        });
      }
      if (path.includes("/api/v1/assets/")) {
        return json({
          asset: "USDT",
          precision: 6,
          availableTransfers: ["fundingToTrading", "tradingToFunding"],
        });
      }
      if (path.endsWith("/withdrawal-quotas")) return json({ withdrawFee: "0.10" });
      if (path.endsWith("/transfers")) return json({ transferId: "t1" });
      if (path.endsWith("/withdrawals")) return json({ withdrawalId: "w1" });
      throw new Error(`unexpected ${path}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_TRANSFERS: "true",
      XROCKET_ENABLE_WITHDRAWALS: "true",
    });
    const { client } = await connect(config, fetchMock);
    const transfer = {
      clientTransferId: "transfer-01",
      asset: "USDT",
      amount: "10.00",
      from: "funding",
      to: "trading",
    };
    const transferPrepared = await client.callTool({
      name: "xrocket_transfer_prepare",
      arguments: { transfer },
    });
    expect(contentJson(transferPrepared).sourceBalances).toEqual({
      requestedAssets: ["USDT"],
      balances: [{ asset: "USDT", available: "100.00" }],
    });
    await client.callTool({
      name: "xrocket_transfer_execute",
      arguments: {
        approvalReceipt: contentJson(transferPrepared).approvalReceipt,
      },
    });

    const withdrawal = {
      clientWithdrawalId: "withdrawal-01",
      network: "TON",
      asset: "USDT",
      address: "EQCexample",
      amount: "9.90",
      comment: "agent approved",
    };
    const withdrawalPrepared = await client.callTool({
      name: "xrocket_withdrawal_prepare",
      arguments: { withdrawal },
    });
    expect(contentJson(withdrawalPrepared).fundingBalances).toEqual({
      requestedAssets: ["USDT"],
      balances: [{ asset: "USDT", available: "100.00" }],
    });
    await client.callTool({
      name: "xrocket_withdrawal_execute",
      arguments: {
        approvalReceipt: contentJson(withdrawalPrepared).approvalReceipt,
      },
    });

    expect(bodies).toContainEqual(transfer);
    expect(bodies).toContainEqual(withdrawal);
  });

  it.each([
    [
      { asset: "USDT", precision: 6, availableTransfers: ["tradingToFunding"] },
      "xRocket asset does not allow fundingToTrading; preparation stopped",
    ],
    [
      { asset: "USDT", precision: 6 },
      "Unexpected xRocket asset transfer metadata; preparation stopped",
    ],
  ])("stops transfer preparation when asset direction metadata is unusable", async (
    assetMetadata,
    expectedMessage,
  ) => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/balances")) {
        return json({ balances: [{ asset: "USDT", available: "100.00" }] });
      }
      if (path.includes("/api/v1/assets/")) {
        return json(assetMetadata);
      }
      throw new Error(`unexpected ${path}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
      }),
      fetchMock,
    );

    const result = await client.callTool({
      name: "xrocket_transfer_prepare",
      arguments: {
        transfer: {
          clientTransferId: "unsupported-direction",
          asset: "USDT",
          amount: "10.00",
          from: "funding",
          to: "trading",
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(contentJson(result)).toMatchObject({
      code: "TOOL_ERROR",
      message: expectedMessage,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts the documented trading-to-funding transfer direction", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/balances")) {
        return json({ balances: [{ asset: "USDT", available: "100.00" }] });
      }
      if (path.includes("/api/v1/assets/")) {
        return json({
          asset: "USDT",
          precision: 6,
          availableTransfers: ["tradingToFunding"],
        });
      }
      throw new Error(`unexpected ${path}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
      }),
      fetchMock,
    );

    const result = await client.callTool({
      name: "xrocket_transfer_prepare",
      arguments: {
        transfer: {
          clientTransferId: "reverse-direction",
          asset: "USDT",
          amount: "10.00",
          from: "trading",
          to: "funding",
        },
      },
    });

    expect(result.isError).not.toBe(true);
    expect(contentJson(result).transfer).toMatchObject({
      from: "trading",
      to: "funding",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("redacts withdrawal destinations and memos from upstream error details", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/balances")) {
        return json({ balances: [{ asset: "USDT", available: "100.00" }] });
      }
      if (path.includes("/api/v1/assets/")) return json({ asset: "USDT", precision: 6 });
      if (path.endsWith("/withdrawal-quotas")) return json({ withdrawFee: "0.10" });
      if (path.endsWith("/withdrawals") && init?.method === "POST") {
        return json(
          {
            code: "INVALID_DESTINATION",
            address: "EQCprivate",
            comment: "private comment",
            message: "Invalid address EQCprivate with private comment",
            nested: { destination: "wallet", memo: "private memo" },
          },
          400,
        );
      }
      throw new Error(`unexpected ${init?.method} ${path}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_WITHDRAWALS: "true",
    });
    const { client } = await connect(config, fetchMock);
    const prepared = await client.callTool({
      name: "xrocket_withdrawal_prepare",
      arguments: {
        withdrawal: {
          clientWithdrawalId: "redacted-withdrawal",
          network: "TON",
          asset: "USDT",
          address: "EQCprivate",
          amount: "1.00",
          comment: "private comment",
        },
      },
    });
    const result = await client.callTool({
      name: "xrocket_withdrawal_execute",
      arguments: { approvalReceipt: contentJson(prepared).approvalReceipt },
    });

    expect(result.isError).toBe(true);
    expect(contentJson(result)).toMatchObject({
      code: "XROCKET_HTTP_ERROR",
      status: 400,
      details: {
        code: "INVALID_DESTINATION",
        address: "[REDACTED]",
        comment: "[REDACTED]",
        message: "Invalid address [REDACTED] with [REDACTED]",
        nested: { destination: "[REDACTED]", memo: "[REDACTED]" },
      },
    });
  });
});
