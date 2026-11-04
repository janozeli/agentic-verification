#!/usr/bin/env bash
# Does the oracle alone catch the inclusive-minimum misunderstanding?
# Runs only the oracle test against mutants/exclusive-minimum.ts, ten seeds,
# with minimums biased toward the subtotal and with uniform minimums.
set -euo pipefail
cd "$(dirname "$0")/../examples/coupon"

out=../../experiments/results/generators.md
{
  echo "| Minimum generator | Seeds where the oracle catches exclusive-minimum |"
  echo "|---|---:|"
  for mode in biased uniform; do
    caught=0
    for seed in 1 2 3 4 5 6 7 8 9 10; do
      if ! MINIMUM=$mode SEED=$seed IMPL=mutants/exclusive-minimum.ts \
        vitest run --config vitest.props.config.ts -t "matches the verified model" >/dev/null 2>&1; then
        caught=$((caught + 1))
      fi
    done
    echo "| $mode | $caught / 10 |"
  done
} >"$out"
cat "$out"
