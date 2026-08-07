import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { XrocketClient, type FetchLike } from "../src/client.js";
import { UnknownWriteOutcomeError } from "../src/errors.js";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("XrocketClient", () => {
  it("uses only the selected official base, ISO candle strings, and no auth on public reads", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(json({ ok: true }));
    const client = new XrocketClient(loadConfig({}), fetchMock);
    await client.getCandles({
      symbol: "TON-USDT",
      type: "1min",
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-08-01T01:00:00.000Z",
    });

    const [input, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin).toBe("https://exchange.api.testnet.xrocket.exchange");
    expect(url.pathname).toBe("/api/v1/candles");
    expect(url.searchParams.get("startAt")).toBe("2026-08-01T00:00:00.000Z");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(init?.redirect).toBe("error");
  });

  it("encodes repeated symbols and sends the environment token only to private methods", async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async () => json([]));
    const config = loadConfig({ XROCKET_PROFILE: "private-read", XROCKET_API_TOKEN: "token-123" });
    const client = new XrocketClient(config, fetchMock);
    await client.getTradeFees(["TON-USDT", "BTC-USDT"]);
    await client.getBalances("funding");

    const publicUrl = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(publicUrl.searchParams.getAll("symbols")).toEqual(["TON-USDT", "BTC-USDT"]);
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).has("authorization")).toBe(false);
    expect(new Headers(fetchMock.mock.calls[1]![1]?.headers).get("authorization")).toBe(
      "Bearer token-123",
    );
  });

  it("cannot escape the official origin through a path identifier", async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async () => json({}));
    const client = new XrocketClient(loadConfig({}), fetchMock);
    await client.getAssets("https://evil.example/steal");
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.origin).toBe("https://exchange.api.testnet.xrocket.exchange");
    expect(url.pathname).toContain("https%3A%2F%2Fevil.example%2Fsteal");
  });

  it("redacts the configured token if an upstream error body echoes it", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(json({ authorization: "token-123", message: "token-123" }, 400));
    const config = loadConfig({ XROCKET_PROFILE: "private-read", XROCKET_API_TOKEN: "token-123" });
    const client = new XrocketClient(config, fetchMock);
    await expect(client.getBalances("funding")).rejects.toMatchObject({
      details: { authorization: "[REDACTED]", message: "[REDACTED]" },
    });
  });

  it("redacts withdrawal fields embedded in a non-JSON upstream error", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      new Response("Invalid address EQCprivate with private comment", { status: 400 }),
    );
    const client = new XrocketClient(
      loadConfig({ XROCKET_PROFILE: "full", XROCKET_API_TOKEN: "token" }),
      fetchMock,
    );

    await expect(
      client.createWithdrawal({
        clientWithdrawalId: "withdrawal-redaction",
        network: "TON",
        asset: "USDT",
        address: "EQCprivate",
        amount: "1",
        comment: "private comment",
      }),
    ).rejects.toMatchObject({
      status: 400,
      details: "Invalid address [REDACTED] with [REDACTED]",
    });
  });

  it("does not corrupt a successful JSON response for a one-character comment", async () => {
    const response = { withdrawalId: "abc-123", status: "active", count: 1, accepted: true };
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(json(response));
    const client = new XrocketClient(
      loadConfig({ XROCKET_PROFILE: "full", XROCKET_API_TOKEN: "token" }),
      fetchMock,
    );

    await expect(
      client.createWithdrawal({
        clientWithdrawalId: "withdrawal-short-comment",
        network: "TON",
        asset: "USDT",
        address: "EQCprivate",
        amount: "1",
        comment: "a",
      }),
    ).resolves.toEqual(response);
  });

  it("does not retry a network-ambiguous write", async () => {
    const fetchMock = vi.fn<FetchLike>().mockRejectedValue(new TypeError("socket closed"));
    const config = loadConfig({ XROCKET_PROFILE: "full", XROCKET_API_TOKEN: "token" });
    const client = new XrocketClient(config, fetchMock);

    await expect(
      client.placeOrder({
        clientOrderId: "order-1",
        symbol: "TON-USDT",
        side: "buy",
        type: "market",
        funds: "1.00",
        timeInForce: "IOC",
      }),
    ).rejects.toMatchObject({
      name: "UnknownWriteOutcomeError",
      clientId: "order-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats timeout, conflict, rate-limit, and 5xx writes as ambiguous but validation as definitive", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(json({ message: "gateway timeout" }, 408))
      .mockResolvedValueOnce(json({ message: "duplicate client id" }, 409))
      .mockResolvedValueOnce(json({ message: "rate limited" }, 429))
      .mockResolvedValueOnce(json({ message: "upstream timeout" }, 503))
      .mockResolvedValueOnce(json({ message: "invalid" }, 400));
    const config = loadConfig({ XROCKET_PROFILE: "full", XROCKET_API_TOKEN: "token" });
    const client = new XrocketClient(config, fetchMock);
    const transfer = {
      clientTransferId: "transfer-1",
      asset: "USDT",
      amount: "1",
      from: "funding",
      to: "trading",
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(client.createTransfer(transfer)).rejects.toBeInstanceOf(
        UnknownWriteOutcomeError,
      );
    }
    await expect(client.createTransfer(transfer)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("keeps an oversized ambiguous write response fail-closed and cancels its body", async () => {
    let canceled = false;
    const body = new ReadableStream({
      cancel() {
        canceled = true;
      },
    });
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      new Response(body, {
        status: 503,
        headers: { "content-length": "1024" },
      }),
    );
    const config = {
      ...loadConfig({ XROCKET_PROFILE: "full", XROCKET_API_TOKEN: "token" }),
      maxResponseBytes: 64,
    };
    const client = new XrocketClient(config, fetchMock);

    await expect(
      client.createTransfer({
        clientTransferId: "oversized-transfer",
        asset: "USDT",
        amount: "1",
        from: "funding",
        to: "trading",
      }),
    ).rejects.toMatchObject({
      name: "UnknownWriteOutcomeError",
      clientId: "oversized-transfer",
    });
    expect(canceled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses upstream orderId precedence in ambiguous cancellation metadata", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(json({ message: "timeout" }, 503));
    const client = new XrocketClient(
      loadConfig({ XROCKET_PROFILE: "full", XROCKET_API_TOKEN: "token" }),
      fetchMock,
    );

    await expect(
      client.cancelOrder({ orderId: "server-order-42", clientOrderId: "client-order-42" }),
    ).rejects.toMatchObject({
      name: "UnknownWriteOutcomeError",
      clientId: "server-order-42",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops reading a chunked response once the byte limit is exceeded", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      new Response("x".repeat(128), { headers: { "content-type": "application/json" } }),
    );
    const config = { ...loadConfig({}), maxResponseBytes: 64 };
    const client = new XrocketClient(config, fetchMock);

    await expect(client.getAssets()).rejects.toThrow("response exceeded the configured size limit");
  });

  it("keeps the request timeout active while streaming the response body", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_input, init) => {
      const signal = init?.signal;
      return new Response(
        new ReadableStream({
          start(controller) {
            signal?.addEventListener("abort", () =>
              controller.error(new DOMException("aborted", "AbortError")),
            );
          },
        }),
      );
    });
    const config = { ...loadConfig({}), requestTimeoutMs: 10 };
    const client = new XrocketClient(config, fetchMock);

    await expect(client.getAssets()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("preserves Retry-After on a read-side rate limit", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      new Response(JSON.stringify({ message: "slow down" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "7" },
      }),
    );
    const client = new XrocketClient(loadConfig({}), fetchMock);

    await expect(client.getAssets()).rejects.toMatchObject({ status: 429, retryAfter: "7" });
  });
});
