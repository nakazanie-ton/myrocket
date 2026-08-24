import { describe, expect, it, vi } from "vitest";
import {
  doctorText,
  parseCliCommand,
  renderMcpConfig,
  runDoctor,
} from "../src/cli-commands.js";
import type { FetchLike } from "../src/client.js";

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

describe("CLI commands", () => {
  it("keeps empty invocation and serve in stdio mode", () => {
    expect(parseCliCommand([])).toBe("serve");
    expect(parseCliCommand(["serve"])).toBe("serve");
    expect(parseCliCommand(["doctor"])).toBe("doctor");
    expect(() => parseCliCommand(["wat"])).toThrow("Unknown command");
  });

  it("prints a pinned safe mainnet read-only MCP configuration", () => {
    const config = JSON.parse(renderMcpConfig()) as {
      mcpServers: { xrocket: { args: string[]; env: Record<string, string> } };
    };
    expect(config.mcpServers.xrocket.args).toEqual(["-y", "xrocket-mcp@0.4.0"]);
    expect(config.mcpServers.xrocket.env).not.toHaveProperty("XROCKET_PROFILE");
    expect(config.mcpServers.xrocket.env).toMatchObject({
      XROCKET_ENVIRONMENT: "mainnet",
      XROCKET_ENABLE_TRADING: "false",
      XROCKET_ENABLE_TRANSFERS: "false",
      XROCKET_ENABLE_WITHDRAWALS: "false",
      XROCKET_ALLOW_MAINNET_WRITES: "false",
    });
  });

  it("diagnoses connectivity without exposing the token", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/health") return json({ ok: true });
      if (path === "/api/v1/symbols") return json({ symbols: [{ symbol: "GRAM-USDT" }] });
      if (path === "/api/v1/accounts/trading/balances") return json({ balances: [] });
      throw new Error(`unexpected ${path}`);
    });
    const report = await runDoctor({ XROCKET_API_TOKEN: "never-print-me" }, fetchMock);
    expect(report).toMatchObject({
      status: "ok",
      profile: "private-read",
      environment: "mainnet",
      tokenConfigured: true,
      credentialsVerified: true,
      writesEnabled: false,
      symbolCount: 1,
    });
    expect(JSON.stringify(report)).not.toContain("never-print-me");
    expect(doctorText(report)).not.toContain("never-print-me");
    const privateRequest = fetchMock.mock.calls.find(
      ([input]) => new URL(String(input)).pathname === "/api/v1/accounts/trading/balances",
    );
    expect(new Headers(privateRequest?.[1]?.headers).get("authorization")).toBe(
      "Bearer never-print-me",
    );
  });

  it("rejects invalid credentials with local sign-in guidance", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/health") return json({ ok: true });
      if (path === "/api/v1/symbols") return json({ symbols: [] });
      if (path === "/api/v1/accounts/trading/balances") {
        return new Response(JSON.stringify({ message: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected ${path}`);
    });
    await expect(runDoctor({ XROCKET_API_TOKEN: "invalid" }, fetchMock)).rejects.toThrow(
      "Sign in to xRocket and configure a valid API token locally",
    );
  });
});
