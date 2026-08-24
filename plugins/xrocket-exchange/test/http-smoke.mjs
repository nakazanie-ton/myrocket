import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = new URL(process.env.XROCKET_MCP_HTTP_URL ?? "http://127.0.0.1:3000/mcp");
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
const healthUrl = new URL("/health", endpoint);
const health = await fetch(healthUrl);
if (!health.ok) throw new Error(`hosted health check failed with HTTP ${health.status}`);
const healthBody = await health.json();
if (
  healthBody.profile !== "public" ||
  healthBody.environment !== "mainnet" ||
  healthBody.transport !== "streamable-http"
) {
  throw new Error(`unsafe or unexpected hosted health response: ${JSON.stringify(healthBody)}`);
}

const landingUrl = new URL("/", endpoint);
const landing = await fetch(landingUrl);
const landingText = await landing.text();
if (
  !landing.ok ||
  !landingText.includes("Trade xRocket from your AI") ||
  !landingText.includes("trading-config --mainnet")
) {
  throw new Error(`hosted landing-page smoke failed with HTTP ${landing.status}`);
}
if (!landing.headers.get("content-security-policy")?.includes("default-src 'none'")) {
  throw new Error("hosted landing page is missing its restrictive content security policy");
}
const open = await fetch(new URL("/open", endpoint), { redirect: "manual" });
if (open.status !== 302 || !open.headers.get("location")?.includes("t.me/xRocket")) {
  throw new Error("hosted Open xRocket action does not redirect to the configured destination");
}

const client = new Client({ name: "xrocket-http-smoke", version: "0.5.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  const tools = await client.listTools();
  const actualToolNames = tools.tools.map((tool) => tool.name).sort();
  if (JSON.stringify(actualToolNames) !== JSON.stringify(publicToolNames)) {
    throw new Error(`unexpected hosted tool catalog: ${tools.tools.map((tool) => tool.name).join(", ")}`);
  }
  const onboarding = await client.callTool({ name: "xrocket_onboarding_links", arguments: {} });
  const content = onboarding.content?.[0];
  if (content?.type !== "text" || !content.text.includes("start=kaban")) {
    throw new Error("hosted onboarding response did not include the configured xRocket link");
  }
  if (process.env.XROCKET_SMOKE_LIVE === "true") {
    const snapshot = await client.callTool({
      name: "xrocket_market_snapshot",
      arguments: { market: "GRAM" },
    });
    if (snapshot.isError || !JSON.stringify(snapshot.structuredContent).includes("GRAM-USDT")) {
      throw new Error(`live hosted market snapshot failed: ${JSON.stringify(snapshot)}`);
    }
  }
} finally {
  await client.close();
}
