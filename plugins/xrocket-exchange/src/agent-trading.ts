import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import type { XrocketClient } from "./client.js";
import { assertWriteAllowed, type TradingPolicy, type XrocketConfig } from "./config.js";
import { addDecimals, compareDecimals, multiplyDecimals, subtractDecimals, sumDecimals } from "./decimal.js";
import { UnknownWriteOutcomeError, XrocketHttpError } from "./errors.js";

const nonnegativeDecimal = z.string().max(128).regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const decimal = nonnegativeDecimal.refine((value) => /[1-9]/.test(value));
const estimateSchema = z.object({
  symbol: z.string(),
  funds: decimal,
});
const symbolRulesSchema = z.object({
  symbol: z.string(),
  quoteAsset: z.string(),
  enableTrading: z.boolean().optional(),
});
const orderRecordSchema = z.object({
  id: z.string().optional(),
  clientOrderId: z.string().optional(),
  symbol: z.string(),
  status: z.string(),
});
const accountOrderSchema = orderRecordSchema.extend({
  createdAt: z.string().datetime({ offset: true }),
  quoteAsset: z.string(),
  funds: nonnegativeDecimal.optional(),
  dealFunds: nonnegativeDecimal.optional(),
});
const activeOrdersSchema = z.object({ orders: z.array(accountOrderSchema) });
const orderHistorySchema = z.object({
  orders: z.array(accountOrderSchema),
  currentPage: z.number().int().min(1),
  totalPage: z.number().int().min(0),
});
const ratesSchema = z.record(z.string(), z.object({ rate: decimal }));

const ledgerOrderSchema = z.object({
  clientOrderId: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  symbol: z.string(),
  usdValue: nonnegativeDecimal,
  status: z.enum(["unknown", "confirmed", "terminal"]),
});
const ledgerSchema = z.object({ version: z.literal(1), orders: z.array(ledgerOrderSchema) });
type Ledger = z.infer<typeof ledgerSchema>;
type LedgerOrder = z.infer<typeof ledgerOrderSchema>;

export interface AgentOrder {
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  size?: string;
  funds?: string;
  price?: string;
  timeInForce: "GTC" | "IOC" | "FOK";
}

export interface AgentTradingOptions {
  statePath?: string;
  now?: () => Date;
}

interface PolicySnapshot {
  dailyLimit: string;
  limitAsset: string;
  dailyLimitUsd: string;
  usedUsd: string;
  remainingUsd: string;
  ordersToday: number;
  maxDailyOrders: number;
  activeOrders: number;
  maxOpenOrders: number;
  symbols: readonly string[] | "all";
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultStatePath(config: XrocketConfig): string {
  const account = createHash("sha256").update(config.apiToken ?? "public").digest("hex").slice(0, 16);
  return path.join(homedir(), ".xrocket-mcp", `${config.environment}-${account}-agent-ledger.json`);
}

function isTerminalStatus(status: string): boolean {
  return ["rejected", "cancelled", "completed", "expired"].includes(status);
}

function isAgentOrder(clientOrderId: string | undefined): clientOrderId is string {
  return clientOrderId?.startsWith("xrmcp-") === true;
}

function policyFor(config: XrocketConfig): TradingPolicy {
  if (!config.tradingPolicy) {
    throw new Error("Autonomous trading requires XROCKET_TRADING_LIMIT, for example 100 USD");
  }
  return config.tradingPolicy;
}

async function readLedger(statePath: string): Promise<Ledger> {
  try {
    return ledgerSchema.parse(JSON.parse(await fs.readFile(statePath, "utf8")) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, orders: [] };
    throw new Error(`Cannot read the autonomous trading ledger at ${statePath}: ${error instanceof Error ? error.message : "invalid data"}`);
  }
}

async function writeLedger(statePath: string, ledger: Ledger): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporaryPath, statePath);
}

