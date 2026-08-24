import { McpServer, type CallToolResult, type ToolAnnotations } from "@modelcontextprotocol/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertWriteAllowed, loadConfig, type XrocketConfig } from "./config.js";
import { XrocketClient, type FetchLike } from "./client.js";
import { ApprovalReceiptError, UnknownWriteOutcomeError, XrocketHttpError } from "./errors.js";
import { registerPublicXrocketTools } from "./public-server.js";
import { ApprovalReceiptStore } from "./receipts.js";
import { VERSION } from "./version.js";

const resultSchema = z.object({ result: z.unknown() });
const symbolSchema = z.string().min(1).max(64).describe("Exact current xRocket symbol, for example GRAM-USDT");
const assetSchema = z.string().min(1).max(64).describe("Exact xRocket asset identifier; TON is currently TONCOIN");
const decimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "must be a plain non-negative decimal string")
  .refine((value) => /[1-9]/.test(value), "must be greater than zero")
  .describe("Exact positive decimal string; never use a JSON number");
const clientId64Schema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "use only letters, numbers, underscore and hyphen");
const clientId50Schema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9_-]+$/, "use only letters, numbers, underscore and hyphen");
const orderClientIdSchema = clientId64Schema;
const networkSchema = z.enum(["TON", "BSC", "ETH", "BTC", "TRX", "SOL"]);
const sideSchema = z.enum(["buy", "sell"]);
const intervalSchema = z.enum([
  "1min",
  "5min",
  "15min",
  "30min",
  "1hour",
  "2hour",
  "4hour",
  "8hour",
  "12hour",
  "1day",
  "1week",
  "1month",
]);
const dateTimeSchema = z.string().datetime({ offset: true });

const limitOrderSchema = z.object({
  clientOrderId: orderClientIdSchema.optional(),
  symbol: symbolSchema,
  side: sideSchema,
  type: z.literal("limit"),
  size: decimalSchema,
  price: decimalSchema,
  timeInForce: z.enum(["GTC", "IOC", "FOK"]),
});
const marketOrderSchema = z
  .object({
    clientOrderId: orderClientIdSchema.optional(),
    symbol: symbolSchema,
    side: sideSchema,
    type: z.literal("market"),
    size: decimalSchema.optional(),
    funds: decimalSchema.optional(),
    timeInForce: z.enum(["IOC", "FOK"]),
  })
  .refine((order) => (order.size === undefined) !== (order.funds === undefined), {
    message: "market order requires exactly one of size or funds",
  });
const stopLimitOrderSchema = z.object({
  clientOrderId: orderClientIdSchema.optional(),
  symbol: symbolSchema,
  side: sideSchema,
  type: z.literal("stopLimit"),
  size: decimalSchema,
  price: decimalSchema,
  stopPrice: decimalSchema,
  timeInForce: z.enum(["GTC", "IOC", "FOK"]),
});
const stopMarketOrderSchema = z.object({
  clientOrderId: orderClientIdSchema.optional(),
  symbol: symbolSchema,
  side: sideSchema,
  type: z.literal("stopMarket"),
  size: decimalSchema,
  stopPrice: decimalSchema,
  timeInForce: z.enum(["IOC", "FOK"]),
});
const orderSchema = z
  .union([limitOrderSchema, marketOrderSchema, stopLimitOrderSchema, stopMarketOrderSchema])
  .transform((order) => ({
    ...order,
    clientOrderId: order.clientOrderId ?? `order-${randomUUID()}`,
  }));

const cancelIntentSchema = z
  .object({
    orderId: z.string().min(1).max(100).optional(),
    clientOrderId: orderClientIdSchema.optional(),
  })
  .refine((value) => value.orderId !== undefined || value.clientOrderId !== undefined, {
    message: "orderId or clientOrderId is required",
  });

