#!/usr/bin/env bash
# Fetches every library in corpus/libraries.json into vendor/<name> at its
# pinned commit, then lays our files over it:
#   corpus/<name>/agent/*.test.ts  -> vendor/<name>/test-agent/
#   generated Vitest and Stryker configs for the human and agent suites
# vendor/ is ignored by git; only what is in corpus/ is versioned.
set -euo pipefail
cd "$(dirname "$0")/.."

for name in $(bun -e 'console.log(Object.keys(require("./corpus/libraries.json")).join(" "))'); do
  lib() { bun -e "const l=require('./corpus/libraries.json')['$name']; console.log($1)"; }
  repo=$(lib l.repo); commit=$(lib l.commit); dir="vendor/$name"

  if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" != "$commit" ]; then
    rm -rf "$dir" && mkdir -p "$dir"
    git -C "$dir" init -q
    git -C "$dir" fetch -q --depth 1 "$repo" "$commit"
    git -C "$dir" checkout -q FETCH_HEAD
  fi
  git -C "$dir" clean -qfdx -e test-agent
  git -C "$dir" checkout -q -- .

  rm -rf "$dir/test-agent"
  if [ -d "corpus/$name/agent" ]; then cp -r "corpus/$name/agent" "$dir/test-agent"; fi

  human=$(lib l.humanTests); mutate=$(lib 'JSON.stringify(l.mutate)')
  for suite in human agent; do
    include=$([ $suite = human ] && echo "$human" || echo "test-agent/**/*.test.ts")
    printf 'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: ["%s"] } });\n' \
      "$include" > "$dir/vitest.$suite.config.ts"
    cat > "$dir/stryker.$suite.json" <<JSON
{
  "testRunner": "vitest",
  "vitest": { "configFile": "vitest.$suite.config.ts" },
  "coverageAnalysis": "perTest",
  "disableBail": true,
  "mutate": $mutate,
  "reporters": ["json"],
  "jsonReporter": { "fileName": "reports/mutation-$suite.json" },
  "tempDirName": ".stryker-tmp",
  "tsconfigFile": "no-tsconfig.json"
}
JSON
  done
  echo "$name @ ${commit:0:7}"
done
