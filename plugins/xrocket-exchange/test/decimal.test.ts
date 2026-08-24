import { describe, expect, it } from "vitest";
import {
  addDecimals,
  compareDecimals,
  multiplyDecimals,
  subtractDecimals,
  sumDecimals,
} from "../src/decimal.js";

describe("exact decimal arithmetic", () => {
  it("does not use binary floating-point for money limits", () => {
    expect(addDecimals("0.1", "0.2")).toBe("0.3");
    expect(subtractDecimals("10.000", "0.125")).toBe("9.875");
    expect(multiplyDecimals("2.50", "3.20")).toBe("8");
    expect(sumDecimals(["0.01", "1.999", "8"])).toBe("10.009");
    expect(compareDecimals("10.000", "10")).toBe(0);
    expect(compareDecimals("999999999999999999.99", "999999999999999999.98")).toBe(1);
  });
});
