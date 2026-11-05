// Does an input generator reach the boundaries of the specification?
// Answered from the verified model alone, before any implementation exists:
// shift each comparison in the compiled Dafny model (`<` <-> `<=`) and check
// whether the generated inputs tell the shifted model from the original.
// An exhaustive pass over a small domain separates real boundaries from
// shifts that change nothing (equivalent).
import fc from "fast-check";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { Coupon, Item } from "../examples/coupon/src/coupon";
import { makeCart } from "../examples/coupon/test-props/arbitraries";

const require = createRequire(import.meta.url);
const specDir = resolve("examples/coupon/spec");
const source = readFileSync(`${specDir}/model.cjs`, "utf8");
const BigNumber = require(`${specDir}/../../../node_modules/bignumber.js`);

type Case = [Item[], Coupon | undefined];
type Model = (c: Case) => number;

const load = (text: string, tag: string): Model => {
  const file = `${specDir}/.boundary-${tag}.cjs`;
  writeFileSync(file, text);
  const { _dafny, CouponModel } = require(file);
  rmSync(file);
  const big = (n: number) => new BigNumber(n);
  return ([items, c]) =>
    CouponModel.__default
      .Total(
        _dafny.Seq.of(...items.map((i) => big(i.priceCents))),
        _dafny.Seq.of(...items.map((i) => big(i.quantity))),
        big(!c ? 0 : c.kind === "percent" ? 1 : 2),
        big(!c ? 0 : c.kind === "percent" ? c.percent : c.amountCents),
        big(c?.minSubtotalCents ?? -1),
      )
      .toNumber();
};

// Comparisons inside the model's functions, not the Dafny runtime.
const start = source.indexOf("$module.__default = class __default");
const end = source.indexOf("$module.Item = class Item");
const swap: Record<string, string> = {
  ".isLessThan(": ".isLessThanOrEqualTo(",
  ".isLessThanOrEqualTo(": ".isLessThan(",
};
const shifts = [...source.slice(start, end).matchAll(/\.isLessThan(OrEqualTo)?\(/g)].map((m) => {
  const at = start + m.index!;
  const fn = [...source.slice(start, at).matchAll(/static (\w+)\(/g)].pop()![1];
  const line = source.slice(source.lastIndexOf("\n", at) + 1, source.indexOf("\n", at)).trim();
  return { fn, line, text: source.slice(0, at) + swap[m[0]] + source.slice(at + m[0].length) };
});

const original = load(source, "original");

// Small exhaustive domain: up to two items, every coupon shape.
const small: Case[] = [];
const itemsSmall: Item[][] = [[]];
for (const p of [0, 1, 2, 3]) for (const q of [0, 1, 2]) itemsSmall.push([{ priceCents: p, quantity: q }]);
for (const p of [1, 3]) for (const r of [2, 5]) itemsSmall.push([{ priceCents: p, quantity: 1 }, { priceCents: r, quantity: 2 }]);
for (const its of itemsSmall) {
  small.push([its, undefined]);
  for (const min of [undefined, 0, 1, 2, 3, 5, 7, 13]) {
    for (const percent of [-1, 0, 1, 50, 99, 100, 101]) small.push([its, { kind: "percent", percent, minSubtotalCents: min }]);
    for (const amountCents of [0, 1, 2, 3, 5, 7, 13]) small.push([its, { kind: "fixed", amountCents, minSubtotalCents: min }]);
  }
}

const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const reached = (m: Model, cases: Case[]) => cases.some((c) => m(c) !== original(c));
const seedsReaching = (m: Model, uniform: boolean) =>
  seeds.filter((seed) => reached(m, fc.sample(makeCart(uniform), { numRuns: 300, seed }))).length;

let md = "| Model function | Comparison shifted | Real boundary (exhaustive small domain) | Biased inputs reach it | Uniform inputs reach it |\n";
md += "|---|---|---|---:|---:|\n";
shifts.forEach((s, i) => {
  const m = load(s.text, String(i));
  const real = reached(m, small);
  md += `| ${s.fn} | \`${s.line.replace(/\|/g, "\\|")}\` | ${real ? "yes" : "no, equivalent"} | ${seedsReaching(m, false)} / 10 | ${seedsReaching(m, true)} / 10 |\n`;
});

writeFileSync("experiments/results/boundaries.md", md);
console.log(md);