const transferSchema = z
  .object({
    clientTransferId: clientId64Schema.optional(),
    asset: assetSchema,
    amount: decimalSchema,
    from: z.enum(["funding", "trading"]),
    to: z.enum(["funding", "trading"]),
  })
  .refine((value) => value.from !== value.to, { message: "from and to accounts must differ" })
  .transform((transfer) => ({
    ...transfer,
    clientTransferId: transfer.clientTransferId ?? `transfer-${randomUUID()}`,
  }));

const withdrawalSchema = z.object({
  clientWithdrawalId: clientId50Schema.optional(),
  network: networkSchema,
  asset: assetSchema,
  address: z.string().min(1).max(256),
  amount: decimalSchema,
  comment: z.string().max(256).optional(),
}).transform((withdrawal) => ({
  ...withdrawal,
  clientWithdrawalId: withdrawal.clientWithdrawalId ?? `withdrawal-${randomUUID()}`,
}));

const READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
const PREPARE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};
const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

function ok(value: unknown): CallToolResult {
  const structuredContent = { result: value };
  return { content: [{ type: "text", text: jsonText(value) }], structuredContent };
}

function okWithText(value: unknown, text: string): CallToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "text", text: jsonText(value) },
    ],
    structuredContent: { result: value },
  };
}

function errorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof UnknownWriteOutcomeError) {
    return {
      ok: false,
      code: "WRITE_OUTCOME_UNKNOWN",
      message: error.message,
      operation: error.operation,
      clientId: error.clientId,
      doNotRetry: true,
      reconcileWithPrivateReadTool: true,
      cause: error.causeDescription,
    };
  }
  if (error instanceof XrocketHttpError) {
    return {
      ok: false,
      code: "XROCKET_HTTP_ERROR",
      message: error.message,
      status: error.status,
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      details: boundedErrorDetails(error.details),
    };
  }
  if (error instanceof ApprovalReceiptError) {
    return { ok: false, code: "APPROVAL_RECEIPT_ERROR", message: error.message };
  }
  return {
    ok: false,
    code: "TOOL_ERROR",
    message: error instanceof Error ? error.message : "Unknown tool error",
  };
}

