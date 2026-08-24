import type { XrocketConfig } from "./config.js";
import { UnknownWriteOutcomeError, XrocketHttpError } from "./errors.js";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type QueryValue = string | number | boolean | readonly string[] | undefined;
type Query = Readonly<Record<string, QueryValue>>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  private?: boolean;
  write?: { operation: string; clientId: string };
}

function addQuery(url: URL, query: Query | undefined): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}

function unknownCause(error: unknown): string {
  if (error instanceof Error) return error.name;
  return "transport error";
}

function isAmbiguousWriteStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function sensitiveRequestValues(value: unknown): string[] {
  const values = new Set<string>();
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (/address|destination|memo|comment/i.test(key) && typeof child === "string" && child) {
        values.add(child);
        values.add(JSON.stringify(child).slice(1, -1));
      } else {
        visit(child);
      }
    }
  };
  visit(value);
  return [...values].filter(Boolean).sort((left, right) => right.length - left.length);
}

function redactText(text: string, values: readonly string[]): string {
  let redacted = text;
  for (const value of values) {
    if (redacted.includes(value)) redacted = redacted.split(value).join("[REDACTED]");
  }
  return redacted;
}

function redactJsonValue(value: unknown, values: readonly string[], key = ""): unknown {
  if (typeof value === "string") {
    if (/token|authorization|secret|address|destination|memo|comment/i.test(key)) {
      return "[REDACTED]";
    }
    const embeddedValues = values.filter((candidate) => candidate.length >= 4 || candidate === value);
    return redactText(value, embeddedValues);
  }
  if (Array.isArray(value)) return value.map((item) => redactJsonValue(item, values));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        redactJsonValue(child, values, childKey),
      ]),
    );
  }
  return value;
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error("xRocket API response exceeded the configured size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export class XrocketClient {
  constructor(
    private readonly config: XrocketConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<unknown> {
    const url = new URL(path, this.config.apiBaseUrl);
    addQuery(url, options.query);
    const headers = new Headers({ Accept: "application/json" });
    if (options.private) {
      if (!this.config.apiToken) throw new Error("XROCKET_API_TOKEN is required for this tool");
      headers.set("Authorization", `Bearer ${this.config.apiToken}`);
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        signal: controller.signal,
        redirect: "error",
        ...(body === undefined ? {} : { body }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if (options.write) {
        throw new UnknownWriteOutcomeError(
          options.write.operation,
          options.write.clientId,
          unknownCause(error),
        );
      }
      throw error;
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > this.config.maxResponseBytes) {
      clearTimeout(timeout);
      try {
        await response.body?.cancel();
      } catch {
        // The response is already unusable; classification below must not depend on cancel support.
      }
      if (options.write && (response.ok || isAmbiguousWriteStatus(response.status))) {
        throw new UnknownWriteOutcomeError(
          options.write.operation,
          options.write.clientId,
          "response exceeded size limit",
        );
      }
      if (!response.ok) {
        throw new XrocketHttpError(
          response.status,
          { message: "xRocket API error response exceeded the configured size limit" },
          response.headers.get("retry-after") ?? undefined,
        );
      }
      throw new Error("xRocket API response exceeded the configured size limit");
    }

    let text: string;
    try {
      text = await readTextWithLimit(response, this.config.maxResponseBytes);
    } catch (error) {
      if (options.write && (response.ok || isAmbiguousWriteStatus(response.status))) {
        throw new UnknownWriteOutcomeError(
          options.write.operation,
          options.write.clientId,
          unknownCause(error),
        );
      }
      if (!response.ok) {
        throw new XrocketHttpError(
          response.status,
          { message: "xRocket API error response could not be read safely" },
          response.headers.get("retry-after") ?? undefined,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const valuesToRedact = [
      ...(this.config.apiToken ? [this.config.apiToken] : []),
      ...sensitiveRequestValues(options.body),
    ];
    let data: unknown = null;
    if (text) {
      try {
        data = redactJsonValue(JSON.parse(text) as unknown, valuesToRedact);
      } catch {
        if (options.write && response.ok) {
          throw new UnknownWriteOutcomeError(
            options.write.operation,
            options.write.clientId,
            "invalid success response",
          );
        }
        data = redactText(text, valuesToRedact).slice(0, 2_000);
      }
    }

    if (!response.ok) {
      if (options.write && isAmbiguousWriteStatus(response.status)) {
        throw new UnknownWriteOutcomeError(
          options.write.operation,
          options.write.clientId,
          `HTTP ${response.status}`,
        );
      }
      throw new XrocketHttpError(
        response.status,
        data,
        response.headers.get("retry-after") ?? undefined,
      );
    }
    return data;
  }

  getHealth(): Promise<unknown> {
    return this.request("GET", "/health");
  }

  getAssets(asset?: string): Promise<unknown> {
    return asset
      ? this.request("GET", `/api/v1/assets/${encodeURIComponent(asset)}`)
      : this.request("GET", "/api/v1/assets");
  }

  getSymbols(symbol?: string): Promise<unknown> {
    return symbol
      ? this.request("GET", `/api/v1/symbols/${encodeURIComponent(symbol)}`)
      : this.request("GET", "/api/v1/symbols");
  }

  getTickers(tickerType: "24h", symbols?: readonly string[]): Promise<unknown> {
    return this.request("GET", `/api/v1/ticker/${tickerType}`, { query: { symbols } });
  }

  getCandles(query: {
    symbol: string;
    type: string;
    startAt: string;
    endAt: string;
  }): Promise<unknown> {
    return this.request("GET", "/api/v1/candles", { query });
  }

  getOrderbook(query: {
    symbol: string;
    depth?: number | undefined;
    precision?: string | undefined;
  }): Promise<unknown> {
    return this.request("GET", "/api/v1/orderbook", { query });
  }

  getTrades(symbol: string): Promise<unknown> {
    return this.request("GET", "/api/v1/trades", { query: { symbol } });
  }

  getRates(base: string, assets?: readonly string[]): Promise<unknown> {
    return this.request("GET", "/api/v1/rates", { query: { base, assets } });
  }

  getTradeFees(symbols?: readonly string[]): Promise<unknown> {
    return this.request("GET", "/api/v1/trade-fees", { query: { symbols } });
  }

  getBalances(account: "trading" | "funding"): Promise<unknown> {
    return this.request("GET", `/api/v1/accounts/${account}/balances`, { private: true });
  }

  getOrders(
    view: "active" | "history" | "one",
    query: Query,
  ): Promise<unknown> {
    const path =
      view === "active"
        ? "/api/v1/orders/active"
        : view === "history"
          ? "/api/v1/orders/history"
          : "/api/v1/order";
    return this.request("GET", path, { private: true, query });
  }

  getTransfers(view: "history" | "one", query: Query): Promise<unknown> {
    const path = view === "history" ? "/api/v1/accounts/transfers" : "/api/v1/accounts/transfer";
    return this.request("GET", path, { private: true, query });
  }

  getWithdrawals(view: "history" | "one", query: Query): Promise<unknown> {
    const path =
      view === "history"
        ? "/api/v1/accounts/funding/withdrawals"
        : "/api/v1/accounts/funding/withdrawal";
    return this.request("GET", path, { private: true, query });
  }

  getWithdrawalQuotas(asset: string, network: string): Promise<unknown> {
    return this.request("GET", "/api/v1/accounts/funding/withdrawal-quotas", {
      private: true,
      query: { asset, network },
    });
  }

  estimateOrder(order: unknown): Promise<unknown> {
    return this.request("POST", "/api/v1/orders/estimate", { private: true, body: order });
  }

  placeOrder(order: { clientOrderId: string } & Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/api/v1/orders", {
      private: true,
      body: order,
      write: { operation: "order placement", clientId: order.clientOrderId },
    });
  }

  cancelOrder(intent: {
    orderId?: string | undefined;
    clientOrderId?: string | undefined;
  }): Promise<unknown> {
    const clientId = intent.orderId ?? intent.clientOrderId ?? "unknown";
    return this.request("DELETE", "/api/v1/order", {
      private: true,
      query: intent,
      write: { operation: "order cancellation", clientId },
    });
  }

  createTransfer(transfer: { clientTransferId: string } & Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/api/v1/accounts/transfers", {
      private: true,
      body: transfer,
      write: { operation: "internal transfer", clientId: transfer.clientTransferId },
    });
  }

  createWithdrawal(
    withdrawal: { clientWithdrawalId: string } & Record<string, unknown>,
  ): Promise<unknown> {
    return this.request("POST", "/api/v1/accounts/funding/withdrawals", {
      private: true,
      body: withdrawal,
      write: { operation: "external withdrawal", clientId: withdrawal.clientWithdrawalId },
    });
  }
}
