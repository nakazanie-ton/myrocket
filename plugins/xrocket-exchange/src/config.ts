export type XrocketProfile = "public" | "private-read" | "full";
export type XrocketEnvironment = "testnet" | "mainnet";

export const XROCKET_API_TOKEN_PLACEHOLDER = "SET_YOUR_XROCKET_API_TOKEN_LOCALLY";

export interface TradingPolicy {
  dailyLimit: string;
  limitAsset: string;
  maxDailyOrders: number;
  maxOpenOrders: number;
  symbols?: readonly string[];
}

export interface XrocketConfig {
  profile: XrocketProfile;
  environment: XrocketEnvironment;
  apiBaseUrl: string;
  apiToken?: string;
  enableTrading: boolean;
  enableTransfers: boolean;
  enableWithdrawals: boolean;
  allowMainnetWrites: boolean;
  tradingPolicy?: TradingPolicy;
  agentStatePath?: string;
  approvalTtlMs: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
}

export const API_BASE_URLS: Readonly<Record<XrocketEnvironment, string>> = {
  testnet: "https://exchange.api.testnet.xrocket.exchange",
  mainnet: "https://exchange.api.xrocket.exchange",
};

const PROFILE_VALUES = new Set<XrocketProfile>(["public", "private-read", "full"]);
const ENVIRONMENT_VALUES = new Set<XrocketEnvironment>(["testnet", "mainnet"]);

function enumValue<T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: ReadonlySet<T>,
  name: string,
): T {
  const parsed = (value ?? fallback) as T;
  if (!allowed.has(parsed)) {
    throw new Error(`${name} must be one of: ${[...allowed].join(", ")}`);
  }
  return parsed;
}

function booleanValue(value: string | undefined, name: string): boolean {
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be exactly "true" or "false"`);
}

function ttlValue(value: string | undefined): number {
  if (value === undefined || value === "") return 300_000;
  if (!/^\d+$/.test(value)) {
    throw new Error("XROCKET_APPROVAL_TTL_MS must be an integer in milliseconds");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 900_000) {
    throw new Error("XROCKET_APPROVAL_TTL_MS must be between 1000 and 900000");
  }
  return parsed;
}

function positiveIntegerValue(
  value: string | undefined,
  fallback: number,
  name: string,
  maximum: number,
): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be between 1 and ${maximum}`);
  }
  return parsed;
}

function tradingPolicy(env: NodeJS.ProcessEnv): TradingPolicy | undefined {
  const rawLimit = env.XROCKET_TRADING_LIMIT?.trim();
  if (!rawLimit) return undefined;
  if (rawLimit.length > 150) {
    throw new Error("XROCKET_TRADING_LIMIT must look like 100 USD or 2.5 TONCOIN");
  }
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?(?:\s+([A-Za-z0-9]{2,16}))?$/.exec(rawLimit);
  if (!match || !/[1-9]/.test(rawLimit.split(/\s+/)[0] ?? "")) {
    throw new Error("XROCKET_TRADING_LIMIT must look like 100 USD or 2.5 TONCOIN");
  }
  const amount = match[1] + (match[2] ? `.${match[2]}` : "");
  const limitAsset = (match[3] ?? "USD").toUpperCase();
  const rawSymbols = env.XROCKET_TRADING_SYMBOLS?.trim();
  const symbols = rawSymbols
    ? [...new Set(rawSymbols.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))]
    : undefined;
  if (symbols?.some((symbol) => !/^[A-Z0-9_-]{3,64}$/.test(symbol))) {
    throw new Error("XROCKET_TRADING_SYMBOLS must be a comma-separated list of exact symbols");
  }
  return {
    dailyLimit: amount,
    limitAsset,
    maxDailyOrders: positiveIntegerValue(
      env.XROCKET_MAX_DAILY_ORDERS,
      100,
      "XROCKET_MAX_DAILY_ORDERS",
      10_000,
    ),
    maxOpenOrders: positiveIntegerValue(
      env.XROCKET_MAX_OPEN_ORDERS,
      20,
      "XROCKET_MAX_OPEN_ORDERS",
      1_000,
    ),
    ...(symbols && symbols.length > 0 ? { symbols } : {}),
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): XrocketConfig {
  const apiToken = env.XROCKET_API_TOKEN?.trim();
  if (apiToken === XROCKET_API_TOKEN_PLACEHOLDER) {
    throw new Error(
      "Sign in to xRocket, open Menu > Settings > Exchange settings > API token, then replace XROCKET_API_TOKEN in your local MCP configuration. Never paste the token into chat or the hosted endpoint.",
    );
  }
  const profile = enumValue(
    env.XROCKET_PROFILE,
    apiToken ? "private-read" : "public",
    PROFILE_VALUES,
    "XROCKET_PROFILE",
  );
  const environment = enumValue(
    env.XROCKET_ENVIRONMENT,
    "mainnet",
    ENVIRONMENT_VALUES,
    "XROCKET_ENVIRONMENT",
  );

  if (profile !== "public" && !apiToken) {
    throw new Error(
      `XROCKET_API_TOKEN is required for profile ${profile}. Sign in to xRocket, open Menu > Settings > Exchange settings > API token, and configure it locally.`,
    );
  }

  const enableTrading = booleanValue(env.XROCKET_ENABLE_TRADING, "XROCKET_ENABLE_TRADING");
  const policy = tradingPolicy(env);
  if (enableTrading && !policy) {
    throw new Error(
      "XROCKET_TRADING_LIMIT is required when autonomous trading is enabled, for example 100 USD",
    );
  }

  return {
    profile,
    environment,
    apiBaseUrl: API_BASE_URLS[environment],
    ...(apiToken ? { apiToken } : {}),
    enableTrading,
    enableTransfers: booleanValue(env.XROCKET_ENABLE_TRANSFERS, "XROCKET_ENABLE_TRANSFERS"),
    enableWithdrawals: booleanValue(env.XROCKET_ENABLE_WITHDRAWALS, "XROCKET_ENABLE_WITHDRAWALS"),
    allowMainnetWrites: booleanValue(
      env.XROCKET_ALLOW_MAINNET_WRITES,
      "XROCKET_ALLOW_MAINNET_WRITES",
    ),
    ...(policy ? { tradingPolicy: policy } : {}),
    ...(env.XROCKET_AGENT_STATE_PATH?.trim()
      ? { agentStatePath: env.XROCKET_AGENT_STATE_PATH.trim() }
      : {}),
    approvalTtlMs: ttlValue(env.XROCKET_APPROVAL_TTL_MS),
    requestTimeoutMs: 15_000,
    maxResponseBytes: 2_000_000,
  };
}

export function assertWriteAllowed(
  config: XrocketConfig,
  capability: "trading" | "transfers" | "withdrawals",
): void {
  const enabled = {
    trading: config.enableTrading,
    transfers: config.enableTransfers,
    withdrawals: config.enableWithdrawals,
  }[capability];

  if (!enabled) {
    const variable = {
      trading: "XROCKET_ENABLE_TRADING",
      transfers: "XROCKET_ENABLE_TRANSFERS",
      withdrawals: "XROCKET_ENABLE_WITHDRAWALS",
    }[capability];
    throw new Error(`${capability} writes are disabled; set ${variable}=true explicitly`);
  }
  if (config.environment === "mainnet" && !config.allowMainnetWrites) {
    throw new Error(
      "mainnet writes are disabled; set XROCKET_ALLOW_MAINNET_WRITES=true in addition to the capability gate",
    );
  }
}
