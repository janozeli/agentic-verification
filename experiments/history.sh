#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
out=experiments/results/history.md
{
  echo "# Historical faults"
  echo
  echo "Each fault is the revert of a real fix commit, applied to the pinned source."
  echo "Cells: failing tests in the full suite / in the pruned suite."
  echo
  echo "| Library | Fault | Human | Agent |"
  echo "|---|---|---:|---:|"
  for n in scule defu destr; do
    for s in human agent; do
      for d in "vendor/$n" "vendor/.verify/$n-$s"; do
        bun src/patches.ts "$d" "corpus/$n/history" "vitest.$s.config.ts" >"$d/reports/history-$s.json"
      done
    done
    bun -e '
      const [n] = process.argv.slice(1), r = (p) => JSON.parse(require("fs").readFileSync(p));
      const k = (s, d) => Object.fromEntries(r(`${d}/reports/history-${s}.json`).map((m) => [m.id, m]));
      const h = [k("human", `vendor/${n}`), k("human", `vendor/.verify/${n}-human`)];
      const a = [k("agent", `vendor/${n}`), k("agent", `vendor/.verify/${n}-agent`)];
      for (const id of Object.keys(h[0])) {
        const c = ([f, p]) => `${f[id].killedBy.length} / ${p[id].killedBy.length}`;
        console.log(`| ${n} | ${id.replace("semantic:", "")}: ${h[0][id].description.replace(/^revert of /, "")} | ${c(h)} | ${c(a)} |`);
      }' "$n"
  done
} >"$out"
cat "$out"
