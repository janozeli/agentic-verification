// Turns the Stryker and semantic reports of examples/coupon into one table.
// Every number comes from per-test kill data, so subsets of a suite can be
// measured without re-running anything.
import { readFileSync, writeFileSync } from "node:fs";
import { analyze, cover, readReport } from "../src/prune";
import type { SemanticMutant } from "../src/semantic";

const dir = "examples/coupon";
const json = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
const lines = (f: string) => readFileSync(`${dir}/${f}`, "utf8").trimEnd().split("\n").length;

type Suite = {
  tests: { id: string; name: string }[];
  syntactic: Map<string, Set<string>>; // test id -> killed Stryker mutants
  semantic: Map<string, Set<string>>; // test id -> caught semantic mutants
  totalSyntactic: number;
  survivors: string[];
  semanticIds: string[];
};

function load(report: string, semanticFile: string): Suite {
  const r = json(report);
  const { tests, mutants } = readReport(r);
  const sem: SemanticMutant[] = json(semanticFile);
  const syntactic = new Map(tests.map((t) => [t.id, new Set<string>()]));
  const semantic = new Map(tests.map((t) => [t.id, new Set<string>()]));
  for (const m of mutants) if (m.status === "Killed") for (const t of m.killedBy) syntactic.get(t)!.add(m.id);
  const idByName = new Map(tests.map((t) => [t.name, t.id]));
  for (const s of sem) for (const n of s.killedBy) semantic.get(idByName.get(n)!)?.add(s.id);
  return {
    tests,
    syntactic,
    semantic,
    totalSyntactic: mutants.length,
    survivors: mutants.filter((m) => m.status === "Survived").map((m) => `${m.mutator} -> ${m.replacement}`),
    semanticIds: sem.map((s) => s.id),
  };
}

const union = (m: Map<string, Set<string>>, ids: string[]) => new Set(ids.flatMap((id) => [...m.get(id)!]));

const examples = load("reports/mutation.json", "reports/semantic.json");
const props = load("reports/mutation-props.json", "reports/semantic-props.json");

const merged = (s: Suite) =>
  new Map(s.tests.map((t) => [t.id, new Set([...s.syntactic.get(t.id)!, ...s.semantic.get(t.id)!])]));
const allIds = (s: Suite) => s.tests.map((t) => t.id);
const byPrefix = (s: Suite, p: string) => s.tests.filter((t) => t.name.startsWith(p)).map((t) => t.id);

const rows: [string, Suite, string[]][] = [
  ["Agent-style examples", examples, allIds(examples)],
  ["  pruned on Stryker mutants only", examples, cover(examples.syntactic, allIds(examples))],
  ["  pruned on Stryker + semantic mutants", examples, cover(merged(examples), allIds(examples))],
  ["Properties (the model's rules)", props, byPrefix(props, "rules")],
  ["Oracle (verified Dafny model)", props, byPrefix(props, "oracle")],
  ["Properties + oracle", props, allIds(props)],
];

const semanticTotal = examples.semanticIds.length;
const short = (id: string) => id.replace("semantic:", "");
let md = `| Suite | Tests | Stryker mutants killed | Semantic mutants caught | Semantic mutants missed |\n`;
md += `|---|---:|---:|---:|---|\n`;
for (const [label, s, ids] of rows) {
  const sem = union(s.semantic, ids);
  const missed = s.semanticIds.filter((id) => !sem.has(id)).map(short);
  md += `| ${label} | ${ids.length} | ${union(s.syntactic, ids).size} / ${s.totalSyntactic} | ${sem.size} / ${semanticTotal} | ${missed.join(", ") || "none"} |\n`;
}

const lostByStrykerOnly = examples.semanticIds.filter(
  (id) =>
    union(examples.semantic, allIds(examples)).has(id) &&
    !union(examples.semantic, cover(examples.syntactic, allIds(examples))).has(id),
);

md += `\nLines of test code: examples ${lines("test/coupon.test.ts")}, properties + oracle ${lines("test-props/coupon.props.test.ts")}.\n`;
md += `\nStryker survivors, examples: ${examples.survivors.map((s) => `\`${s}\``).join("; ")}.\n`;
md += `Stryker survivors, properties + oracle: ${props.survivors.map((s) => `\`${s}\``).join("; ")}.\n`;
md += `\nSemantic mutants the full example suite catches but the Stryker-only pruning loses: ${lostByStrykerOnly.map(short).join(", ") || "none"}.\n`;
md += `\nVacuous example tests: ${analyze(json("reports/mutation.json"), json("reports/semantic.json")).vacuous.map((t) => `"${t.name}"`).join(", ")}.\n`;

writeFileSync("experiments/results/coupon.md", md);
console.log(md);
