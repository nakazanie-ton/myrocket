import { describe, expect, it } from "vitest";
import { ApprovalReceiptStore, stableCanonicalJson } from "../src/receipts.js";

describe("ApprovalReceiptStore", () => {
  it("binds a single-use receipt to kind and exact canonical intent", () => {
    const store = new ApprovalReceiptStore(60_000, () => 1_000);
    const intent = { amount: "1.00", nested: { b: 2, a: 1 } };
    const issued = store.issue("transfer", intent);

    expect(store.consume("transfer", issued.approvalReceipt)).toEqual(intent);
    expect(() => store.consume("transfer", issued.approvalReceipt)).toThrow("already been consumed");
  });

  it("returns the exact stored decimal intent and rejects changed operation kinds", () => {
    const store = new ApprovalReceiptStore(60_000, () => 1_000);
    const issued = store.issue("withdrawal", { amount: "1.00" });
    expect(() => store.consume("transfer", issued.approvalReceipt)).toThrow(
      "does not match this operation type",
    );
    expect(store.consume("withdrawal", issued.approvalReceipt)).toEqual({ amount: "1.00" });
  });

  it("expires receipts fail closed", () => {
    let now = 1_000;
    const store = new ApprovalReceiptStore(1_000, () => now);
    const issued = store.issue("order", { clientOrderId: "a" });
    now = 2_000;
    expect(() => store.consume("order", issued.approvalReceipt)).toThrow("expired");
  });

  it("has deterministic canonical JSON without numeric coercion", () => {
    expect(stableCanonicalJson({ b: "1.00", a: ["2", "3"] })).toBe(
      '{"a":["2","3"],"b":"1.00"}',
    );
  });
});
