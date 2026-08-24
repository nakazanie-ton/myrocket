import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const publicToolNames = [
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

const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry) => typeof entry[1] === "string"),
);
const dockerImage = process.env.XROCKET_SMOKE_DOCKER_IMAGE;
const transport = new StdioClientTransport(
  dockerImage
    ? {
        command: "docker",
        args: ["run", "--rm", "-i", dockerImage],
        env: inheritedEnvironment,
        stderr: "pipe",
      }
    : {
        command: process.execPath,
        args: ["dist/cli.js"],
        env: {
          ...inheritedEnvironment,
          XROCKET_PROFILE: "public",
          XROCKET_ENVIRONMENT: "mainnet",
          XROCKET_ENABLE_TRADING: "false",
          XROCKET_ENABLE_TRANSFERS: "false",
          XROCKET_ENABLE_WITHDRAWALS: "false",
          XROCKET_ALLOW_MAINNET_WRITES: "false",
        },
        stderr: "pipe",
      },
);
const client = new Client({ name: "xrocket-stdio-smoke", version: "0.5.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const actualToolNames = tools.tools.map((tool) => tool.name).sort();
  if (JSON.stringify(actualToolNames) !== JSON.stringify(publicToolNames)) {
    throw new Error(`unexpected public tool catalog: ${tools.tools.map((tool) => tool.name).join(", ")}`);
  }
  const onboarding = await client.callTool({ name: "xrocket_onboarding_links", arguments: {} });
  const content = onboarding.content?.[0];
  if (content?.type !== "text" || !content.text.includes("start=kaban")) {
    throw new Error("onboarding smoke response did not include the configured xRocket link");
  }
} finally {
  await client.close();
}
