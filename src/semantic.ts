// Runs a Vitest suite once per semantic mutant and records which tests fail.
// A semantic mutant is a whole alternative implementation that encodes a
// plausible misunderstanding of the domain. Mutants are plain files, written
// once and reviewed like code; this runner is deterministic.
//
// Usage: bun src/semantic.ts <project-dir> <mutants-dir> [vitest-config] > kills.json
// The project's Vitest config must alias the module under test to $IMPL.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

export type SemanticMutant = {
  id: string;
  file: string;
  description: string;
  killedBy: string[]; // full test names, "describe > test"
};

const require = createRequire(import.meta.url);
const vitest = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");

export function runSemantic(projectDir: string, mutantsDir: string, config?: string): SemanticMutant[] {
  const out = mkdtempSync(join(tmpdir(), "semantic-"));
  return readdirSync(mutantsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((f) => {
      const path = resolve(mutantsDir, f);
      const resultFile = join(out, `${f}.json`);
      const run = spawnSync(
        process.execPath.includes("bun") ? "node" : process.execPath,
        [vitest, "run", "--reporter=json", `--outputFile=${resultFile}`, ...(config ? ["--config", config] : [])],
        { cwd: projectDir, env: { ...process.env, IMPL: path }, encoding: "utf8" },
      );
      let results: any;
      try {
        results = JSON.parse(readFileSync(resultFile, "utf8"));
      } catch {
        throw new Error(`vitest produced no results for ${f}:\n${run.stderr}`);
      }
      const killedBy: string[] = [];
      for (const file of results.testResults) {
        for (const t of file.assertionResults) {
          if (t.status === "failed") killedBy.push([...t.ancestorTitles, t.title].join(" > "));
        }
      }
      const description = readFileSync(path, "utf8").split("\n")[0].replace(/^\/\/\s*/, "");
      return { id: `semantic:${f.replace(/\.ts$/, "")}`, file: relative(projectDir, path), description, killedBy };
    });
}

if (import.meta.main) {
  const [projectDir, mutantsDir, config] = process.argv.slice(2);
  if (!projectDir || !mutantsDir) {
    console.error("usage: semantic <project-dir> <mutants-dir> [vitest-config]");
    process.exit(2);
  }
  console.log(JSON.stringify(runSemantic(projectDir, mutantsDir, config), null, 2));
}
