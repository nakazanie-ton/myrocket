import {
  loadConfig,
  XROCKET_API_TOKEN_PLACEHOLDER,
  type XrocketConfig,
  type XrocketEnvironment,
} from "./config.js";
import { XrocketClient, type FetchLike } from "./client.js";
import { XrocketHttpError } from "./errors.js";
import { VERSION } from "./version.js";

export type CliCommand =
  | "serve"
  | "serve-http"
  | "doctor"
  | "config"
  | "trading-config-testnet"
  | "trading-config-mainnet"
  | "help"
  | "version";

export interface TradingConfigOptions {
  environment: XrocketEnvironment;
  limit: string;
  limitAsset: string;
}

export function parseTradingConfigOptions(args: readonly string[]): TradingConfigOptions {
  if (args[0] !== "trading-config") throw new Error("Expected trading-config command");
  let environment: XrocketEnvironment = "testnet";
  let limit = "100";
  let limitAsset = "USD";
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--mainnet") {
      environment = "mainnet";
      continue;
    }
    if (argument === "--limit" || argument === "--asset") {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--limit") {
        if (value.length > 128 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || !/[1-9]/.test(value)) {
          throw new Error("--limit must be a positive decimal value");
        }
        limit = value;
      } else {
        if (!/^[A-Za-z0-9]{2,16}$/.test(value)) {
          throw new Error("--asset must be a 2-16 character asset or fiat code");
        }
        limitAsset = value.toUpperCase();
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown trading-config option: ${argument}`);
  }
  return { environment, limit, limitAsset };
}

export function parseCliCommand(args: readonly string[]): CliCommand {
  if (args.length === 0 || (args.length === 1 && args[0] === "serve")) return "serve";
  if (args.length === 1 && args[0] === "serve-http") return "serve-http";
  if (args.length === 1 && args[0] === "doctor") return "doctor";
  if (args.length === 1 && args[0] === "config") return "config";
  if (args[0] === "trading-config") {
    const options = parseTradingConfigOptions(args);
    return options.environment === "mainnet"
      ? "trading-config-mainnet"
      : "trading-config-testnet";
  }
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return "help";
  }
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) return "version";
  throw new Error(`Unknown command: ${args.join(" ")}. Run xrocket-mcp --help.`);
}

export function helpText(): string {
  return [
    `xrocket-mcp ${VERSION}`,
    "",
    "Usage:",
    "  xrocket-mcp              Start the MCP stdio server",
    "  xrocket-mcp serve        Start the MCP stdio server",
    "  xrocket-mcp serve-http   Start the hard public-only Streamable HTTP server",
    "  xrocket-mcp doctor       Check configuration and public API connectivity",
    "  xrocket-mcp config       Print a safe copy-paste MCP client configuration",
    "  xrocket-mcp trading-config [--limit 100] [--asset USD] [--mainnet]",
    "                                      Print an autonomous trading configuration",
    "  xrocket-mcp --version    Print the version",
    "",
    "Defaults: public mainnet reads; every financial write gate is disabled.",
    "serve-http always exposes only public mainnet tools and never reads account or write settings.",
    "With XROCKET_PROFILE omitted, setting XROCKET_API_TOKEN locally enables private reads. Never paste a token into a prompt.",
    "Trading config lets the agent trade any market inside one daily value limit.",
    "Transfers and withdrawals stay disabled and keep explicit approval. Testnet is the default.",
  ].join("\n");
}

export function renderMcpConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        xrocket: {
          command: "npx",
          args: ["-y", `xrocket-mcp@${VERSION}`],
          env: {
            XROCKET_ENVIRONMENT: "mainnet",
            XROCKET_ENABLE_TRADING: "false",
            XROCKET_ENABLE_TRANSFERS: "false",
            XROCKET_ENABLE_WITHDRAWALS: "false",
            XROCKET_ALLOW_MAINNET_WRITES: "false",
          },
        },
      },
    },
    null,
    2,
  );
}

export function renderTradingMcpConfig(
  environment: XrocketEnvironment = "testnet",
  limit = "100",
  limitAsset = "USD",
): string {
  return JSON.stringify(
    {
      mcpServers: {
        xrocket: {
          command: "npx",
          args: ["-y", `xrocket-mcp@${VERSION}`],
          env: {
            XROCKET_PROFILE: "full",
            XROCKET_ENVIRONMENT: environment,
            XROCKET_API_TOKEN: XROCKET_API_TOKEN_PLACEHOLDER,
            XROCKET_ENABLE_TRADING: "true",
            XROCKET_TRADING_LIMIT: `${limit} ${limitAsset}`,
            XROCKET_ENABLE_TRANSFERS: "false",
            XROCKET_ENABLE_WITHDRAWALS: "false",
            XROCKET_ALLOW_MAINNET_WRITES: environment === "mainnet" ? "true" : "false",
          },
        },
      },
    },
    null,
    2,
  );
}

function countSymbols(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object" && "symbols" in value) {
    const symbols = (value as { symbols?: unknown }).symbols;
    return Array.isArray(symbols) ? symbols.length : undefined;
  }
  return undefined;
}

export interface DoctorReport {
  version: string;
  status: "ok";
  profile: XrocketConfig["profile"];
  environment: XrocketConfig["environment"];
  apiBaseUrl: string;
  tokenConfigured: boolean;
  credentialsVerified: boolean | null;
  writesEnabled: boolean;
  health: unknown;
  symbolCount?: number;
}

export async function runDoctor(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<DoctorReport> {
  const config = loadConfig(env);
  const client = new XrocketClient(config, fetchImpl);
  const [health, symbols] = await Promise.all([client.getHealth(), client.getSymbols()]);
  let credentialsVerified: boolean | null = null;
  if (config.profile !== "public") {
    try {
      await client.getBalances("trading");
      credentialsVerified = true;
    } catch (error) {
      if (error instanceof XrocketHttpError && (error.status === 401 || error.status === 403)) {
        throw new Error(
          "xRocket account access was rejected. Sign in to xRocket and configure a valid API token locally; never paste the token into chat.",
        );
      }
      throw error;
    }
  }
  const symbolCount = countSymbols(symbols);
  return {
    version: VERSION,
    status: "ok",
    profile: config.profile,
    environment: config.environment,
    apiBaseUrl: config.apiBaseUrl,
    tokenConfigured: Boolean(config.apiToken),
    credentialsVerified,
    writesEnabled:
      config.profile === "full" &&
      (config.enableTrading || config.enableTransfers || config.enableWithdrawals) &&
      (config.environment !== "mainnet" || config.allowMainnetWrites),
    health,
    ...(symbolCount === undefined ? {} : { symbolCount }),
  };
}

export function doctorText(report: DoctorReport): string {
  return [
    `xrocket-mcp ${report.version}: OK`,
    `API: ${report.apiBaseUrl}`,
    `Profile: ${report.profile}`,
    `Environment: ${report.environment}`,
    `Token configured: ${report.tokenConfigured ? "yes" : "no"}`,
    `Account access: ${report.credentialsVerified === null ? "not requested" : "verified"}`,
    `Financial writes enabled: ${report.writesEnabled ? "yes" : "no"}`,
    `Markets discovered: ${report.symbolCount ?? "unknown"}`,
  ].join("\n");
}
