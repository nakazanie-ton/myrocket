import { describe, expect, it } from "vitest";
import { assertWriteAllowed, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("defaults to useful public mainnet reads with every write gate disabled", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      profile: "public",
      environment: "mainnet",
      apiBaseUrl: "https://exchange.api.xrocket.exchange",
      enableTrading: false,
      enableTransfers: false,
      enableWithdrawals: false,
      allowMainnetWrites: false,
      approvalTtlMs: 300_000,
    });
    expect(config).not.toHaveProperty("apiToken");
  });

  it("infers private-read when a token is present but respects an explicit public profile", () => {
    expect(loadConfig({ XROCKET_API_TOKEN: "secret" }).profile).toBe("private-read");
    expect(loadConfig({ XROCKET_API_TOKEN: "secret", XROCKET_PROFILE: "public" }).profile).toBe(
      "public",
    );
  });

  it("requires a token for every non-public profile", () => {
    expect(() => loadConfig({ XROCKET_PROFILE: "private-read" })).toThrow(
      "XROCKET_API_TOKEN is required",
    );
    expect(() => loadConfig({ XROCKET_PROFILE: "full" })).toThrow(
      "XROCKET_API_TOKEN is required",
    );
  });

  it("rejects permissive or misspelled boolean values", () => {
    expect(() => loadConfig({ XROCKET_ENABLE_TRADING: "1" })).toThrow(
      'must be exactly "true" or "false"',
    );
    expect(() => loadConfig({ XROCKET_ALLOW_MAINNET_WRITES: "TRUE" })).toThrow();
  });

  it("requires both the capability and separate mainnet write gates", () => {
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "secret",
      XROCKET_ENVIRONMENT: "mainnet",
      XROCKET_ENABLE_TRADING: "true",
    });
    expect(() => assertWriteAllowed(config, "trading")).toThrow("mainnet writes are disabled");
    config.allowMainnetWrites = true;
    expect(() => assertWriteAllowed(config, "trading")).not.toThrow();
    expect(() => assertWriteAllowed(config, "withdrawals")).toThrow("withdrawals writes are disabled");
  });
});
