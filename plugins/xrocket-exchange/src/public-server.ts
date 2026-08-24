import { McpServer, type CallToolResult, type ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";
import { API_BASE_URLS, type XrocketConfig } from "./config.js";
import { XrocketClient, type FetchLike } from "./client.js";
import { XrocketHttpError } from "./errors.js";
import {
  HOSTED_TRADING_URL,
  XROCKET_API_DOCS_URL,
  XROCKET_MAINNET_URL,
  XROCKET_TESTNET_URL,
} from "./links.js";
import {
  buildMarketSnapshot,
  marketSnapshotText,
  resolveMarket,
} from "./usability.js";
import { VERSION } from "./version.js";

const resultSchema = z.object({ result: z.unknown() });
const symbolSchema = z
  .string()
  .min(1)
  .max(64)
  .describe("Exact current xRocket symbol, for example GRAM-USDT");
const assetSchema = z
  .string()
  .min(1)
  .max(64)
  .describe("Exact xRocket asset identifier; TON is currently TONCOIN");
const decimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "must be a plain non-negative decimal string")
  .refine((value) => /[1-9]/.test(value), "must be greater than zero")
  .describe("Exact positive decimal string; never use a JSON number");
const intervalSchema = z.enum([
  "1min",
  "5min",
  "15min",
  "30min",
  "1hour",
  "2hour",
  "4hour",
  "8hour",
  "12hour",
  "1day",
  "1week",
  "1month",
]);
const dateTimeSchema = z.string().datetime({ offset: true });

const READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
const LOCAL_READ: ToolAnnotations = { ...READ, openWorldHint: false };

export const PUBLIC_TOOL_NAMES = [
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
export type PublicToolName = (typeof PUBLIC_TOOL_NAMES)[number];

function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

function boundedErrorDetails(details: unknown): unknown {
  try {
    const serialized = JSON.stringify(details, (key, value: unknown) =>
      /token|authorization|secret|address|destination|memo|comment/i.test(key)
        ? "[REDACTED]"
        : value,
    );
    if (serialized.length <= 4_000) return JSON.parse(serialized) as unknown;
    return { truncated: true, preview: serialized.slice(0, 4_000) };
  } catch {
    return "Unserializable upstream error details";
  }
}

function errorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof XrocketHttpError) {
    return {
      ok: false,
      code: "XROCKET_HTTP_ERROR",
      message: error.message,
      status: error.status,
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      details: boundedErrorDetails(error.details),
    };
  }
  return {
    ok: false,
    code: "TOOL_ERROR",
    message: error instanceof Error ? error.message : "Unknown tool error",
  };
}

function markSuccess(onSuccess: (() => void) | undefined): void {
  try {
    onSuccess?.();
  } catch {
    // Aggregate metrics must never affect a tool result.
  }
}

async function run(
  action: () => Promise<unknown> | unknown,
  onSuccess?: () => void,
): Promise<CallToolResult> {
  try {
    const value = await action();
    markSuccess(onSuccess);
    return {
      content: [{ type: "text", text: jsonText(value) }],
      structuredContent: { result: value },
    };
  } catch (error) {
    const payload = errorPayload(error);
    return {
      content: [{ type: "text", text: jsonText(payload) }],
      structuredContent: { result: payload },
      isError: true,
    };
  }
}

async function runWithText(
  action: () => Promise<{ value: unknown; text: string }>,
  onSuccess?: () => void,
): Promise<CallToolResult> {
  try {
    const result = await action();
    markSuccess(onSuccess);
    return {
      content: [
        { type: "text", text: result.text },
        { type: "text", text: jsonText(result.value) },
      ],
      structuredContent: { result: result.value },
    };
  } catch (error) {
    const payload = errorPayload(error);
    return {
      content: [{ type: "text", text: jsonText(payload) }],
      isError: true,
    };
  }
}

export function hostedPublicConfig(): XrocketConfig {
  return {
    profile: "public",
    environment: "mainnet",
    apiBaseUrl: API_BASE_URLS.mainnet,
    enableTrading: false,
    enableTransfers: false,
    enableWithdrawals: false,
    allowMainnetWrites: false,
    approvalTtlMs: 300_000,
    requestTimeoutMs: 15_000,
    maxResponseBytes: 2_000_000,
  };
}

