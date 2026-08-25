import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (relativePath: string) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;

describe("Claude Code plugin metadata", () => {
  it("keeps the plugin and marketplace entries aligned", () => {
    const plugin = readJson("../.claude-plugin/plugin.json") as {
      name: string;
      version: string;
      author: { name: string };
      mcpServers: string;
    };
    const marketplace = readJson("../../../.claude-plugin/marketplace.json") as {
      owner: { name: string };
      plugins: Array<{ name: string; source: string; version: string }>;
    };

    expect(plugin).toMatchObject({
      name: "xrocket-exchange",
      version: "0.6.0",
      author: { name: "corefather" },
      mcpServers: "./.claude-mcp.json",
    });
    expect(marketplace.owner.name).toBe("corefather");
    expect(marketplace.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "xrocket-exchange",
          source: "./plugins/xrocket-exchange",
          version: "0.6.0",
        }),
      ]),
    );
  });

  it("starts Claude Code with public-only MCP defaults", () => {
    const config = readJson("../.claude-mcp.json") as {
      mcpServers: {
        xrocket: {
          args: string[];
          env: Record<string, string>;
        };
      };
    };

    expect(config.mcpServers.xrocket.args).toEqual([
      "${CLAUDE_PLUGIN_ROOT}/dist/cli.js",
    ]);
    expect(config.mcpServers.xrocket.env).toMatchObject({
      XROCKET_PROFILE: "public",
      XROCKET_ENABLE_TRADING: "false",
      XROCKET_ENABLE_TRANSFERS: "false",
      XROCKET_ENABLE_WITHDRAWALS: "false",
      XROCKET_ALLOW_MAINNET_WRITES: "false",
    });
    expect(existsSync(new URL("../skills/xrocket-exchange/SKILL.md", import.meta.url))).toBe(
      true,
    );
  });
});
