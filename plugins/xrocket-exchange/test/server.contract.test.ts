import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig, type XrocketConfig } from "../src/config.js";
import type { FetchLike } from "../src/client.js";
import { createXrocketServer } from "../src/server.js";
import { VERSION } from "../src/version.js";

const connected: Array<{ client: Client; server: McpServer }> = [];
const statePaths: string[] = [];

function agentStatePath(): string {
  const statePath = path.join(tmpdir(), `xrocket-mcp-test-${randomUUID()}.json`);
  statePaths.push(statePath);
  return statePath;
}

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
  while (statePaths.length) {
    const statePath = statePaths.pop()!;
    await rm(statePath, { force: true });
    await rm(`${statePath}.lock`, { force: true });
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
  "xrocket_agent_cancel",
  "xrocket_agent_policy",
  "xrocket_agent_trade",
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
      const trade = tools.tools.find((tool) => tool.name === "xrocket_agent_trade")!;
      expect(trade.annotations).toMatchObject({ destructiveHint: true, idempotentHint: false });
      expect(Object.keys((trade.inputSchema.properties ?? {}) as object)).toEqual(["order"]);
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
        testnetCommand: `npx -y xrocket-mcp@${VERSION} trading-config --limit 100 --asset USD`,
        mainnetCommand: `npx -y xrocket-mcp@${VERSION} trading-config --limit 100 --asset USD --mainnet`,
        autonomousTrading: expect.arrayContaining([
          expect.stringContaining("without per-order approval"),
        ]),
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
      XROCKET_ENABLE_TRADING: "true",
      XROCKET_TRADING_LIMIT: "10 USD",
      XROCKET_AGENT_STATE_PATH: agentStatePath(),
    });
    const { client } = await connect(config, neverFetch);
    const rejected = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: {
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

  it("places orders autonomously inside one USD daily limit and blocks excess volume", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/orders/estimate") {
        const body = JSON.parse(String(init?.body)) as { symbol: string; funds?: string; size?: string };
        return json({ symbol: body.symbol, funds: body.funds ?? body.size ?? "0" });
      }
      if (url.pathname === "/api/v1/symbols/TON-USDT") {
        return json({ symbol: "TON-USDT", quoteAsset: "USDT", enableTrading: true });
      }
      if (url.pathname === "/api/v1/orders/active") return json({ orders: [] });
      if (url.pathname === "/api/v1/orders/history") {
        return json({ orders: [], currentPage: 1, pageSize: 100, totalNum: 0, totalPage: 0 });
      }
      if (url.pathname === "/api/v1/rates") return json({ USDT: { rate: "1" } });
      if (url.pathname === "/api/v1/orders" && init?.method === "POST") {
        return json({ id: "42", status: "working" });
      }
      throw new Error(`unexpected ${init?.method} ${url.pathname}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_TRADING: "true",
      XROCKET_TRADING_LIMIT: "10 USD",
      XROCKET_AGENT_STATE_PATH: agentStatePath(),
    });
    const { client } = await connect(config, fetchMock);
    const executed = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: {
          symbol: "TON-USDT",
          side: "buy",
          type: "market",
          funds: "6.00",
          timeInForce: "IOC",
        },
      },
    });
    expect(executed.isError).not.toBe(true);
    expect(contentJson(executed)).toMatchObject({
      policy: { dailyLimit: "10 USD", usedAfterOrderUsd: "6", remainingUsd: "4" },
    });
    expect(String(contentJson(executed).clientOrderId)).toMatch(/^xrmcp-[0-9a-f-]{36}$/);
    const orderRequest = fetchMock.mock.calls.find(
      ([input, init]) => new URL(String(input)).pathname === "/api/v1/orders" && init?.method === "POST",
    );
    expect(JSON.parse(String(orderRequest?.[1]?.body))).toMatchObject({
      symbol: "TON-USDT",
      funds: "6.00",
      clientOrderId: expect.stringMatching(/^xrmcp-/),
    });

    const overLimit = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: {
          symbol: "TON-USDT",
          side: "buy",
          type: "market",
          funds: "5",
          timeInForce: "IOC",
        },
      },
    });
    expect(overLimit.isError).toBe(true);
    expect(contentJson(overLimit).message).toContain("Daily autonomous trading limit exceeded");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST" && init.body).length).toBe(3);
  });

  it("values any spot quote asset against a limit expressed in another asset", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/orders/estimate") {
        return json({ symbol: "GRAM-BTC", funds: "0.0001" });
      }
      if (url.pathname === "/api/v1/symbols/GRAM-BTC") {
        return json({ symbol: "GRAM-BTC", quoteAsset: "BTC", enableTrading: true });
      }
      if (url.pathname === "/api/v1/orders/active") return json({ orders: [] });
      if (url.pathname === "/api/v1/orders/history") {
        return json({ orders: [], currentPage: 1, pageSize: 100, totalNum: 0, totalPage: 0 });
      }
      if (url.pathname === "/api/v1/rates") {
        expect(url.searchParams.getAll("assets")).toEqual(["BTC", "TONCOIN"]);
        return json({ BTC: { rate: "50000" }, TONCOIN: { rate: "3" } });
      }
      if (url.pathname === "/api/v1/orders" && init?.method === "POST") {
        return json({ id: "cross-rate-order", status: "working" });
      }
      throw new Error(`unexpected ${init?.method} ${url.pathname}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
        XROCKET_ENABLE_TRADING: "true",
        XROCKET_TRADING_LIMIT: "2 TONCOIN",
        XROCKET_AGENT_STATE_PATH: agentStatePath(),
      }),
      fetchMock,
    );
    const result = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: {
          symbol: "GRAM-BTC",
          side: "buy",
          type: "market",
          funds: "0.0001",
          timeInForce: "IOC",
        },
      },
    });
    expect(result.isError).not.toBe(true);
    expect(contentJson(result)).toMatchObject({
      policy: {
        dailyLimit: "2 TONCOIN",
        orderValueUsd: "5",
        remainingUsd: "1",
      },
    });
  });

  it("recovers today's autonomous usage from xRocket before accepting another process", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/orders/estimate") {
        return json({ symbol: "GRAM-USDT", funds: "4" });
      }
      if (url.pathname === "/api/v1/symbols/GRAM-USDT") {
        return json({ symbol: "GRAM-USDT", quoteAsset: "USDT", enableTrading: true });
      }
      if (url.pathname === "/api/v1/orders/active") return json({ orders: [] });
      if (url.pathname === "/api/v1/orders/history") {
        return json({
          orders: [{
            id: "remote-order",
            clientOrderId: "xrmcp-from-another-process",
            symbol: "TON-USDT",
            status: "completed",
            createdAt: now,
            quoteAsset: "USDT",
            funds: "0",
            dealFunds: "7",
          }],
          currentPage: 1,
          pageSize: 100,
          totalNum: 1,
          totalPage: 1,
        });
      }
      if (url.pathname === "/api/v1/rates") return json({ USDT: { rate: "1" } });
      if (url.pathname === "/api/v1/orders" && init?.method === "POST") {
        throw new Error("policy should block before placement");
      }
      throw new Error(`unexpected ${init?.method} ${url.pathname}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
        XROCKET_ENABLE_TRADING: "true",
        XROCKET_TRADING_LIMIT: "10 USD",
        XROCKET_AGENT_STATE_PATH: agentStatePath(),
      }),
      fetchMock,
    );
    const result = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: {
          symbol: "GRAM-USDT",
          side: "buy",
          type: "market",
          funds: "4",
          timeInForce: "IOC",
        },
      },
    });
    expect(result.isError).toBe(true);
    expect(contentJson(result).message).toContain("Daily autonomous trading limit exceeded");
    expect(fetchMock.mock.calls.some(([input, init]) =>
      new URL(String(input)).pathname === "/api/v1/orders" && init?.method === "POST",
    )).toBe(false);
  });

  it("keeps the order-count guard out of onboarding but still enforces it", async () => {
    let placed = 0;
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/orders/estimate") {
        return json({ symbol: "TON-USDT", funds: "1" });
      }
      if (url.pathname === "/api/v1/symbols/TON-USDT") {
        return json({ symbol: "TON-USDT", quoteAsset: "USDT", enableTrading: true });
      }
      if (url.pathname === "/api/v1/orders/active") return json({ orders: [] });
      if (url.pathname === "/api/v1/orders/history") {
        return json({ orders: [], currentPage: 1, pageSize: 100, totalNum: 0, totalPage: 0 });
      }
      if (url.pathname === "/api/v1/rates") return json({ USDT: { rate: "1" } });
      if (url.pathname === "/api/v1/orders" && init?.method === "POST") {
        placed += 1;
        return json({ id: `order-${placed}`, status: "working" });
      }
      throw new Error(`unexpected ${init?.method} ${url.pathname}`);
    });
    const { client } = await connect(
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "test-token",
        XROCKET_ENVIRONMENT: "testnet",
        XROCKET_ENABLE_TRADING: "true",
        XROCKET_TRADING_LIMIT: "100 USD",
        XROCKET_MAX_DAILY_ORDERS: "1",
        XROCKET_AGENT_STATE_PATH: agentStatePath(),
      }),
      fetchMock,
    );
    const order = {
      symbol: "TON-USDT",
      side: "buy",
      type: "market",
      funds: "1",
      timeInForce: "IOC",
    } as const;
    expect((await client.callTool({ name: "xrocket_agent_trade", arguments: { order } })).isError)
      .not.toBe(true);
    const blocked = await client.callTool({ name: "xrocket_agent_trade", arguments: { order } });
    expect(blocked.isError).toBe(true);
    expect(contentJson(blocked).message).toContain("Daily autonomous order limit reached: 1");
    expect(placed).toBe(1);
  });

  it("reserves unknown order value durably and never retries the write", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/v1/orders/estimate") return json({ symbol: "TON-USDT", funds: "7" });
      if (path === "/api/v1/symbols/TON-USDT") return json({ symbol: "TON-USDT", quoteAsset: "USDT" });
      if (path === "/api/v1/orders/active") return json({ orders: [] });
      if (path === "/api/v1/orders/history") {
        return json({ orders: [], currentPage: 1, pageSize: 100, totalNum: 0, totalPage: 0 });
      }
      if (path === "/api/v1/rates") return json({ USDT: { rate: "1" } });
      if (path === "/api/v1/order") return json({ message: "not found" }, 404);
      if (path === "/api/v1/orders") throw new TypeError("socket reset");
      throw new Error(`unexpected ${path}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_TRADING: "true",
      XROCKET_TRADING_LIMIT: "10 USD",
      XROCKET_AGENT_STATE_PATH: agentStatePath(),
    });
    const { client } = await connect(config, fetchMock);
    const result = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: { symbol: "TON-USDT", side: "buy", type: "market", funds: "7", timeInForce: "IOC" },
      },
    });
    expect(result.isError).toBe(true);
    expect(contentJson(result)).toMatchObject({
      code: "WRITE_OUTCOME_UNKNOWN",
      clientId: expect.stringMatching(/^xrmcp-/),
      doNotRetry: true,
    });
    const blocked = await client.callTool({
      name: "xrocket_agent_trade",
      arguments: {
        order: { symbol: "TON-USDT", side: "buy", type: "market", funds: "7", timeInForce: "IOC" },
      },
    });
    expect(contentJson(blocked).message).toContain("Daily autonomous trading limit exceeded");
    expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname === "/api/v1/orders")).toHaveLength(1);
  });

  it("cancels an order directly without approval", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname !== "/api/v1/order") throw new Error(`unexpected ${url.pathname}`);
      if (init?.method === "GET") return json({ id: "42", symbol: "TON-USDT", status: "working" });
      if (init?.method === "DELETE") return json({ cancelledOrderIds: ["42"] });
      throw new Error(`unexpected method ${init?.method}`);
    });
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "test-token",
      XROCKET_ENVIRONMENT: "testnet",
      XROCKET_ENABLE_TRADING: "true",
      XROCKET_TRADING_LIMIT: "10 USD",
      XROCKET_AGENT_STATE_PATH: agentStatePath(),
    });
    const { client } = await connect(config, fetchMock);
    const executed = await client.callTool({
      name: "xrocket_agent_cancel",
      arguments: { cancellation: { orderId: "42" } },
    });
    expect(executed.isError).not.toBe(true);
    expect(contentJson(executed)).toMatchObject({ order: { id: "42", symbol: "TON-USDT" } });
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")!;
    expect(new URL(String(deleteCall[0])).searchParams.get("orderId")).toBe("42");
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
