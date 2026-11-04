// A suite in the style coding agents tend to produce: many example-based
// tests, written by looking at the implementation. Kept as-is on purpose.
import { describe, expect, it } from "vitest";
import { applyCoupon, subtotal, type Item } from "../src/coupon";

const one: Item[] = [{ priceCents: 1000, quantity: 1 }];
const two: Item[] = [
  { priceCents: 1000, quantity: 1 },
  { priceCents: 500, quantity: 2 },
];

describe("subtotal", () => {
  it("is defined", () => {
    expect(subtotal).toBeDefined();
  });

  it("returns a number", () => {
    expect(typeof subtotal(one)).toBe("number");
  });

  it("returns 0 for an empty cart", () => {
    expect(subtotal([])).toBe(0);
  });

  it("returns the price of a single item", () => {
    expect(subtotal(one)).toBe(1000);
  });

  it("multiplies price by quantity", () => {
    expect(subtotal([{ priceCents: 500, quantity: 2 }])).toBe(1000);
  });

  it("sums several items", () => {
    expect(subtotal(two)).toBe(2000);
  });

  it("handles quantity 3", () => {
    expect(subtotal([{ priceCents: 100, quantity: 3 }])).toBe(300);
  });

  it("handles a large cart", () => {
    const items = Array.from({ length: 10 }, () => ({ priceCents: 100, quantity: 1 }));
    expect(subtotal(items)).toBe(1000);
  });

  it("does not mutate the input", () => {
    const items = [{ priceCents: 100, quantity: 1 }];
    subtotal(items);
    expect(items).toEqual([{ priceCents: 100, quantity: 1 }]);
  });
});

describe("applyCoupon", () => {
  it("is defined", () => {
    expect(applyCoupon).toBeDefined();
  });

  it("returns a number", () => {
    expect(typeof applyCoupon(one)).toBe("number");
  });

  it("returns the subtotal without a coupon", () => {
    expect(applyCoupon(one)).toBe(1000);
  });

  it("returns the subtotal of several items without a coupon", () => {
    expect(applyCoupon(two)).toBe(2000);
  });

  it("returns 0 for an empty cart without a coupon", () => {
    expect(applyCoupon([])).toBe(0);
  });

  it("applies a 10% coupon", () => {
    expect(applyCoupon(one, { kind: "percent", percent: 10 })).toBe(900);
  });

  it("applies a 20% coupon", () => {
    expect(applyCoupon(one, { kind: "percent", percent: 20 })).toBe(800);
  });

  it("applies a 50% coupon", () => {
    expect(applyCoupon(one, { kind: "percent", percent: 50 })).toBe(500);
  });

  it("applies a 10% coupon to several items", () => {
    expect(applyCoupon(two, { kind: "percent", percent: 10 })).toBe(1800);
  });

  it("applies a 100% coupon", () => {
    expect(applyCoupon(one, { kind: "percent", percent: 100 })).toBe(0);
  });

  it("applies a 0% coupon", () => {
    expect(applyCoupon(one, { kind: "percent", percent: 0 })).toBe(1000);
  });

  it("rounds percent discounts down", () => {
    expect(applyCoupon([{ priceCents: 999, quantity: 1 }], { kind: "percent", percent: 10 })).toBe(900);
  });

  it("applies a fixed coupon", () => {
    expect(applyCoupon(one, { kind: "fixed", amountCents: 300 })).toBe(700);
  });

  it("applies a fixed coupon of 100", () => {
    expect(applyCoupon(one, { kind: "fixed", amountCents: 100 })).toBe(900);
  });

  it("applies a fixed coupon to several items", () => {
    expect(applyCoupon(two, { kind: "fixed", amountCents: 500 })).toBe(1500);
  });

  it("never returns a negative total with a fixed coupon", () => {
    expect(applyCoupon(one, { kind: "fixed", amountCents: 5000 })).toBe(0);
  });

  it("returns 0 when the fixed coupon equals the subtotal", () => {
    expect(applyCoupon(one, { kind: "fixed", amountCents: 1000 })).toBe(0);
  });

  it("returns a non-negative total", () => {
    expect(applyCoupon(one, { kind: "fixed", amountCents: 300 })).toBeGreaterThanOrEqual(0);
  });

  it("ignores the coupon below the minimum subtotal", () => {
    expect(
      applyCoupon(one, { kind: "percent", percent: 10, minSubtotalCents: 5000 }),
    ).toBe(1000);
  });

  it("applies the coupon above the minimum subtotal", () => {
    expect(
      applyCoupon(two, { kind: "percent", percent: 10, minSubtotalCents: 1500 }),
    ).toBe(1800);
  });

  it("ignores a fixed coupon below the minimum subtotal", () => {
    expect(
      applyCoupon(one, { kind: "fixed", amountCents: 300, minSubtotalCents: 5000 }),
    ).toBe(1000);
  });

  it("does not throw with a coupon", () => {
    expect(() => applyCoupon(one, { kind: "percent", percent: 10 })).not.toThrow();
  });
});
