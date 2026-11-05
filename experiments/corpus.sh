#!/usr/bin/env bash
# The corpus study: real libraries, their human-written suites, suites written
# by an agent that never saw them, and semantic mutants written by another
# agent from the README and the source. Third-party code runs offline.
#
# Each suite is measured, then pruned for real on a copy and measured again.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$(pwd)

measure() { # <library dir> <suite>
  (cd "$1" && "$root/corpus/offline" stryker run "stryker.$2.json" >/dev/null)
  bun src/patches.ts "$1" "corpus/$name/mutants" "vitest.$2.config.ts" >"$1/reports/semantic-$2.json"
}

./corpus/fetch.sh
rm -rf vendor/.verify
for name in $(bun -e 'console.log(Object.keys(require("./corpus/libraries.json")).join(" "))'); do
  for suite in human agent; do
    [ "$suite" = agent ] && [ ! -d "corpus/$name/agent" ] && continue
    measure "vendor/$name" "$suite"

    pruned="vendor/.verify/$name-$suite"
    mkdir -p vendor/.verify && cp -r "vendor/$name" "$pruned" && rm -rf "$pruned/.stryker-tmp"
    bun -e "
      const fs = require('fs'), f = '$pruned/reports/mutation-$suite.json', r = JSON.parse(fs.readFileSync(f));
      r.projectRoot = require('path').resolve('$pruned'); fs.writeFileSync(f, JSON.stringify(r));"
    bun src/cli.ts "$pruned/reports/mutation-$suite.json" --semantic "$pruned/reports/semantic-$suite.json" --apply \
      >"$pruned/prune.log"
    mkdir -p "vendor/$name/reports/pruned" && cp "$pruned/prune.log" "vendor/$name/reports/pruned/$suite.log"
    measure "$pruned" "$suite"
    cp "$pruned/reports/mutation-$suite.json" "vendor/$name/reports/pruned/mutation-$suite.json"
    cp "$pruned/reports/semantic-$suite.json" "vendor/$name/reports/pruned/semantic-$suite.json"
  done
done
bun experiments/corpus.ts
