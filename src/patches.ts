// Semantic mutants as patches against a third-party library, so the mutant
// files can be versioned without versioning the library itself.
// For each patch: copy the library, apply the patch, run one Vitest suite
// with networking disabled, record which tests fail.
//
// Usage: bun src/patches.ts <library-dir> <patches-dir> <vitest-config> > kills.json
// The first line of each patch is "# <description>".
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import type { SemanticMutant } from "./semantic";

const require = createRequire(import.meta.url);
const vitest = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const skip = new Set(["node_modules", ".stryker-tmp", "reports", ".git"]);
const offline = resolve(dirname(new URL(import.meta.url).pathname), "../corpus/offline");

export function runPatches(libDir: string, patchesDir: string, config: string): SemanticMutant[] {
  const lib = resolve(libDir);
  // Work next to the library so `vitest` still resolves from the project root.
  const work = join(dirname(lib), ".work", basename(lib));
  return readdirSync(patchesDir)
    .filter((f) => f.endsWith(".patch"))
    .sort()
    .map((f) => {
      const patch = resolve(patchesDir, f);
      rmSync(work, { recursive: true, force: true });
      mkdirSync(work, { recursive: true });
      cpSync(lib, work, { recursive: true, filter: (src) => !skip.has(basename(src)) });
      // The work copy sits inside this repository; stop git from finding it, or
      // `git apply` reads paths from our root, skips every file and succeeds.
      const applied = spawnSync("git", ["apply", "--verbose", patch], {
        cwd: work,
        encoding: "utf8",
        env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(work) },
      });
      if (applied.status !== 0 || !/Applied patch/.test(applied.stderr) || /Skipped patch/.test(applied.stderr)) {
        throw new Error(`${f} did not apply:\n${applied.stderr}`);
      }
      const resultFile = join(work, "result.json");
      spawnSync(offline, ["node", vitest, "run", "--config", config, "--reporter=json", `--outputFile=${resultFile}`], {
        cwd: work,
        encoding: "utf8",
      });
      const results = JSON.parse(readFileSync(resultFile, "utf8"));
      const killedBy: string[] = [];
      for (const file of results.testResults) {
        // A suite that fails to load fails every test in it.
        if (file.status === "failed" && file.assertionResults.length === 0) killedBy.push(`<load error: ${file.name}>`);
        for (const t of file.assertionResults) {
          if (t.status === "failed") killedBy.push([...t.ancestorTitles, t.title].join(" > "));
        }
      }
      const description = readFileSync(patch, "utf8").split("\n")[0].replace(/^#\s*/, "");
      return { id: `semantic:${f.replace(/\.patch$/, "")}`, file: f, description, killedBy };
    });
}

if (import.meta.main) {
  const [libDir, patchesDir, config] = process.argv.slice(2);
  if (!libDir || !patchesDir || !config) {
    console.error("usage: patches <library-dir> <patches-dir> <vitest-config>");
    process.exit(2);
  }
  console.log(JSON.stringify(runPatches(libDir, patchesDir, config), null, 2));
}