export function registerPublicXrocketTools(
  server: McpServer,
  client: XrocketClient,
  environment: XrocketConfig["environment"],
  onToolSuccess?: (toolName: PublicToolName) => void,
): void {
  const success = (toolName: PublicToolName) => () => onToolSuccess?.(toolName);
  server.registerTool(
    "xrocket_market_snapshot",
    {
      title: "xRocket market snapshot",
      description:
        "Resolve an exact symbol or base asset and return market rules, ticker, best bid/ask, recent trades, and fees in one read-only call. Exact symbols win; ambiguous assets are never guessed.",
      inputSchema: z.object({
        market: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .describe("Exact symbol such as GRAM-USDT, or a base asset such as GRAM"),
        depth: z
          .union([z.literal(5), z.literal(10), z.literal(20), z.literal(50), z.literal(100)])
          .default(20),
        precision: decimalSchema.optional(),
      }),
      outputSchema: z.object({
        result: z.object({
          environment: z.string(),
          retrievedAt: z.string(),
          summary: z.record(z.string(), z.unknown()),
          constraints: z.object({ decimalValues: z.string(), consistency: z.string() }),
          actions: z.object({
            tradeWithMcp: z.object({
              label: z.literal("Trade with MCP"),
              url: z.string().url(),
            }),
            openXrocket: z.object({
              label: z.literal("Open xRocket"),
              url: z.string().url(),
            }),
          }),
          details: z.object({
            symbolRules: z.unknown(),
            ticker: z.unknown(),
            orderbook: z.unknown(),
            recentTrades: z.unknown(),
            tradeFees: z.unknown(),
          }),
        }),
      }),
      annotations: READ,
    },
    ({ market, depth, precision }) =>
      runWithText(async () => {
        const symbols = await client.getSymbols();
        const resolved = resolveMarket(symbols, market);
        const [symbolRules, ticker, orderbook, trades, fees] = await Promise.all([
          client.getSymbols(resolved.symbol),
          client.getTickers("24h", [resolved.symbol]),
          client.getOrderbook({ symbol: resolved.symbol, depth, precision }),
          client.getTrades(resolved.symbol),
          client.getTradeFees([resolved.symbol]),
        ]);
        const snapshot = buildMarketSnapshot({
          environment,
          resolved,
          symbolRules,
          ticker,
          orderbook,
          trades,
          fees,
          openXrocketUrl:
            environment === "mainnet" ? XROCKET_MAINNET_URL : XROCKET_TESTNET_URL,
          tradingSetupUrl: HOSTED_TRADING_URL,
        });
        return { value: snapshot, text: marketSnapshotText(snapshot) };
      }, success("xrocket_market_snapshot")),
  );

  server.registerTool(
    "xrocket_market_symbols",
    {
      title: "xRocket symbols",
      description: "List all exchange symbols or inspect one exact symbol and its trading constraints.",
      inputSchema: z.object({ symbol: symbolSchema.optional() }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ symbol }) =>
      run(
        async () => ({ environment, data: await client.getSymbols(symbol) }),
        success("xrocket_market_symbols"),
      ),
  );

  server.registerTool(
    "xrocket_market_tickers",
    {
      title: "xRocket 24h tickers",
      description: "Get public 24-hour ticker data, optionally for a repeated list of symbols.",
      inputSchema: z.object({ symbols: z.array(symbolSchema).min(1).max(100).optional() }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ symbols }) =>
      run(
        async () => ({ environment, data: await client.getTickers("24h", symbols) }),
        success("xrocket_market_tickers"),
      ),
  );

  server.registerTool(
    "xrocket_market_candles",
    {
      title: "xRocket candles",
      description: "Get public OHLCV candles for an exact ISO-8601 time window.",
      inputSchema: z.object({
        symbol: symbolSchema,
        type: intervalSchema,
        startAt: dateTimeSchema,
        endAt: dateTimeSchema,
      }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    (args) =>
      run(
        async () => ({ environment, data: await client.getCandles(args) }),
        success("xrocket_market_candles"),
      ),
  );

  server.registerTool(
    "xrocket_market_orderbook",
    {
      title: "xRocket order book",
      description: "Get a public order-book snapshot. Precision must be valid for the selected pair.",
      inputSchema: z.object({
        symbol: symbolSchema,
        depth: z
          .union([
            z.literal(5),
            z.literal(10),
            z.literal(20),
            z.literal(50),
            z.literal(100),
            z.literal(200),
            z.literal(500),
          ])
          .optional(),
        precision: decimalSchema.optional(),
      }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    (args) =>
      run(
        async () => ({ environment, data: await client.getOrderbook(args) }),
        success("xrocket_market_orderbook"),
      ),
  );

  server.registerTool(
    "xrocket_market_trades",
    {
      title: "xRocket recent trades",
      description: "Get recent public trades for one symbol.",
      inputSchema: z.object({ symbol: symbolSchema }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ symbol }) =>
      run(
        async () => ({ environment, data: await client.getTrades(symbol) }),
        success("xrocket_market_trades"),
      ),
  );

  server.registerTool(
    "xrocket_asset_info",
    {
      title: "xRocket assets",
      description: "List public assets or inspect one exact asset identifier.",
      inputSchema: z.object({ asset: assetSchema.optional() }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ asset }) =>
      run(
        async () => ({ environment, data: await client.getAssets(asset) }),
        success("xrocket_asset_info"),
      ),
  );

  server.registerTool(
    "xrocket_rates",
    {
      title: "xRocket rates",
      description: "Get public conversion rates from one base asset to optional target assets.",
      inputSchema: z.object({
        base: assetSchema,
        assets: z.array(assetSchema).min(1).max(100).optional(),
      }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ base, assets }) =>
      run(
        async () => ({ environment, data: await client.getRates(base, assets) }),
        success("xrocket_rates"),
      ),
  );

  server.registerTool(
    "xrocket_trade_fees",
    {
      title: "xRocket trade fees",
      description: "Get exchange trade-fee data, optionally for repeated symbols.",
      inputSchema: z.object({ symbols: z.array(symbolSchema).min(1).max(100).optional() }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ symbols }) =>
      run(
        async () => ({ environment, data: await client.getTradeFees(symbols) }),
        success("xrocket_trade_fees"),
      ),
  );

  server.registerTool(
    "xrocket_onboarding_links",
    {
      title: "Set up xRocket trading",
      description:
        "Return xRocket sign-in links, local MCP trading setup, the prepare/approve/execute flow, and canonical API documentation.",
      inputSchema: z.object({}),
      outputSchema: resultSchema,
      annotations: LOCAL_READ,
    },
    () =>
      run(
        () => ({
          environment,
          primary:
            environment === "mainnet"
              ? XROCKET_MAINNET_URL
              : XROCKET_TESTNET_URL,
          mainnet: XROCKET_MAINNET_URL,
          testnet: XROCKET_TESTNET_URL,
          documentation: XROCKET_API_DOCS_URL,
          tradingSetup: {
            hostedEndpointCanTrade: false,
            localSetupUrl: HOSTED_TRADING_URL,
            apiTokenMenu: "Menu > Settings > Exchange settings > API token",
            tokenHandling:
              "Sign in to xRocket and configure the broad account token only in the local MCP client's secret or environment settings. Never paste it into chat or send it to the hosted endpoint.",
            testnetCommand: `npx -y xrocket-mcp@${VERSION} trading-config`,
            mainnetCommand: `npx -y xrocket-mcp@${VERSION} trading-config --mainnet`,
            recommendedFirstPrompt:
              "On testnet, prepare a market buy of GRAM-USDT using 10 USDT. Show the estimate, fee, balances, rules, and exact intent. Do not execute until I explicitly approve.",
            orderFlow: [
              "prepare: estimate the order and return the exact intent plus a short-lived receipt",
              "approve: show the preview and obtain explicit user approval",
              "execute: submit only the prepared receipt once; never retry an unknown outcome",
            ],
          },
          depositNote:
            "The Exchange REST API has no documented deposit-address endpoint. Open the bot with the onboarding link and use the deposit UI. Account balance verification is available only through a separately configured local private-read profile; the hosted endpoint never accepts account tokens.",
        }),
        success("xrocket_onboarding_links"),
      ),
  );
}

export function createHostedPublicXrocketServer(
  fetchImpl?: FetchLike,
  onToolSuccess?: (toolName: PublicToolName) => void,
): McpServer {
  const config = hostedPublicConfig();
  const server = new McpServer(
    { name: "xrocket-mcp", version: VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "This hosted endpoint exposes only public xRocket mainnet market data. Use xrocket_market_snapshot for broad market questions and the narrow public tools for exact details. If the user wants to trade, call xrocket_onboarding_links and guide them to the local trading profile; do not imply this hosted endpoint can place an order. The local flow is prepare, show the exact estimate and intent, obtain explicit approval, then execute the receipt once. This endpoint never accepts account tokens and cannot expose balances, orders, transfers, withdrawals, prepare, or execute tools. Ask the user to sign in to xRocket when credentials are needed, and never ask them to paste a token into chat.",
    },
  );
  const client = new XrocketClient(config, fetchImpl);
  registerPublicXrocketTools(server, client, config.environment, onToolSuccess);
  return server;
}
