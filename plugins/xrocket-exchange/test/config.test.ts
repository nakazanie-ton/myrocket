import { describe, expect, it } from "vitest";
import {
  assertWriteAllowed,
  loadConfig,
  XROCKET_API_TOKEN_PLACEHOLDER,
} from "../src/config.js";

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

  it("stops on the generated token placeholder with sign-in guidance", () => {
    expect(() =>
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: XROCKET_API_TOKEN_PLACEHOLDER,
      }),
    ).toThrow("Sign in to xRocket");
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
      XROCKET_TRADING_LIMIT: "100 USD",
    });
    expect(() => assertWriteAllowed(config, "trading")).toThrow("mainnet writes are disabled");
    config.allowMainnetWrites = true;
    expect(() => assertWriteAllowed(config, "trading")).not.toThrow();
    expect(() => assertWriteAllowed(config, "withdrawals")).toThrow("withdrawals writes are disabled");
  });

  it("parses one simple daily trading limit and defaults to all markets", () => {
    const config = loadConfig({
      XROCKET_PROFILE: "full",
      XROCKET_API_TOKEN: "secret",
      XROCKET_ENABLE_TRADING: "true",
      XROCKET_TRADING_LIMIT: "2.5 toncoin",
    });
    expect(config.tradingPolicy).toEqual({
      dailyLimit: "2.5",
      limitAsset: "TONCOIN",
      maxDailyOrders: 100,
      maxOpenOrders: 20,
    });
    expect(() =>
      loadConfig({
        XROCKET_PROFILE: "full",
        XROCKET_API_TOKEN: "secret",
        XROCKET_ENABLE_TRADING: "true",
      }),
    ).toThrow("XROCKET_TRADING_LIMIT is required");
  });
});
