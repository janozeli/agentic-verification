// Usage: bun src/cli.ts <stryker-report.json> [--semantic kills.json] [--apply] [--strict]
//   --semantic  also count semantic mutants (output of src/semantic.ts)
//   --apply     delete the vacuous and redundant tests from the test files
//   --strict    exit with code 1 when there is anything to remove
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { analyze, type TestCase } from "./prune";
import { removeCalls } from "./remove";

const args = process.argv.slice(2);
const semanticPath = args.includes("--semantic") ? args[args.indexOf("--semantic") + 1] : undefined;
const reportPath = args.find((a) => !a.startsWith("--") && a !== semanticPath);
if (!reportPath) {
  console.error("usage: prune <stryker-report.json> [--semantic kills.json] [--apply] [--strict]");
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const semantic = semanticPath ? JSON.parse(readFileSync(semanticPath, "utf8")) : [];
const root: string = report.projectRoot ?? process.cwd();
const at = (file: string, line?: number) =>
  `${relative(process.cwd(), join(root, file))}:${line ?? 1}`;

const a = analyze(report, semantic);
const removable = [...a.vacuous, ...a.redundant];

const n = (k: number, word: string) => `${k} ${word}${k === 1 ? "" : "s"}`;
console.log(
  `${n(a.tests.length, "test")}, ${n(a.killedCount, "mutant")} killed. ` +
    `${n(a.kept.length, "test")} kill${a.kept.length === 1 ? "s" : ""} the same ${a.killedCount}.`,
);
for (const t of a.vacuous) console.log(`${at(t.file, t.line)}: vacuous, kills no mutant: ${t.name}`);
for (const t of a.redundant) console.log(`${at(t.file, t.line)}: redundant, kept tests already kill what it kills: ${t.name}`);
for (const m of a.survived) {
  console.log(`${at(m.file, m.line)}: no test rejects ${m.mutator} -> ${m.replacement.split("\n")[0]}`);
}

if (args.includes("--apply") && removable.length > 0) {
  const byFile = new Map<string, TestCase[]>();
  for (const t of removable) byFile.set(t.file, [...(byFile.get(t.file) ?? []), t]);
  for (const [file, tests] of byFile) {
    if (tests.some((t) => t.line === undefined)) {
      console.error(`${file}: report has no test locations, skipping`);
      continue;
    }
    const path = join(root, file);
    writeFileSync(path, removeCalls(readFileSync(path, "utf8"), tests.map((t) => t.line!)));
    console.log(`removed ${tests.length} tests from ${relative(process.cwd(), path)}`);
  }
}

if (args.includes("--strict") && removable.length > 0) process.exit(1);
