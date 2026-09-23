import { describe, it, expect } from "vitest";
import { formatAccountAmount, parseMoneyInput } from "./account-money";

describe("account-money", () => {
  it("formats cents in the account currency", () => {
    expect(formatAccountAmount(123450, "USD")).toBe("$1,234.50");
    expect(formatAccountAmount(-500, "EUR")).toBe("-€5.00");
    expect(formatAccountAmount(100, "NOTACODE")).toBe("NOTACODE 1.00");
  });
  it("parses money inputs", () => {
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("1,250.505")).toBe(1250.51);
    expect(parseMoneyInput("-20")).toBe(-20);
    expect(parseMoneyInput("abc")).toBeNull();
  });
});
