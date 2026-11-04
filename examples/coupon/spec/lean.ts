// The Lean model as an external process: every case goes through one pipe,
// one JSON line per case, like `gen | oracle`. Build it with `mise run lean`.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Coupon, Item } from "../src/coupon";

const binary =
  process.env.LEAN_ORACLE ?? fileURLToPath(new URL("../lean/.lake/build/bin/oracle", import.meta.url));

export type Case = [Item[], Coupon | undefined];

export function leanApplyCoupon(cases: Case[]): number[] {
  const input = cases.map(([items, coupon]) => JSON.stringify({ items, coupon: coupon ?? null })).join("\n");
  const run = spawnSync(binary, { input: `${input}\n`, encoding: "utf8", maxBuffer: 1 << 26 });
  if (run.error) throw new Error(`Lean oracle not found at ${binary}; run \`mise run lean\``);
  const lines = run.stdout.trimEnd().split("\n").map((l) => JSON.parse(l));
  if (lines.length !== cases.length) throw new Error(`Lean oracle answered ${lines.length} of ${cases.length} cases`);
  return lines.map((l, i) => {
    if ("error" in l) throw new Error(`Lean oracle rejected case ${i}: ${l.error}`);
    return l.out;
  });
}
