import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (relativePath: string) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;

describe("portable Agent Plugin metadata", () => {
  it("keeps the public plugin identity and version aligned", () => {
    const plugin = readJson("../plugin.json") as {
      $schema: string;
      name: string;
      version: string;
      author: { name: string };
    };

    expect(plugin).toMatchObject({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "xrocket-exchange",
      version: "0.6.0",
      author: { name: "corefather" },
    });
    expect(existsSync(new URL("../skills/xrocket-exchange/SKILL.md", import.meta.url))).toBe(
      true,
    );
  });

  it("uses the public publisher name in the portable, Codex, and npm manifests", () => {
    const portable = readJson("../plugin.json") as { author: { name: string } };
    const codex = readJson("../.codex-plugin/plugin.json") as {
      author: { name: string };
      interface: { developerName: string };
    };
    const packageJson = readJson("../package.json") as { author: string };

    expect(portable.author.name).toBe("corefather");
    expect(codex.author.name).toBe("corefather");
    expect(codex.interface.developerName).toBe("corefather");
    expect(packageJson.author).toBe("corefather");
  });

  it("connects portable hosts to the public-only endpoint", () => {
    const config = readJson("../mcp.json") as {
      $schema: string;
      mcpServers: {
        xrocket: { type: string; url: string };
      };
    };

    expect(config).toMatchObject({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        xrocket: {
          type: "streamable-http",
          url: "https://xrocket-mcp-production.up.railway.app/mcp",
        },
      },
    });
  });
});
