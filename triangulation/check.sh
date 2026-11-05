#!/usr/bin/env bash
# Acceptance test: both implementations of SPEC.md agree on every corpus suite.
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
for report in vendor/*/reports/mutation-*.json examples/coupon/reports/mutation*.json; do
  [ -f "$report" ] || continue
  dir=$(dirname "$report"); suite=$(basename "$report" .json); suite=${suite#mutation}; suite=${suite#-}
  semantic="$dir/semantic${suite:+-$suite}.json"
  [ -f "$semantic" ] || continue
  a=$(bun triangulation/verdict.ts "$report" "$semantic")
  b=$(python3 triangulation/verdict.py "$report" "$semantic")
  if [ "$a" = "$b" ]; then echo "agree     $report"; else echo "DISAGREE  $report"; status=1; fi
done
exit $status
