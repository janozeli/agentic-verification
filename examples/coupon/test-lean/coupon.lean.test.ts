// The implementation against the Lean model, run as an external process.
// Cases are generated up front and sent through one pipe, so there is no
// shrinking: the smallest mismatching case is reported instead.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyCoupon } from "../src/coupon";
import { leanApplyCoupon, type Case } from "../spec/lean";
import { modelApplyCoupon } from "../spec/model";
import { cart, seed } from "../test-props/arbitraries";

const cases: Case[] = fc.sample(cart, { numRuns: 300, seed });
const size = (c: Case) => JSON.stringify(c).length;

const smallestMismatch = (actual: (c: Case) => number, expected: number[]) =>
  cases
    .map((c, i) => ({ items: c[0], coupon: c[1], actual: actual(c), expected: expected[i] }))
    .filter((m) => m.actual !== m.expected)
    .sort((a, b) => size([a.items, a.coupon]) - size([b.items, b.coupon]))[0];

describe("oracle", () => {
  it("matches the Lean model", () => {
    expect(smallestMismatch((c) => applyCoupon(...c), leanApplyCoupon(cases))).toBeUndefined();
  });
});

// Two formal models written separately should define the same function.
// This checks the specifications, not the code, so mutants never fail it.
describe("models", () => {
  it("Lean and Dafny agree", () => {
    expect(smallestMismatch((c) => modelApplyCoupon(...c), leanApplyCoupon(cases))).toBeUndefined();
  });
});
