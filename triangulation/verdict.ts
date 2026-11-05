import { readFileSync } from "node:fs";
import { analyze } from "../src/prune";

const [reportPath, semanticPath] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const a = analyze(report, JSON.parse(readFileSync(semanticPath, "utf8")));
const names = (ts: { name: string }[]) => ts.map((t) => t.name);

console.log(
  JSON.stringify({
    kept: names(a.kept),
    vacuous: names(a.vacuous),
    redundant: names(a.redundant),
    survived: a.survived.map((m) => (m.mutator === "Semantic" ? m.id : `stryker:${m.id}`)),
  }),
);
