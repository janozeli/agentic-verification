// Case coverage: does the pruned suite still check every input -> output
// pair the full suite checks?
//
// 1. Record, with the full suite, every call each test makes to the library.
// 2. For each removed test T, run with an implementation that is exact except
//    on T's calls, where it returns a wrong result.
//    - The full suite must fail, or the perturbation is not observable.
//    - If the pruned suite still passes, T's cases are lost.
// Third-party code runs offline; runs go in parallel.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join, resolve } from "node:path";
import { readReport } from "../src/prune";

const root = resolve(".");
const offline = join(root, "corpus/offline");
const vitest = join(root, "node_modules/vitest/vitest.mjs");
const runtime = join(root, "experiments/cases-runtime.ts");
const libraries = Object.keys(JSON.parse(readFileSync("corpus/libraries.json", "utf8")));

// Entry points the suites import, and the module each one resolves to.
const entries: Record<string, Record<string, string>> = {
  scule: { "../src": "src/index.ts", "../src/index": "src/index.ts" },
  defu: { "../src/defu": "src/defu.ts", "../src/_utils": "src/_utils.ts" },
  destr: { "../src": "src/index.ts", "../src/index": "src/index.ts" },
};

async function exportNames(module: string): Promise<string[]> {
  const m = await import(module);
  return Object.keys(m).filter((k) => typeof m[k] === "function");
}

// Write wrapper modules and a Vitest config that aliases the entries to them.
async function instrument(dir: string, lib: string, suite: string) {
  const wrapDir = join(dir, ".cases");
  mkdirSync(wrapDir, { recursive: true });
  const aliases: string[] = [];
  for (const [specifier, target] of Object.entries(entries[lib])) {
    const real = join(dir, target);
    const names = await exportNames(real);
    const wrapper = join(wrapDir, `${target.replace(/\W/g, "_")}.ts`);
    writeFileSync(
      wrapper,
      [
        `import * as real from ${JSON.stringify(real)};`,
        `import { wrap } from ${JSON.stringify(runtime)};`,
        ...names.map((n) =>
          n === "default"
            ? `export default wrap("default", real.default);`
            : `export const ${n} = wrap(${JSON.stringify(n)}, real.${n});`,
        ),
        "",
      ].join("\n"),
    );
    const escaped = specifier.replace(/[./]/g, (c) => `\\${c}`);
    aliases.push(`{ find: /^${escaped}$/, replacement: ${JSON.stringify(wrapper)} }`);
  }
  const include = suite === "human" ? "test/**/*.test.ts" : "test-agent/**/*.test.ts";
  writeFileSync(
    join(dir, "vitest.cases.config.ts"),
    `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: [${JSON.stringify(include)}] }, resolve: { alias: [${aliases.join(", ")}] } });\n`,
  );
}

type Run = { failed: Set<string>; total: number; brokenFiles: number };
function run(dir: string, env: Record<string, string>, out: string): Promise<Run> {
  return new Promise((done, fail) => {
    const p = spawn(offline, ["node", vitest, "run", "--config", "vitest.cases.config.ts", "--reporter=json", `--outputFile=${out}`], {
      cwd: dir,
      env: { ...process.env, ...env },
      stdio: "ignore",
    });
    p.on("exit", () => {
      if (!existsSync(out)) return fail(new Error(`no results in ${dir}`));
      const r = JSON.parse(readFileSync(out, "utf8"));
      const failed = new Set<string>();
      let total = 0;
      let brokenFiles = 0;
      for (const f of r.testResults) {
        if (f.status === "failed" && f.assertionResults.length === 0) brokenFiles++;
        for (const t of f.assertionResults) {
          total++;
          if (t.status === "failed") failed.add([...t.ancestorTitles, t.title].join(" > "));
        }
      }
      rmSync(out);
      done({ failed, total, brokenFiles });
    });
  });
}

async function pool<T, R>(items: T[], size: number, work: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await work(items[i], i);
      }
    }),
  );
  return results;
}

const names = (f: string) => new Set(readReport(JSON.parse(readFileSync(f, "utf8"))).tests.map((t) => t.name));

let md = "| Library | Suite | Tests removed by pruning | Perturbation observable | Cases still checked by the pruned suite | Cases lost |\n";
md += "|---|---|---:|---:|---:|---:|\n";
const lostNotes: string[] = [];

const only = process.argv.slice(2);
type Result = { removed: number; observable: number; lost: string[] };
for (const lib of libraries) {
  for (const suite of ["human", "agent"]) {
    const cache = resolve(`vendor/${lib}/.cases-result-${suite}.json`);
    if (only.length && !only.includes(lib) && existsSync(cache)) {
      const c: Result = JSON.parse(readFileSync(cache, "utf8"));
      md += `| ${lib} | ${suite} | ${c.removed} | ${c.observable} | ${c.observable - c.lost.length} | ${c.lost.length} |\n`;
      for (const t of c.lost) lostNotes.push(`- ${lib}, ${suite}: "${t}"`);
      continue;
    }
    const full = resolve(`vendor/${lib}`);
    const pruned = resolve(`vendor/.verify/${lib}-${suite}`);
    if (!existsSync(join(pruned, "reports"))) continue;
    await instrument(full, lib, suite);
    await instrument(pruned, lib, suite);

    const casesFile = join(full, ".cases", `${suite}.jsonl`);
    rmSync(casesFile, { force: true });
    const recorded = await run(full, { CASES_MODE: "record", CASES_FILE: casesFile }, join(full, ".cases", "record.json"));
    // The instrumented suite must run every test and pass, or nothing below means anything.
    const expected = names(`${full}/reports/mutation-${suite}.json`).size;
    if (recorded.failed.size || recorded.brokenFiles || recorded.total !== expected) {
      throw new Error(`${lib} ${suite}: instrumented run is not the suite (${recorded.total}/${expected} tests, ${recorded.failed.size} failed, ${recorded.brokenFiles} files broken)`);
    }

    const before = names(`${full}/reports/mutation-${suite}.json`);
    const after = names(`${pruned}/reports/mutation-${suite}.json`);
    const removed = [...before].filter((n) => !after.has(n));

    const results = await pool(removed, Math.max(2, cpus().length), async (test, i) => {
      const env = { CASES_MODE: "perturb", CASES_FILE: casesFile, CASES_TEST: test };
      const a = await run(full, env, join(full, ".cases", `full-${i}.json`));
      const b = await run(pruned, env, join(pruned, ".cases", `pruned-${i}.json`));
      return { test, observable: a.failed.has(test), stillChecked: b.failed.size > 0 };
    });

    const observable = results.filter((r) => r.observable);
    const lost = observable.filter((r) => !r.stillChecked);
    md += `| ${lib} | ${suite} | ${removed.length} | ${observable.length} | ${observable.length - lost.length} | ${lost.length} |\n`;
    for (const r of lost) lostNotes.push(`- ${lib}, ${suite}: "${r.test}"`);
    writeFileSync(cache, JSON.stringify({ removed: removed.length, observable: observable.length, lost: lost.map((r) => r.test) }));
    console.error(`${lib} ${suite}: ${removed.length} removed, ${observable.length} observable, ${lost.length} lost`);
  }
}
md += `\nCases lost (the pruned suite passes although these tests' exact cases were broken):\n${lostNotes.join("\n") || "none"}\n`;

writeFileSync("experiments/results/cases.md", md);
console.log(md);
