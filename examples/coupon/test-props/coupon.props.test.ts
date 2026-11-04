// The same rules the Dafny model proves, checked on the implementation with
// generated inputs, plus one test that compares against the model itself.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyCoupon, subtotal } from "../src/coupon";
import { modelApplyCoupon } from "../spec/model";
import { cart, items, seed } from "./arbitraries";

fc.configureGlobal({ seed, numRuns: 300 });

describe("oracle", () => {
  it("matches the verified model", () => {
    fc.assert(
      fc.property(cart, ([its, c]) => {
        expect(applyCoupon(its, c)).toBe(modelApplyCoupon(its, c));
      }),
    );
  });
});

describe("rules", () => {
  it("never goes above the subtotal or below zero", () => {
    fc.assert(
      fc.property(cart, ([its, c]) => {
        const total = applyCoupon(its, c);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(total).toBeLessThanOrEqual(subtotal(its));
      }),
    );
  });

  it("reaching the minimum exactly is enough", () => {
    fc.assert(
      fc.property(items, fc.integer({ min: 0, max: 100 }), (its, percent) => {
        const sub = subtotal(its);
        expect(applyCoupon(its, { kind: "percent", percent, minSubtotalCents: sub })).toBe(
          applyCoupon(its, { kind: "percent", percent }),
        );
      }),
    );
  });

  it("a bigger percentage never costs more", () => {
    fc.assert(
      fc.property(items, fc.integer({ min: -50, max: 150 }), fc.integer({ min: 0, max: 100 }), (its, p, d) => {
        expect(applyCoupon(its, { kind: "percent", percent: p + d })).toBeLessThanOrEqual(
          applyCoupon(its, { kind: "percent", percent: p }),
        );
      }),
    );
  });

  it("rounds percent discounts down", () => {
    fc.assert(
      fc.property(items, fc.integer({ min: 0, max: 100 }), (its, percent) => {
        const sub = subtotal(its);
        const discount = sub - applyCoupon(its, { kind: "percent", percent });
        expect(discount * 100).toBeLessThanOrEqual(sub * percent);
        expect((discount + 1) * 100).toBeGreaterThan(sub * percent);
      }),
    );
  });
});
