// The same rules the Dafny model proves, checked on the implementation with
// generated inputs, plus one test that compares against the model itself.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyCoupon, subtotal, type Coupon, type Item } from "../src/coupon";
import { modelApplyCoupon } from "../spec/model";

fc.configureGlobal({ seed: Number(process.env.SEED ?? 42), numRuns: 300 });

const item: fc.Arbitrary<Item> = fc.record({
  priceCents: fc.integer({ min: 0, max: 10_000 }),
  quantity: fc.integer({ min: 0, max: 5 }),
});
const items = fc.array(item, { maxLength: 5 });

// Minimums near the subtotal on purpose: boundaries are where rules break.
// MINIMUM=uniform turns the bias off (see experiments/generators.sh).
const minimum = (sub: number) =>
  fc.option(
    process.env.MINIMUM === "uniform"
      ? fc.integer({ min: 0, max: 60_000 })
      : fc.oneof(
          fc.constant(sub),
          fc.constant(sub + 1),
          fc.constant(Math.max(0, sub - 1)),
          fc.integer({ min: 0, max: 60_000 }),
        ),
    { nil: undefined },
  );

const coupon = (sub: number): fc.Arbitrary<Coupon> =>
  fc.oneof(
    fc.record({
      kind: fc.constant("percent" as const),
      percent: fc.integer({ min: -50, max: 150 }),
      minSubtotalCents: minimum(sub),
    }),
    fc.record({
      kind: fc.constant("fixed" as const),
      amountCents: fc.integer({ min: 0, max: 60_000 }),
      minSubtotalCents: minimum(sub),
    }),
  );

const cart = items.chain((its) =>
  fc.tuple(fc.constant(its), fc.option(coupon(subtotal(its)), { nil: undefined })),
);

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