async function lockOwnerIsRunning(lockPath: string): Promise<boolean> {
  const owner = Number((await fs.readFile(lockPath, "utf8")).trim());
  if (!Number.isSafeInteger(owner) || owner < 1) return false;
  try {
    process.kill(owner, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function withFileLock<T>(statePath: string, action: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
  const lockPath = `${statePath}.lock`;
  let handle;
  try {
    try {
      handle = await fs.open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const stat = await fs.stat(lockPath);
      if (Date.now() - stat.mtimeMs <= 120_000 || await lockOwnerIsRunning(lockPath)) {
        throw new Error("Another autonomous trade is in progress; wait for it to finish before trying again");
      }
      await fs.unlink(lockPath);
      handle = await fs.open(lockPath, "wx", 0o600);
    }
    await handle.writeFile(`${process.pid}\n`);
    return await action();
  } finally {
    await handle?.close();
    if (handle) await fs.unlink(lockPath).catch(() => undefined);
  }
}

function rateOf(rates: unknown, asset: string): string {
  if (asset === "USD") return "1";
  const parsed = ratesSchema.parse(rates);
  const rate = parsed[asset]?.rate;
  if (!rate) throw new Error(`No current USD rate is available for ${asset}; the trade is blocked`);
  return rate;
}

function trimLedger(ledger: Ledger, currentDay: string): Ledger {
  return {
    version: 1,
    orders: ledger.orders.filter((order) => order.day === currentDay || order.status === "unknown"),
  };
}

export class AgentTradingController {
  private readonly statePath: string;
  private readonly now: () => Date;

  constructor(
    private readonly config: XrocketConfig,
    private readonly client: XrocketClient,
    options: AgentTradingOptions = {},
  ) {
    this.statePath = options.statePath ?? config.agentStatePath ?? defaultStatePath(config);
    this.now = options.now ?? (() => new Date());
  }

  private async reconcileUnknown(ledger: Ledger): Promise<Ledger> {
    const reconciled: LedgerOrder[] = [];
    for (const order of ledger.orders) {
      if (order.status !== "unknown") {
        reconciled.push(order);
        continue;
      }
      try {
        const current = orderRecordSchema.parse(
          await this.client.getOrders("one", { clientOrderId: order.clientOrderId }),
        );
        reconciled.push({
          ...order,
          status: isTerminalStatus(current.status) ? "terminal" : "confirmed",
        });
      } catch (error) {
        if (error instanceof XrocketHttpError && error.status === 404) {
          reconciled.push(order);
          continue;
        }
        throw error;
      }
    }
    return { version: 1, orders: reconciled };
  }

  private async usdRates(assets: readonly string[]): Promise<unknown> {
    const cryptoAssets = [...new Set(assets.filter((asset) => asset !== "USD"))];
    return cryptoAssets.length === 0 ? {} : this.client.getRates("USD", cryptoAssets);
  }

  private async todayHistory(now: Date): Promise<z.infer<typeof accountOrderSchema>[]> {
    const query = {
      startAt: `${dayOf(now)}T00:00:00.000Z`,
      endAt: now.toISOString(),
      currentPage: 1,
      pageSize: 100,
      hideCanceled: false,
    } as const;
    const firstPage = orderHistorySchema.parse(await this.client.getOrders("history", query));
    if (firstPage.totalPage > 100) {
      throw new Error("Today's order history exceeds the safe reconciliation window; autonomous trading is blocked");
    }
    const orders = [...firstPage.orders];
    for (let currentPage = 2; currentPage <= firstPage.totalPage; currentPage += 1) {
      const page = orderHistorySchema.parse(
        await this.client.getOrders("history", { ...query, currentPage }),
      );
      if (page.currentPage !== currentPage || page.totalPage !== firstPage.totalPage) {
        throw new Error("xRocket order history changed during policy reconciliation; retry after it settles");
      }
      orders.push(...page.orders);
    }
    return orders;
  }

  private mergeRemoteOrders(
    ledger: Ledger,
    currentDay: string,
    remoteOrders: readonly z.infer<typeof accountOrderSchema>[],
    rates: unknown,
  ): Ledger {
    const merged = [...ledger.orders];
    const byClientId = new Map(merged.map((order) => [order.clientOrderId, order]));
    for (const remote of remoteOrders) {
      if (!isAgentOrder(remote.clientOrderId) || dayOf(new Date(remote.createdAt)) !== currentDay) {
        continue;
      }
      const existing = byClientId.get(remote.clientOrderId);
      if (existing) {
        existing.status = isTerminalStatus(remote.status) ? "terminal" : "confirmed";
        continue;
      }
      const valueInQuote =
        remote.funds !== undefined && compareDecimals(remote.funds, "0") > 0
          ? remote.funds
          : remote.dealFunds;
      if (valueInQuote === undefined) {
        throw new Error(
          `Cannot safely value prior autonomous order ${remote.clientOrderId}; autonomous trading is blocked`,
        );
      }
      if (!isTerminalStatus(remote.status) && compareDecimals(valueInQuote, "0") === 0) {
        throw new Error(
          `Cannot safely value active autonomous order ${remote.clientOrderId}; autonomous trading is blocked`,
        );
      }
      const recovered: LedgerOrder = {
        clientOrderId: remote.clientOrderId,
        createdAt: remote.createdAt,
        day: currentDay,
        symbol: remote.symbol,
        usdValue: multiplyDecimals(valueInQuote, rateOf(rates, remote.quoteAsset)),
        status: isTerminalStatus(remote.status) ? "terminal" : "confirmed",
      };
      merged.push(recovered);
      byClientId.set(recovered.clientOrderId, recovered);
    }
    return { version: 1, orders: merged };
  }

  async trade(order: AgentOrder): Promise<unknown> {
    assertWriteAllowed(this.config, "trading");
    const policy = policyFor(this.config);
    if (policy.symbols && !policy.symbols.includes(order.symbol)) {
      throw new Error(`${order.symbol} is outside the optional autonomous trading symbol list`);
    }

    return withFileLock(this.statePath, async () => {
      const now = this.now();
      const currentDay = dayOf(now);
      let ledger = trimLedger(await readLedger(this.statePath), currentDay);
      ledger = await this.reconcileUnknown(ledger);

      const [estimateRaw, symbolRulesRaw, activeOrdersRaw, historyOrders] = await Promise.all([
        this.client.estimateOrder(order),
        this.client.getSymbols(order.symbol),
        this.client.getOrders("active", {}),
        this.todayHistory(now),
      ]);
      const estimate = estimateSchema.parse(estimateRaw);
      const symbolRules = symbolRulesSchema.parse(symbolRulesRaw);
      const activeOrders = activeOrdersSchema.parse(activeOrdersRaw).orders;
      if (estimate.symbol !== order.symbol || symbolRules.symbol !== order.symbol) {
        throw new Error("xRocket returned mismatched order or symbol data; the trade is blocked");
      }
      if (symbolRules.enableTrading === false) {
        throw new Error(`${order.symbol} is currently unavailable for trading`);
      }

      const remoteAgentOrders = [...activeOrders, ...historyOrders].filter((entry) =>
        isAgentOrder(entry.clientOrderId),
      );
      const rates = await this.usdRates([
        symbolRules.quoteAsset,
        policy.limitAsset,
        ...remoteAgentOrders.map((entry) => entry.quoteAsset),
      ]);
      ledger = this.mergeRemoteOrders(ledger, currentDay, remoteAgentOrders, rates);
      const orderValueUsd = multiplyDecimals(estimate.funds, rateOf(rates, symbolRules.quoteAsset));
      const dailyLimitUsd = multiplyDecimals(policy.dailyLimit, rateOf(rates, policy.limitAsset));
      const todaysOrders = ledger.orders.filter((entry) => entry.day === currentDay);
      const usedUsd = sumDecimals(todaysOrders.map((entry) => entry.usdValue));
      const nextUsedUsd = addDecimals(usedUsd, orderValueUsd);
      if (compareDecimals(nextUsedUsd, dailyLimitUsd) > 0) {
        throw new Error(
          `Daily autonomous trading limit exceeded: ${nextUsedUsd} USD requested, ${dailyLimitUsd} USD allowed`,
        );
      }
      if (todaysOrders.length >= policy.maxDailyOrders) {
        throw new Error(`Daily autonomous order limit reached: ${policy.maxDailyOrders}`);
      }
      const unresolved = ledger.orders.filter((entry) => entry.status === "unknown").length;
      const activeCount = activeOrders.length + unresolved;
      if (activeCount >= policy.maxOpenOrders) {
        throw new Error(`Active autonomous order limit reached: ${policy.maxOpenOrders}`);
      }

      const reserved: LedgerOrder = {
        clientOrderId: order.clientOrderId,
        createdAt: now.toISOString(),
        day: currentDay,
        symbol: order.symbol,
        usdValue: orderValueUsd,
        status: "unknown",
      };
      ledger.orders.push(reserved);
      await writeLedger(this.statePath, ledger);

      let data: unknown;
      try {
        data = await this.client.placeOrder(order);
      } catch (error) {
        if (error instanceof UnknownWriteOutcomeError) throw error;
        ledger.orders = ledger.orders.filter((entry) => entry !== reserved);
        await writeLedger(this.statePath, ledger);
        throw error;
      }

      reserved.status = "confirmed";
      try {
        await writeLedger(this.statePath, ledger);
      } catch (error) {
        throw new UnknownWriteOutcomeError(
          "order placement",
          order.clientOrderId,
          `local accounting failed after the exchange accepted the order: ${error instanceof Error ? error.name : "filesystem error"}`,
        );
      }
      return {
        environment: this.config.environment,
        clientOrderId: order.clientOrderId,
        data,
        policy: {
          dailyLimit: `${policy.dailyLimit} ${policy.limitAsset}`,
          orderValueUsd,
          usedAfterOrderUsd: nextUsedUsd,
          remainingUsd: subtractDecimals(dailyLimitUsd, nextUsedUsd),
          ordersToday: todaysOrders.length + 1,
          maxDailyOrders: policy.maxDailyOrders,
          activeOrdersBeforePlacement: activeCount,
          maxOpenOrders: policy.maxOpenOrders,
        },
      };
    });
  }

  async cancel(cancellation: {
    orderId?: string | undefined;
    clientOrderId?: string | undefined;
  }): Promise<unknown> {
    assertWriteAllowed(this.config, "trading");
    const policy = policyFor(this.config);
    return withFileLock(this.statePath, async () => {
      const current = orderRecordSchema.parse(await this.client.getOrders("one", cancellation));
      if (policy.symbols && !policy.symbols.includes(current.symbol)) {
        throw new Error(`${current.symbol} is outside the optional autonomous trading symbol list`);
      }
      return {
        environment: this.config.environment,
        order: current,
        data: await this.client.cancelOrder(cancellation),
      };
    });
  }

  async status(): Promise<PolicySnapshot> {
    const policy = policyFor(this.config);
    const now = this.now();
    const currentDay = dayOf(now);
    const [activeOrdersRaw, historyOrders] = await Promise.all([
      this.client.getOrders("active", {}),
      this.todayHistory(now),
    ]);
    const activeOrders = activeOrdersSchema.parse(activeOrdersRaw).orders;
    const remoteAgentOrders = [...activeOrders, ...historyOrders].filter((entry) =>
      isAgentOrder(entry.clientOrderId),
    );
    const rates = await this.usdRates([
      policy.limitAsset,
      ...remoteAgentOrders.map((entry) => entry.quoteAsset),
    ]);
    const ledger = this.mergeRemoteOrders(
      trimLedger(await readLedger(this.statePath), currentDay),
      currentDay,
      remoteAgentOrders,
      rates,
    );
    const todaysOrders = ledger.orders.filter((entry) => entry.day === currentDay);
    const dailyLimitUsd = multiplyDecimals(policy.dailyLimit, rateOf(rates, policy.limitAsset));
    const usedUsd = sumDecimals(todaysOrders.map((entry) => entry.usdValue));
    return {
      dailyLimit: policy.dailyLimit,
      limitAsset: policy.limitAsset,
      dailyLimitUsd,
      usedUsd,
      remainingUsd: compareDecimals(usedUsd, dailyLimitUsd) >= 0 ? "0" : subtractDecimals(dailyLimitUsd, usedUsd),
      ordersToday: todaysOrders.length,
      maxDailyOrders: policy.maxDailyOrders,
      activeOrders: activeOrders.length + ledger.orders.filter((entry) => entry.status === "unknown").length,
      maxOpenOrders: policy.maxOpenOrders,
      symbols: policy.symbols ?? "all",
    };
  }
}
