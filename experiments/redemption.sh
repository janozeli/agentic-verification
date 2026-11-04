#!/usr/bin/env bash
# Model-checks the three redemption designs with TLC and writes a table.
# Needs Java. Downloads tla2tools.jar into .tools/ on first run.
set -euo pipefail
cd "$(dirname "$0")/.."

jar=${TLA2TOOLS:-.tools/tla2tools.jar}
if [ ! -f "$jar" ]; then
  mkdir -p "$(dirname "$jar")"
  curl -fsSL -o "$jar" https://nightly.tlapl.us/dist/tla2tools.jar
fi

out=experiments/results/redemption.md
{
  echo "| Model | Design | TLC result | Distinct states |"
  echo "|---|---|---|---:|"
  for cfg in CheckThenAct ReserveLeaky Reserve; do
    log=$(cd examples/redemption/spec && java -XX:+UseParallelGC -cp "$OLDPWD/$jar" tlc2.TLC \
      -deadlock -noGenerateSpecTE -metadir "$(mktemp -d)" -config "$cfg.cfg" Redemption.tla 2>&1 || true)
    design=$(grep -o 'Design = "[a-z_]*"' "examples/redemption/spec/$cfg.cfg" | cut -d'"' -f2)
    release=$(grep -o 'Release = [A-Z]*' "examples/redemption/spec/$cfg.cfg" | cut -d' ' -f3)
    result=$(grep -oE 'Invariant [A-Za-z]+ is violated|Temporal property [A-Za-z]+ was violated|No error has been found' <<<"$log" | head -1)
    states=$(grep -oE '[0-9]+ distinct states found' <<<"$log" | grep -oE '^[0-9]+' | tail -1)
    echo "| $cfg.cfg | $design, Release = $release | $result | ${states:-n/a} |"
  done
} >"$out"
cat "$out"
