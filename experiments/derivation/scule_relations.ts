// Can the cases that pruning lost in scule be derived from the cases it kept?
//
// Axioms are relations between scule's functions on the same input, read
// from its source and README: every converter is splitByCase plus a fixed
// recipe, camelCase is lowerFirst of pascalCase, snake and flat case are
// kebab case with another joiner. Each axiom is first checked against the
// library on generated inputs. Then the facts the kept tests check (each
// call with its output) are closed under the axioms, and each lost test is
// derivable if all of its calls land in that closure with the same output.
//
// Run offline: corpus/offline bun experiments/derivation/scule_relations.ts
import fc from "fast-check";
import { readFileSync, writeFileSync } from "node:fs";
import { inspect } from "node:util";
import * as scule from "../../vendor/scule/src/index";
import { readReport } from "../../src/prune";

type Call = { fn: string; args: unknown[]; out: unknown };
const render = (args: unknown[]) =>
  inspect(args, { depth: 50, sorted: true, maxArrayLength: Infinity, maxStringLength: Infinity, breakLength: Infinity, getters: false });
const key = (fn: string, args: unknown[]) => `${fn}${render(args)}`;

const lower = (s: string) => s.toLowerCase();
const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : "");
const minor = /^(a|an|and|as|at|but|by|for|if|in|is|nor|of|on|or|the|to|with)$/i;
const norm = { normalize: true };

// Each axiom: from one known call, the calls it determines.
type Axiom = { name: string; derive: (c: Call) => Call[] };
const AXIOMS: Axiom[] = [
  {
    name: "converters are splitByCase plus a recipe",
    derive: (c) => {
      if (c.fn !== "splitByCase" || c.args.length !== 1 || typeof c.args[0] !== "string") return [];
      const x = c.args[0] as string;
      const parts = c.out as string[];
      const kebab = (j: string) => (x ? parts.map(lower).join(j) : "");
      const pascal = (n: boolean) => (x ? parts.map((p) => upperFirst(n ? lower(p) : p)).join("") : "");
      const train = (n: boolean) => parts.filter(Boolean).map((p) => upperFirst(n ? lower(p) : p)).join("-");
      return [
        { fn: "kebabCase", args: [x], out: kebab("-") },
        { fn: "snakeCase", args: [x], out: kebab("_") },
        { fn: "flatCase", args: [x], out: kebab("") },
        { fn: "pascalCase", args: [x], out: pascal(false) },
        { fn: "pascalCase", args: [x, norm], out: pascal(true) },
        { fn: "trainCase", args: [x], out: train(false) },
        { fn: "trainCase", args: [x, norm], out: train(true) },
        {
          fn: "titleCase",
          args: [x],
          out: parts.filter(Boolean).map((p) => (minor.test(p) ? lower(p) : upperFirst(p))).join(" "),
        },
      ];
    },
  },
  {
    name: "camelCase is lowerFirst of pascalCase",
    derive: (c) => (c.fn === "pascalCase" && typeof c.args[0] === "string" ? [{ fn: "camelCase", args: c.args, out: lowerFirst(c.out as string) }] : []),
  },
  {
    name: "snake and flat case are kebab case with another joiner",
    derive: (c) =>
      c.fn === "kebabCase" && c.args.length === 1 && typeof c.args[0] === "string"
        ? [
            { fn: "snakeCase", args: c.args, out: (c.out as string).replaceAll("-", "_") },
            { fn: "flatCase", args: c.args, out: (c.out as string).replaceAll("-", "") },
          ]
        : [],
  },
];

// 1. Check every axiom against the library itself.
const word = fc.stringMatching(/^[a-zA-Z0-9_\-/.éÉßİ]{0,12}$/);
const call = (fn: string, args: unknown[]) => (scule as Record<string, (...a: unknown[]) => unknown>)[fn](...args);
const axiomChecks = AXIOMS.map((axiom) => {
  const seeds = ["splitByCase", "pascalCase", "kebabCase"];
  let counterexample: string | undefined;
  try {
    fc.assert(
      fc.property(word, (x) => {
        for (const fn of seeds) {
          const known: Call = { fn, args: [x], out: call(fn, [x]) };
          for (const d of axiom.derive(known)) {
            const actual = call(d.fn, d.args);
            if (actual !== d.out) {
              counterexample = `${d.fn}(${JSON.stringify(x)}): derived ${JSON.stringify(d.out)}, library ${JSON.stringify(actual)}`;
              return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 5000, seed: 42 },
    );
  } catch {}
  return { name: axiom.name, holds: !counterexample, counterexample };
});
const valid = AXIOMS.filter((_, i) => axiomChecks[i].holds);

// 2. Close the kept facts under the valid axioms; check the lost tests.
let md = "Axioms, checked against scule on 5,000 generated inputs each:\n\n| Axiom | Holds |\n|---|---|\n";
for (const a of axiomChecks) md += `| ${a.name} | ${a.holds ? "yes" : `no: ${a.counterexample}`} |\n`;
md += "\n| Suite | Lost tests | Derivable from kept facts + axioms | Derived value contradicts the test |\n|---|---:|---:|---:|\n";

for (const suite of ["human", "agent"]) {
  const calls = readFileSync(`vendor/scule/.cases/${suite}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const keptNames = new Set(readReport(JSON.parse(readFileSync(`vendor/.verify/scule-${suite}/reports/mutation-${suite}.json`, "utf8"))).tests.map((t) => t.name));
  const lost: string[] = JSON.parse(readFileSync(`vendor/scule/.cases-result-${suite}.json`, "utf8")).lost;

  const known = new Map<string, unknown>();
  const frontier: Call[] = [];
  for (const c of calls) if (keptNames.has(c.test)) { known.set(c.key, c.call.out); frontier.push(c.call); }
  while (frontier.length) {
    const c = frontier.pop()!;
    for (const a of valid) for (const d of a.derive(c)) {
      const k = key(d.fn, d.args);
      if (!known.has(k)) { known.set(k, d.out); frontier.push(d); }
    }
  }

  let derivable = 0;
  let contradictions = 0;
  for (const name of lost) {
    const own = calls.filter((c) => c.test === name);
    const ok = own.every((c) => known.has(c.key) && JSON.stringify(known.get(c.key)) === JSON.stringify(c.call.out));
    if (own.some((c) => known.has(c.key) && JSON.stringify(known.get(c.key)) !== JSON.stringify(c.call.out))) contradictions++;
    if (own.length && ok) derivable++;
  }
  md += `| ${suite} | ${lost.length} | ${derivable} | ${contradictions} |\n`;
}

writeFileSync("experiments/results/derivation-scule.md", md);
console.log(md);