function boundedErrorDetails(details: unknown): unknown {
  try {
    const serialized = JSON.stringify(details, (key, value: unknown) =>
      /token|authorization|secret|address|destination|memo|comment/i.test(key)
        ? "[REDACTED]"
        : value,
    );
    if (serialized.length <= 4_000) return JSON.parse(serialized) as unknown;
    return { truncated: true, preview: serialized.slice(0, 4_000) };
  } catch {
    return "Unserializable upstream error details";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function relevantSymbolAssets(symbolRules: unknown, symbol: string): string[] {
  if (isRecord(symbolRules)) {
    const baseAsset = symbolRules.baseAsset;
    const quoteAsset = symbolRules.quoteAsset;
    if (typeof baseAsset === "string" && typeof quoteAsset === "string") {
      return [baseAsset, quoteAsset];
    }
  }
  return symbol.split("-").filter((asset) => asset.length > 0);
}

function narrowBalances(data: unknown, assets: readonly string[]): Record<string, unknown> {
  const requestedAssets = [...new Set(assets.map((asset) => asset.toUpperCase()))];
  const wanted = new Set(requestedAssets);
  const balances = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.balances)
      ? data.balances
      : undefined;
  if (!balances) {
    throw new Error("Unexpected xRocket balance response shape; preparation stopped");
  }
  if (balances.some((balance) => !isRecord(balance) || typeof balance.asset !== "string")) {
    throw new Error("Unexpected xRocket balance row shape; preparation stopped");
  }
  return {
    requestedAssets,
    balances: balances.filter(
      (balance) =>
        isRecord(balance) &&
        typeof balance.asset === "string" &&
        wanted.has(balance.asset.toUpperCase()),
    ),
  };
}

function assertTransferDirectionAvailable(
  assetMetadata: unknown,
  from: "funding" | "trading",
  to: "funding" | "trading",
): void {
  const availableTransfers = isRecord(assetMetadata)
    ? assetMetadata.availableTransfers
    : undefined;
  if (
    !Array.isArray(availableTransfers) ||
    availableTransfers.some(
      (direction) =>
        direction !== "fundingToTrading" && direction !== "tradingToFunding",
    )
  ) {
    throw new Error("Unexpected xRocket asset transfer metadata; preparation stopped");
  }
  const requiredDirection =
    from === "funding" && to === "trading" ? "fundingToTrading" : "tradingToFunding";
  if (!availableTransfers.includes(requiredDirection)) {
    throw new Error(`xRocket asset does not allow ${requiredDirection}; preparation stopped`);
  }
}

async function run(action: () => Promise<unknown> | unknown): Promise<CallToolResult> {
  try {
    return ok(await action());
  } catch (error) {
    const payload = errorPayload(error);
    return {
      content: [{ type: "text", text: jsonText(payload) }],
      structuredContent: { result: payload },
      isError: true,
    };
  }
}

async function runWithText(
  action: () => Promise<{ value: unknown; text: string }>,
): Promise<CallToolResult> {
  try {
    const result = await action();
    return okWithText(result.value, result.text);
  } catch (error) {
    const payload = errorPayload(error);
    return {
      content: [{ type: "text", text: jsonText(payload) }],
      isError: true,
    };
  }
}

function intent(environment: string, payload: unknown): unknown {
  return { environment, payload };
}

function receiptPayload(storedIntent: unknown, environment: string): unknown {
  if (
    storedIntent === null ||
    typeof storedIntent !== "object" ||
    !("environment" in storedIntent) ||
    !("payload" in storedIntent) ||
    storedIntent.environment !== environment
  ) {
    throw new ApprovalReceiptError("approval receipt environment does not match this server");
  }
  return storedIntent.payload;
}

function gateStatus(config: XrocketConfig, capability: "trading" | "transfers" | "withdrawals") {
  const capabilityEnabled = {
    trading: config.enableTrading,
    transfers: config.enableTransfers,
    withdrawals: config.enableWithdrawals,
  }[capability];
  return {
    capabilityEnabled,
    mainnetWriteEnabled: config.environment !== "mainnet" || config.allowMainnetWrites,
    executable:
      capabilityEnabled && (config.environment !== "mainnet" || config.allowMainnetWrites),
  };
}

function executionStatus(
  config: XrocketConfig,
  capability: "trading" | "transfers" | "withdrawals",
) {
  const gate = gateStatus(config, capability);
  if (gate.executable) {
    return {
      ready: true,
      blocker: null,
      nextStep: "Obtain explicit user approval of this exact preview, then call execute once.",
    };
  }
  const capabilityVariable = {
    trading: "XROCKET_ENABLE_TRADING",
    transfers: "XROCKET_ENABLE_TRANSFERS",
    withdrawals: "XROCKET_ENABLE_WITHDRAWALS",
  }[capability];
  if (!gate.capabilityEnabled) {
    return {
      ready: false,
      blocker: `${capability} execution is disabled`,
      nextStep: `If the user requested this operation, restart the local server with ${capabilityVariable}=true, re-run prepare, review and approve the new preview, then execute once. The current receipt cannot survive a restart.`,
    };
  }
  return {
    ready: false,
    blocker: "mainnet execution is disabled",
    nextStep:
      "Use testnet, or after an explicit mainnet decision restart with XROCKET_ALLOW_MAINNET_WRITES=true. Then re-run prepare, review and approve the new preview, and execute once; the current receipt cannot survive a restart.",
  };
}

function prepareInstruction(
  config: XrocketConfig,
  capability: "trading" | "transfers" | "withdrawals",
  executeTool: string,
): string {
  const execution = executionStatus(config, capability);
  return execution.ready
    ? `Review this exact intent, obtain explicit user approval, then pass only the receipt to ${executeTool}.`
    : `Execution is currently blocked. Follow execution.nextStep; do not attempt ${executeTool} with this receipt after restarting.`;
}

export interface CreateServerOptions {
  config?: XrocketConfig;
  fetch?: FetchLike;
  receipts?: ApprovalReceiptStore;
}

export function createXrocketServer(options: CreateServerOptions = {}): McpServer {
  const config = options.config ?? loadConfig();
  const client = new XrocketClient(config, options.fetch);
  const receipts = options.receipts ?? new ApprovalReceiptStore(config.approvalTtlMs);
  const server = new McpServer(
    { name: "xrocket-mcp", version: VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Use xrocket_market_snapshot for broad market questions and xrocket_account_overview for a whole-account read. If the user wants to trade but order tools are unavailable, ask them to sign in to xRocket and run xrocket-mcp trading-config for a local testnet-first trading profile; never ask them to paste the token into chat. Trading requires xrocket_order_prepare, a visible review of the estimate, fees, balances, rules, and exact intent, explicit user approval, then one xrocket_order_execute call with only the receipt. Never retry an unknown write outcome; reconcile it with private read tools.",
    },
  );

  registerPublicXrocketTools(server, client, config.environment);

  if (config.profile === "public") return server;

  server.registerTool(
    "xrocket_account_overview",
    {
      title: "xRocket account overview",
      description:
        "Read funding balances, trading balances, and active orders together. Values are not converted or valued in another asset.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        result: z.object({
          environment: z.string(),
          retrievedAt: z.string(),
          fundingBalances: z.unknown(),
          tradingBalances: z.unknown(),
          activeOrders: z.unknown(),
          valuation: z.literal("not calculated"),
        }),
      }),
      annotations: READ,
    },
    () =>
      runWithText(async () => {
        const [fundingBalances, tradingBalances, activeOrders] = await Promise.all([
          client.getBalances("funding"),
          client.getBalances("trading"),
          client.getOrders("active", {}),
        ]);
        const overview = {
          environment: config.environment,
          retrievedAt: new Date().toISOString(),
          fundingBalances,
          tradingBalances,
          activeOrders,
          valuation: "not calculated" as const,
        };
        return {
          value: overview,
          text: [
            `# xRocket account overview (${config.environment})`,
            "",
            "Funding balances, trading balances, and active orders are included in structured content.",
            "No currency conversion or portfolio valuation was calculated.",
            `Retrieved ${overview.retrievedAt}.`,
          ].join("\n"),
        };
      }),
  );

  server.registerTool(
    "xrocket_account_balances",
    {
      title: "xRocket account balances",
      description: "Read funding, trading, or both account balances using the token from the environment.",
      inputSchema: z.object({ account: z.enum(["funding", "trading", "both"]).default("both") }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ account }) =>
      run(async () => {
        if (account === "both") {
          const [funding, trading] = await Promise.all([
            client.getBalances("funding"),
            client.getBalances("trading"),
          ]);
          return { environment: config.environment, funding, trading };
        }
        return { environment: config.environment, account, data: await client.getBalances(account) };
      }),
  );

  const ordersReadSchema = z
    .object({
      view: z.enum(["active", "history", "one"]),
      orderId: z.string().min(1).max(100).optional(),
      clientOrderId: orderClientIdSchema.optional(),
      symbol: symbolSchema.optional(),
      side: sideSchema.optional(),
      startAt: dateTimeSchema.optional(),
      endAt: dateTimeSchema.optional(),
      currentPage: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      hideCanceled: z.boolean().optional(),
    })
    .refine(
      (value) =>
        value.view !== "one" || value.orderId !== undefined || value.clientOrderId !== undefined,
      { message: "one-order view requires orderId or clientOrderId" },
    );
  server.registerTool(
    "xrocket_orders",
    {
      title: "xRocket orders",
      description: "Read one order, active orders, or paginated order history.",
      inputSchema: ordersReadSchema,
      outputSchema: resultSchema,
      annotations: READ,
    },
    (args) =>
      run(async () => {
        const query =
          args.view === "one"
            ? { orderId: args.orderId, clientOrderId: args.clientOrderId }
            : args.view === "history"
              ? {
                  symbol: args.symbol,
                  side: args.side,
                  startAt: args.startAt,
                  endAt: args.endAt,
                  currentPage: args.currentPage,
                  pageSize: args.pageSize,
                  hideCanceled: args.hideCanceled,
                }
              : {};
        return { environment: config.environment, data: await client.getOrders(args.view, query) };
      }),
  );

  const transfersReadSchema = z
    .object({
      view: z.enum(["history", "one"]),
      transferId: z.string().min(1).max(20).optional(),
      clientTransferId: clientId64Schema.optional(),
      assets: z.array(assetSchema).min(1).max(100).optional(),
      from: z.enum(["funding", "trading"]).optional(),
      to: z.enum(["funding", "trading"]).optional(),
      startAt: dateTimeSchema.optional(),
      endAt: dateTimeSchema.optional(),
      currentPage: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    })
    .refine(
      (value) =>
        value.view !== "one" ||
        value.transferId !== undefined ||
        value.clientTransferId !== undefined,
      { message: "one-transfer view requires transferId or clientTransferId" },
    );
  server.registerTool(
    "xrocket_transfers",
    {
      title: "xRocket internal transfers",
      description: "Read one or paginated funding-to-trading/trading-to-funding transfer records.",
      inputSchema: transfersReadSchema,
      outputSchema: resultSchema,
      annotations: READ,
    },
    (args) =>
      run(async () => {
        const query =
          args.view === "one"
            ? { transferId: args.transferId, clientTransferId: args.clientTransferId }
            : {
                assets: args.assets,
                from: args.from,
                to: args.to,
                startAt: args.startAt,
                endAt: args.endAt,
                currentPage: args.currentPage,
                pageSize: args.pageSize,
              };
        return { environment: config.environment, data: await client.getTransfers(args.view, query) };
      }),
  );

  const withdrawalsReadSchema = z
    .object({
      view: z.enum(["history", "one"]),
      withdrawalId: z.string().min(1).max(20).optional(),
      clientWithdrawalId: clientId50Schema.optional(),
      assets: z.array(assetSchema).min(1).max(100).optional(),
      startAt: dateTimeSchema.optional(),
      endAt: dateTimeSchema.optional(),
      currentPage: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    })
    .refine(
      (value) =>
        value.view !== "one" ||
        value.withdrawalId !== undefined ||
        value.clientWithdrawalId !== undefined,
      { message: "one-withdrawal view requires withdrawalId or clientWithdrawalId" },
    );
  server.registerTool(
    "xrocket_withdrawals",
    {
      title: "xRocket withdrawals",
      description: "Read one external withdrawal or paginated withdrawal history.",
      inputSchema: withdrawalsReadSchema,
      outputSchema: resultSchema,
      annotations: READ,
    },
    (args) =>
      run(async () => {
        const query =
          args.view === "one"
            ? {
                withdrawalId: args.withdrawalId,
                clientWithdrawalId: args.clientWithdrawalId,
              }
            : {
                assets: args.assets,
                startAt: args.startAt,
                endAt: args.endAt,
                currentPage: args.currentPage,
                pageSize: args.pageSize,
              };
        return { environment: config.environment, data: await client.getWithdrawals(args.view, query) };
      }),
  );

  server.registerTool(
    "xrocket_withdrawal_quotas",
    {
      title: "xRocket withdrawal quotas",
      description: "Read current withdrawal minimum, fee, precision, and available quota.",
      inputSchema: z.object({ asset: assetSchema, network: networkSchema }),
      outputSchema: resultSchema,
      annotations: READ,
    },
    ({ asset, network }) =>
      run(async () => ({
        environment: config.environment,
        data: await client.getWithdrawalQuotas(asset, network),
      })),
  );

  if (config.profile !== "full") return server;

  server.registerTool(
    "xrocket_order_prepare",
    {
      title: "Prepare xRocket order",
      description:
        "Estimate an order and issue a short-lived receipt bound to the exact intent. This does not place an order.",
      inputSchema: z.object({ order: orderSchema }),
      outputSchema: resultSchema,
      annotations: PREPARE,
    },
    ({ order }) =>
      run(async () => {
        const [estimate, symbolRules, tradingBalances, tradeFees] = await Promise.all([
          client.estimateOrder(order),
          client.getSymbols(order.symbol),
          client.getBalances("trading"),
          client.getTradeFees([order.symbol]),
        ]);
        const boundIntent = intent(config.environment, order);
        return {
          environment: config.environment,
          order,
          estimate,
          symbolRules,
          tradingBalances: narrowBalances(
            tradingBalances,
            relevantSymbolAssets(symbolRules, order.symbol),
          ),
          tradeFees,
          ...receipts.issue("order", boundIntent),
          writeGate: gateStatus(config, "trading"),
          execution: executionStatus(config, "trading"),
          preview: { operation: "place order", exactIntent: order },
          instruction: prepareInstruction(config, "trading", "xrocket_order_execute"),
        };
      }),
  );

  server.registerTool(
    "xrocket_order_execute",
    {
      title: "Execute xRocket order",
      description: "Place the exact previously prepared order once. Ambiguous outcomes are never retried.",
      inputSchema: z.object({ approvalReceipt: z.string().min(1) }),
      outputSchema: resultSchema,
      annotations: WRITE,
    },
    ({ approvalReceipt }) =>
      run(async () => {
        assertWriteAllowed(config, "trading");
        const stored = receipts.consume("order", approvalReceipt);
        const order = orderSchema.parse(receiptPayload(stored, config.environment));
        return {
          environment: config.environment,
          clientOrderId: order.clientOrderId,
          data: await client.placeOrder(order),
        };
      }),
  );

  server.registerTool(
    "xrocket_order_cancel_prepare",
    {
      title: "Prepare xRocket order cancellation",
      description: "Read the target order and issue a short-lived receipt. This does not cancel it.",
      inputSchema: z.object({ cancellation: cancelIntentSchema }),
      outputSchema: resultSchema,
      annotations: PREPARE,
    },
    ({ cancellation }) =>
      run(async () => {
        const currentOrder = await client.getOrders("one", cancellation);
        const boundIntent = intent(config.environment, cancellation);
        return {
          environment: config.environment,
          cancellation,
          currentOrder,
          ...receipts.issue("order-cancel", boundIntent),
          writeGate: gateStatus(config, "trading"),
          execution: executionStatus(config, "trading"),
          preview: { operation: "cancel order", exactIntent: cancellation },
          instruction: prepareInstruction(
            config,
            "trading",
            "xrocket_order_cancel_execute",
          ),
        };
      }),
  );

  server.registerTool(
    "xrocket_order_cancel_execute",
    {
      title: "Execute xRocket order cancellation",
      description: "Cancel the exact previously prepared order once. Ambiguous outcomes are never retried.",
      inputSchema: z.object({ approvalReceipt: z.string().min(1) }),
      outputSchema: resultSchema,
      annotations: WRITE,
    },
    ({ approvalReceipt }) =>
      run(async () => {
        assertWriteAllowed(config, "trading");
        const stored = receipts.consume("order-cancel", approvalReceipt);
        const cancellation = cancelIntentSchema.parse(
          receiptPayload(stored, config.environment),
        );
        return {
          environment: config.environment,
          identifier: cancellation.orderId ?? cancellation.clientOrderId,
          data: await client.cancelOrder(cancellation),
        };
      }),
  );

  server.registerTool(
    "xrocket_transfer_prepare",
    {
      title: "Prepare xRocket internal transfer",
      description:
        "Read the source balance and issue a short-lived receipt for funding-to-trading or trading-to-funding movement. This does not transfer funds.",
      inputSchema: z.object({ transfer: transferSchema }),
      outputSchema: resultSchema,
      annotations: PREPARE,
    },
    ({ transfer }) =>
      run(async () => {
        const [sourceBalances, assetMetadata] = await Promise.all([
          client.getBalances(transfer.from),
          client.getAssets(transfer.asset),
        ]);
        assertTransferDirectionAvailable(assetMetadata, transfer.from, transfer.to);
        const boundIntent = intent(config.environment, transfer);
        return {
          environment: config.environment,
          transfer,
          sourceBalances: narrowBalances(sourceBalances, [transfer.asset]),
          assetMetadata,
          ...receipts.issue("transfer", boundIntent),
          writeGate: gateStatus(config, "transfers"),
          execution: executionStatus(config, "transfers"),
          preview: { operation: "internal transfer", exactIntent: transfer },
          instruction: prepareInstruction(config, "transfers", "xrocket_transfer_execute"),
        };
      }),
  );

  server.registerTool(
    "xrocket_transfer_execute",
    {
      title: "Execute xRocket internal transfer",
      description:
        "Execute the exact prepared funding/trading transfer once. This is not a user-to-user transfer.",
      inputSchema: z.object({ approvalReceipt: z.string().min(1) }),
      outputSchema: resultSchema,
      annotations: WRITE,
    },
    ({ approvalReceipt }) =>
      run(async () => {
        assertWriteAllowed(config, "transfers");
        const stored = receipts.consume("transfer", approvalReceipt);
        const transfer = transferSchema.parse(receiptPayload(stored, config.environment));
        return {
          environment: config.environment,
          clientTransferId: transfer.clientTransferId,
          data: await client.createTransfer(transfer),
        };
      }),
  );

  server.registerTool(
    "xrocket_withdrawal_prepare",
    {
      title: "Prepare xRocket withdrawal",
      description:
        "Read current funding balances and quota, then issue a short-lived receipt. This does not withdraw funds.",
      inputSchema: z.object({ withdrawal: withdrawalSchema }),
      outputSchema: resultSchema,
      annotations: PREPARE,
    },
    ({ withdrawal }) =>
      run(async () => {
        const [fundingBalances, quota, assetMetadata] = await Promise.all([
          client.getBalances("funding"),
          client.getWithdrawalQuotas(withdrawal.asset, withdrawal.network),
          client.getAssets(withdrawal.asset),
        ]);
        const boundIntent = intent(config.environment, withdrawal);
        return {
          environment: config.environment,
          withdrawal,
          fundingBalances: narrowBalances(fundingBalances, [withdrawal.asset]),
          quota,
          assetMetadata,
          ...receipts.issue("withdrawal", boundIntent),
          writeGate: gateStatus(config, "withdrawals"),
          execution: executionStatus(config, "withdrawals"),
          preview: { operation: "external withdrawal", exactIntent: withdrawal },
          instruction: prepareInstruction(
            config,
            "withdrawals",
            "xrocket_withdrawal_execute",
          ),
        };
      }),
  );

  server.registerTool(
    "xrocket_withdrawal_execute",
    {
      title: "Execute xRocket withdrawal",
      description:
        "Submit the exact prepared external withdrawal once. Ambiguous outcomes are never retried.",
      inputSchema: z.object({
        approvalReceipt: z.string().min(1),
      }),
      outputSchema: resultSchema,
      annotations: WRITE,
    },
    ({ approvalReceipt }) =>
      run(async () => {
        assertWriteAllowed(config, "withdrawals");
        const stored = receipts.consume("withdrawal", approvalReceipt);
        const withdrawal = withdrawalSchema.parse(receiptPayload(stored, config.environment));
        return {
          environment: config.environment,
          clientWithdrawalId: withdrawal.clientWithdrawalId,
          data: await client.createWithdrawal(withdrawal),
        };
      }),
  );

  return server;
}
