// Summarizes the corpus study. For each library and suite (human-written,
// agent-written): Stryker mutants detected and semantic mutants caught, before
// and after pruning. "After" is measured on a pruned copy, not computed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cover, readReport } from "../src/prune";
import type { SemanticMutant } from "../src/semantic";

const libraries = Object.keys(JSON.parse(readFileSync("corpus/libraries.json", "utf8")));
const json = (f: string) => JSON.parse(readFileSync(f, "utf8"));

function measure(mutationFile: string, semanticFile: string) {
  const { tests, mutants } = readReport(json(mutationFile));
  const semantic: SemanticMutant[] = json(semanticFile);
  return {
    tests,
    mutants,
    semantic,
    definitions: new Set(tests.map((t) => `${t.file}:${t.line}`)).size,
    detected: mutants.filter((m) => m.status === "Killed" || m.status === "Timeout").length,
    caught: semantic.filter((s) => s.killedBy.length > 0).length,
  };
}

let md =
  "| Library | Suite | Tests | Stryker detected | Semantic caught | Pruned: tests | Pruned: Stryker detected | Pruned: semantic caught | Semantic lost if pruned on Stryker only |\n";
md += "|---|---|---:|---:|---:|---:|---:|---:|---:|\n";
const notes: string[] = [];

for (const lib of libraries) {
  for (const suite of ["human", "agent"]) {
    const dir = `vendor/${lib}/reports`;
    if (!existsSync(`${dir}/mutation-${suite}.json`)) continue;
    const before = measure(`${dir}/mutation-${suite}.json`, `${dir}/semantic-${suite}.json`);
    const after = measure(`${dir}/pruned/mutation-${suite}.json`, `${dir}/pruned/semantic-${suite}.json`);

    // What pruning on Stryker mutants alone would have lost (computed).
    const ids = before.tests.map((t) => t.id);
    const idByName = new Map(before.tests.map((t) => [t.name, t.id]));
    const syntactic = new Map(ids.map((id) => [id, new Set<string>()]));
    for (const m of before.mutants) if (m.status === "Killed") for (const t of m.killedBy) syntactic.get(t)?.add(m.id);
    const keptSyntactic = new Set(cover(syntactic, ids));
    const lost = before.semantic.filter(
      (s) => s.killedBy.length > 0 && !s.killedBy.some((n) => keptSyntactic.has(idByName.get(n) ?? "")),
    ).length;

    const total = before.mutants.length;
    md += `| ${lib} | ${suite} | ${before.tests.length} | ${before.detected} / ${total} | ${before.caught} / ${before.semantic.length} | `;
    md += `${after.tests.length} | ${after.detected} / ${total} | ${after.caught} / ${after.semantic.length} | ${lost} |\n`;

    const missed = before.semantic.filter((s) => s.killedBy.length === 0).map((s) => s.id.replace("semantic:", ""));
    if (missed.length) notes.push(`- ${lib}, ${suite}: ${missed.join(", ")}.`);
    const log = readFileSync(`${dir}/pruned/${suite}.log`, "utf8").split("\n").find((l) => l.includes("definition"));
    notes.push(`- ${lib}, ${suite} pruning: ${log?.trim()}`);
  }
}
md += `\nNotes (semantic mutants missed, and what pruning could delete in source):\n${notes.join("\n")}\n`;

writeFileSync("experiments/results/corpus.md", md);
console.log(md);
