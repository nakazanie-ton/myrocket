import { createHash, randomUUID } from "node:crypto";
import { ApprovalReceiptError } from "./errors.js";

export type ApprovalKind = "order" | "order-cancel" | "transfer" | "withdrawal";

interface ReceiptRecord {
  kind: ApprovalKind;
  digest: string;
  intent: unknown;
  expiresAt: number;
  consumed: boolean;
}

export interface IssuedReceipt {
  approvalReceipt: string;
  expiresAt: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function digestIntent(kind: ApprovalKind, intent: unknown): string {
  return createHash("sha256").update(canonicalize({ kind, intent })).digest("hex");
}

export class ApprovalReceiptStore {
  private readonly receipts = new Map<string, ReceiptRecord>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  issue(kind: ApprovalKind, intent: unknown): IssuedReceipt {
    this.prune();
    const opaqueId = randomUUID();
    const digest = digestIntent(kind, intent);
    const approvalReceipt = `xr1.${opaqueId}.${digest.slice(0, 12)}`;
    const expiresAt = this.now() + this.ttlMs;
    this.receipts.set(approvalReceipt, {
      kind,
      digest,
      intent: structuredClone(intent),
      expiresAt,
      consumed: false,
    });
    return { approvalReceipt, expiresAt: new Date(expiresAt).toISOString() };
  }

  consume(kind: ApprovalKind, approvalReceipt: string): unknown {
    const record = this.receipts.get(approvalReceipt);
    if (!record) throw new ApprovalReceiptError("approval receipt is unknown or expired");
    if (record.consumed) throw new ApprovalReceiptError("approval receipt has already been consumed");
    if (record.expiresAt <= this.now()) {
      this.receipts.delete(approvalReceipt);
      throw new ApprovalReceiptError("approval receipt has expired; prepare the operation again");
    }
    if (record.kind !== kind) {
      throw new ApprovalReceiptError("approval receipt does not match this operation type");
    }
    record.consumed = true;
    return structuredClone(record.intent);
  }

  private prune(): void {
    const now = this.now();
    for (const [receipt, record] of this.receipts) {
      if (record.expiresAt <= now) this.receipts.delete(receipt);
    }
  }
}

export const stableCanonicalJson = canonicalize;
