import { describe, it, expect } from "vitest";
import { computeDocTotals, deriveBaseSubtotal } from "./money";

describe("computeDocTotals without line items", () => {
  it("does not apply the discount a second time", () => {
    // base 100, 10% tax, 10 fixed discount → stored total 100
    const t = computeDocTotals({ amount: "100.00", taxRate: 10, discount: 10, discountType: "fixed" });
    expect(t).toMatchObject({ subtotal: 100, tax: 10, discountAmount: 10, total: 100 });
  });

  it("handles percentage discounts", () => {
    expect(deriveBaseSubtotal(99, 10, 20, "percentage")).toBeCloseTo(110);
    expect(computeDocTotals({ amount: 99, taxRate: 10, discount: 20, discountType: "percentage" }).total).toBe(99);
  });

  it("still computes from items when present", () => {
    const t = computeDocTotals({ items: [{ description: "a", quantity: 2, unitPrice: 50 }], taxRate: 10 });
    expect(t.total).toBe(110);
  });
});
