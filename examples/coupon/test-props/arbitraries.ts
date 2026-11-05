// Generators shared by the property suites.
import fc from "fast-check";
import { subtotal, type Coupon, type Item } from "../src/coupon";

export const seed = Number(process.env.SEED ?? 42);

export const item: fc.Arbitrary<Item> = fc.record({
  priceCents: fc.integer({ min: 0, max: 10_000 }),
  quantity: fc.integer({ min: 0, max: 5 }),
});
export const items = fc.array(item, { maxLength: 5 });

// Minimums near the subtotal on purpose: boundaries are where rules break.
// MINIMUM=uniform turns the bias off (see experiments/generators.sh).
const uniformByDefault = process.env.MINIMUM === "uniform";

export const minimum = (sub: number, uniform = uniformByDefault) =>
  fc.option(
    uniform
      ? fc.integer({ min: 0, max: 60_000 })
      : fc.oneof(
          fc.constant(sub),
          fc.constant(sub + 1),
          fc.constant(Math.max(0, sub - 1)),
          fc.integer({ min: 0, max: 60_000 }),
        ),
    { nil: undefined },
  );

export const coupon = (sub: number, uniform = uniformByDefault): fc.Arbitrary<Coupon> =>
  fc.oneof(
    fc.record({
      kind: fc.constant("percent" as const),
      percent: fc.integer({ min: -50, max: 150 }),
      minSubtotalCents: minimum(sub, uniform),
    }),
    fc.record({
      kind: fc.constant("fixed" as const),
      amountCents: fc.integer({ min: 0, max: 60_000 }),
      minSubtotalCents: minimum(sub, uniform),
    }),
  );

export const makeCart = (uniform = uniformByDefault) =>
  items.chain((its) =>
    fc.tuple(fc.constant(its), fc.option(coupon(subtotal(its), uniform), { nil: undefined })),
  );

export const cart = makeCart();
