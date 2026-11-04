// Formal back to native. Two kinds of tests:
//  1. TLC counterexamples from spec/Redemption.tla, replayed step by step.
//  2. The same properties checked over interleavings that fast-check explores,
//     the native analogue of what TLC does on the model.
// Tests marked `it.fails` document known violations in the flawed designs.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redeem, redeemCheckThenAct, redeemReserveLeaky, Store, type Outcome } from "../src/redemption";

fc.configureGlobal({ seed: 42, numRuns: 200 });

const LIMIT = 2;
const ok = () => Promise.resolve(true);
const fail = () => Promise.resolve(false);
const confirmed = (os: Outcome[]) => os.filter((o) => o === "confirmed").length;

describe("TLC counterexamples, replayed", () => {
  // CheckThenAct.cfg: c1 redeems alone, then c2 and c3 both read 1 before either writes.
  const overRedeem = async (redeemOne: (s: Store) => Promise<Outcome>) => {
    const store = new Store();
    const first = await redeemOne(store);
    const rest = await Promise.all([redeemOne(store), redeemOne(store)]);
    return confirmed([first, ...rest]);
  };

  it.fails("check-then-act never over-redeems", async () => {
    expect(await overRedeem((s) => redeemCheckThenAct(s, "X", LIMIT))).toBeLessThanOrEqual(LIMIT);
  });

  it("reserve never over-redeems", async () => {
    expect(await overRedeem((s) => redeem(s, "X", LIMIT, ok))).toBeLessThanOrEqual(LIMIT);
  });

  // ReserveLeaky.cfg: c3 reserves and fails to pay, c1 reserves, c2 is turned
  // away, c1 fails to pay. Two promises broken, one sale lost.
  const lostSale = async (redeemOne: typeof redeem) => {
    const store = new Store();
    await redeemOne(store, "X", LIMIT, fail); // c3
    const c1 = redeemOne(store, "X", LIMIT, fail);
    const c2 = await redeemOne(store, "X", LIMIT, ok);
    await c1;
    return c2;
  };

  it.fails("leaky reserve keeps its promises", async () => {
    expect(await lostSale(redeemReserveLeaky)).toBe("confirmed");
  });

  it("reserve keeps its promises", async () => {
    expect(await lostSale(redeem)).toBe("confirmed");
  });
});

describe("interleavings explored by fast-check", () => {
  const neverOverRedeems = (redeemOne: (s: Store) => Promise<Outcome>) =>
    fc.assert(
      fc.asyncProperty(fc.scheduler(), async (s) => {
        const store = new Store(() => s.schedule(Promise.resolve()));
        const outcomes = await s.waitFor(Promise.all([1, 2, 3].map(() => redeemOne(store))));
        expect(confirmed(outcomes)).toBeLessThanOrEqual(LIMIT);
      }),
    );

  it.fails("check-then-act never over-redeems", () =>
    neverOverRedeems((s) => redeemCheckThenAct(s, "X", LIMIT)),
  );

  it("reserve never over-redeems", () => neverOverRedeems((s) => redeem(s, "X", LIMIT, ok)));

  // Promise: once everything settles, every slot taken belongs to a confirmed
  // checkout. Payment outcomes are generated too.
  const keepsPromises = (redeemOne: typeof redeem) =>
    fc.assert(
      fc.asyncProperty(fc.scheduler(), fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }), async (s, pays) => {
        const store = new Store(() => s.schedule(Promise.resolve()));
        const runs = pays.map((p) => redeemOne(store, "X", LIMIT, () => Promise.resolve(p)));
        const outcomes = await s.waitFor(Promise.all(runs));
        expect(outcomes).not.toContain("abandoned");
        expect(await s.waitFor(store.get("X"))).toBe(confirmed(outcomes));
      }),
    );

  it.fails("leaky reserve keeps its promises", () => keepsPromises(redeemReserveLeaky));

  it("reserve keeps its promises", () => keepsPromises(redeem));
});
