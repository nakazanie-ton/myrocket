function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

interface SymbolRow extends Record<string, unknown> {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
}

function symbolRows(value: unknown): SymbolRow[] {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.symbols)
      ? value.symbols
      : undefined;
  if (!rows) throw new Error("Unexpected xRocket symbols response shape");
  return rows.filter(
    (row): row is SymbolRow => isRecord(row) && typeof row.symbol === "string",
  );
}

export function resolveMarket(value: unknown, query: string): SymbolRow {
  const requested = query.trim().toUpperCase();
  const rows = symbolRows(value);
  const exact = rows.find((row) => row.symbol.toUpperCase() === requested);
  if (exact) return exact;

  const byBase = rows.filter(
    (row) => typeof row.baseAsset === "string" && row.baseAsset.toUpperCase() === requested,
  );
  if (byBase.length === 1) return byBase[0]!;
  const usdt = byBase.filter(
    (row) => typeof row.quoteAsset === "string" && row.quoteAsset.toUpperCase() === "USDT",
  );
  if (usdt.length === 1) return usdt[0]!;
  if (byBase.length > 0) {
    throw new Error(
      `Market ${query} is ambiguous; use an exact symbol: ${byBase.map((row) => row.symbol).join(", ")}`,
    );
  }
  throw new Error(
    `No xRocket market matches ${query}; use xrocket_market_symbols to discover symbols`,
  );
}

function exactSymbolRecord(
  value: unknown,
  key: string,
  symbol: string,
  label: string,
): Record<string, unknown> {
  const records = isRecord(value) && Array.isArray(value[key])
    ? value[key].filter(isRecord)
    : Array.isArray(value)
      ? value.filter(isRecord)
      : isRecord(value)
        ? [value]
        : [];
  const exact = records.find(
    (record) =>
      typeof record.symbol === "string" &&
      record.symbol.toUpperCase() === symbol.toUpperCase(),
  );
  if (!exact) {
    throw new Error(`Unexpected xRocket ${label} response: ${symbol} row is missing`);
  }
  return exact;
}

function decimalParts(value: string): [string, string] | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return undefined;
  const [integer, fraction = ""] = value.split(".");
  return [integer!, fraction];
}

function compareDecimalStrings(left: string, right: string): number {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  if (!leftParts || !rightParts) throw new Error("Unexpected xRocket order-book price format");
  if (leftParts[0].length !== rightParts[0].length) {
    return leftParts[0].length < rightParts[0].length ? -1 : 1;
  }
  if (leftParts[0] !== rightParts[0]) return leftParts[0] < rightParts[0] ? -1 : 1;
  const width = Math.max(leftParts[1].length, rightParts[1].length);
  const leftFraction = leftParts[1].padEnd(width, "0");
  const rightFraction = rightParts[1].padEnd(width, "0");
  return leftFraction === rightFraction ? 0 : leftFraction < rightFraction ? -1 : 1;
}

