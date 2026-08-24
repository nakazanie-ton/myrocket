import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (relativePath: string) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;

describe("Cursor plugin metadata", () => {
  it("points the plugin at the public hosted MCP endpoint", () => {
    const config = readJson("../mcp.json") as {
      mcpServers: { xrocket: { url: string } };
    };

    expect(config.mcpServers.xrocket.url).toBe(
      "https://xrocket-mcp-production.up.railway.app/mcp",
    );
  });

  it("keeps the plugin and marketplace entries aligned", () => {
    const plugin = readJson("../.cursor-plugin/plugin.json") as { name: string; version: string };
    const marketplace = readJson("../../../.cursor-plugin/marketplace.json") as {
      plugins: Array<{ name: string; source: string }>;
    };

    expect(plugin).toMatchObject({ name: "xrocket-exchange", version: "0.5.0" });
    expect(marketplace.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "xrocket-exchange",
          source: "plugins/xrocket-exchange",
        }),
      ]),
    );
  });
});
