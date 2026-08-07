export type XrocketProfile = "public" | "private-read" | "full";
export type XrocketEnvironment = "testnet" | "mainnet";

export interface XrocketConfig {
  profile: XrocketProfile;
  environment: XrocketEnvironment;
  apiBaseUrl: string;
  apiToken?: string;
  enableTrading: boolean;
  enableTransfers: boolean;
  enableWithdrawals: boolean;
  allowMainnetWrites: boolean;
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): XrocketConfig {
  const profile = enumValue(env.XROCKET_PROFILE, "public", PROFILE_VALUES, "XROCKET_PROFILE");
  const environment = enumValue(
    env.XROCKET_ENVIRONMENT,
    "testnet",
    ENVIRONMENT_VALUES,
    "XROCKET_ENVIRONMENT",
  );
  const apiToken = env.XROCKET_API_TOKEN?.trim();

  if (profile !== "public" && !apiToken) {
    throw new Error(`XROCKET_API_TOKEN is required for profile ${profile}`);
  }

  return {
    profile,
    environment,
    apiBaseUrl: API_BASE_URLS[environment],
    ...(apiToken ? { apiToken } : {}),
    enableTrading: booleanValue(env.XROCKET_ENABLE_TRADING, "XROCKET_ENABLE_TRADING"),
    enableTransfers: booleanValue(env.XROCKET_ENABLE_TRANSFERS, "XROCKET_ENABLE_TRANSFERS"),
    enableWithdrawals: booleanValue(env.XROCKET_ENABLE_WITHDRAWALS, "XROCKET_ENABLE_WITHDRAWALS"),
    allowMainnetWrites: booleanValue(
      env.XROCKET_ALLOW_MAINNET_WRITES,
      "XROCKET_ALLOW_MAINNET_WRITES",
    ),
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
