import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

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
          XROCKET_ENVIRONMENT: "testnet",
          XROCKET_ENABLE_TRADING: "false",
          XROCKET_ENABLE_TRANSFERS: "false",
          XROCKET_ENABLE_WITHDRAWALS: "false",
          XROCKET_ALLOW_MAINNET_WRITES: "false",
        },
        stderr: "pipe",
      },
);
const client = new Client({ name: "xrocket-stdio-smoke", version: "0.1.1" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  if (tools.tools.length !== 9 || tools.tools.some((tool) => tool.name.includes("execute"))) {
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
