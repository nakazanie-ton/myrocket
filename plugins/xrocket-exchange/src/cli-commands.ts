import { loadConfig, type XrocketConfig } from "./config.js";
import { XrocketClient, type FetchLike } from "./client.js";
import { XrocketHttpError } from "./errors.js";
import { VERSION } from "./version.js";

export type CliCommand = "serve" | "doctor" | "config" | "help" | "version";

export function parseCliCommand(args: readonly string[]): CliCommand {
  if (args.length === 0 || (args.length === 1 && args[0] === "serve")) return "serve";
  if (args.length === 1 && args[0] === "doctor") return "doctor";
  if (args.length === 1 && args[0] === "config") return "config";
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
    "  xrocket-mcp doctor       Check configuration and public API connectivity",
    "  xrocket-mcp config       Print a safe copy-paste MCP client configuration",
    "  xrocket-mcp --version    Print the version",
    "",
    "Defaults: public mainnet reads; every financial write gate is disabled.",
    "With XROCKET_PROFILE omitted, setting XROCKET_API_TOKEN locally enables private reads. Never paste a token into a prompt.",
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