function bestPrice(value: unknown, side: "bids" | "asks"): string | undefined {
  if (!isRecord(value) || !Array.isArray(value[side])) return undefined;
  const prices = value[side]
    .map((level) => (Array.isArray(level) && typeof level[0] === "string" ? level[0] : undefined))
    .filter((price): price is string => price !== undefined);
  if (prices.length === 0) return undefined;
  return prices.reduce((best, price) => {
    const comparison = compareDecimalStrings(price, best);
    return side === "bids" ? (comparison > 0 ? price : best) : comparison < 0 ? price : best;
  });
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

export interface MarketSnapshot {
  environment: string;
  retrievedAt: string;
  summary: Record<string, unknown>;
  constraints: {
    decimalValues: string;
    consistency: string;
  };
  actions: {
    tradeWithMcp: {
      label: "Trade with MCP";
      url: string;
    };
    openXrocket: {
      label: "Open xRocket";
      url: string;
    };
  };
  details: Record<string, unknown>;
}

export function buildMarketSnapshot(input: {
  environment: string;
  resolved: SymbolRow;
  symbolRules: unknown;
  ticker: unknown;
  orderbook: unknown;
  trades: unknown;
  fees: unknown;
  openXrocketUrl: string;
  tradingSetupUrl: string;
}): MarketSnapshot {
  const ticker = exactSymbolRecord(
    input.ticker,
    "tickers",
    input.resolved.symbol,
    "ticker",
  );
  const fee = exactSymbolRecord(input.fees, "fees", input.resolved.symbol, "trade-fee");
  const standardFee = isRecord(fee?.standard) ? fee.standard : undefined;
  const symbolRules = exactSymbolRecord(
    input.symbolRules,
    "symbols",
    input.resolved.symbol,
    "symbol-rules",
  );
  const bestBid = bestPrice(input.orderbook, "bids");
  const bestAsk = bestPrice(input.orderbook, "asks");
  const summary = {
    symbol: input.resolved.symbol,
    ...(typeof input.resolved.baseAsset === "string" ? { baseAsset: input.resolved.baseAsset } : {}),
    ...(typeof input.resolved.quoteAsset === "string" ? { quoteAsset: input.resolved.quoteAsset } : {}),
    ...(typeof symbolRules.enableTrading === "boolean"
      ? { tradingEnabled: symbolRules.enableTrading }
      : {}),
    ...(stringField(ticker, "last") ? { last: stringField(ticker, "last") } : {}),
    ...(stringField(ticker, "open") ? { open: stringField(ticker, "open") } : {}),
    ...(stringField(ticker, "high") ? { high: stringField(ticker, "high") } : {}),
    ...(stringField(ticker, "low") ? { low: stringField(ticker, "low") } : {}),
    ...(stringField(ticker, "changePrice")
      ? { changePrice: stringField(ticker, "changePrice") }
      : {}),
    ...(stringField(ticker, "changeRate")
      ? { changeRate: stringField(ticker, "changeRate") }
      : {}),
    ...(stringField(ticker, "baseVolume")
      ? { baseVolume: stringField(ticker, "baseVolume") }
      : {}),
    ...(stringField(ticker, "quoteVolume")
      ? { quoteVolume: stringField(ticker, "quoteVolume") }
      : {}),
    ...(bestBid ? { bestBid } : {}),
    ...(bestAsk ? { bestAsk } : {}),
    ...(stringField(standardFee, "maker") ? { makerFee: stringField(standardFee, "maker") } : {}),
    ...(stringField(standardFee, "taker") ? { takerFee: stringField(standardFee, "taker") } : {}),
  };
  return {
    environment: input.environment,
    retrievedAt: new Date().toISOString(),
    summary,
    constraints: {
      decimalValues: "All financial decimal values are exact strings; do not coerce them to JSON numbers.",
      consistency: "REST components are retrieved concurrently and are not an atomic synchronized snapshot.",
    },
    actions: {
      tradeWithMcp: {
        label: "Trade with MCP",
        url: input.tradingSetupUrl,
      },
      openXrocket: {
        label: "Open xRocket",
        url: input.openXrocketUrl,
      },
    },
    details: {
      symbolRules: input.symbolRules,
      ticker: input.ticker,
      orderbook: input.orderbook,
      recentTrades: input.trades,
      tradeFees: input.fees,
    },
  };
}

export function marketSnapshotText(snapshot: MarketSnapshot): string {
  const summary = snapshot.summary;
  const rows = [
    `# ${String(summary.symbol)} on xRocket (${snapshot.environment})`,
    "",
    `- Last: ${String(summary.last ?? "unavailable")}`,
    `- Best bid / ask: ${String(summary.bestBid ?? "unavailable")} / ${String(summary.bestAsk ?? "unavailable")}`,
    `- 24h high / low: ${String(summary.high ?? "unavailable")} / ${String(summary.low ?? "unavailable")}`,
    `- 24h change rate: ${String(summary.changeRate ?? "unavailable")}`,
    `- Maker / taker fee: ${String(summary.makerFee ?? "unavailable")} / ${String(summary.takerFee ?? "unavailable")}`,
    "",
    `Retrieved ${snapshot.retrievedAt}. ${snapshot.constraints.consistency}`,
    "",
    `[${snapshot.actions.tradeWithMcp.label}](${snapshot.actions.tradeWithMcp.url})`,
    `[${snapshot.actions.openXrocket.label}](${snapshot.actions.openXrocket.url})`,
  ];
  return rows.join("\n");
}
