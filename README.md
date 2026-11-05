# agentic-verification

Coding agents write tests faster than anyone can judge them. This repository
studies two questions, on a worked example and on real libraries:

1. **Which tests earn their place?** Measure what each test rejects and
   remove the ones that reject nothing new.
2. **Can formal methods sit behind ordinary tests?** Native code in, native
   failures out, with the formal model in the middle.

The full write-up is in [STUDY.md](STUDY.md). Every number below is produced
by `mise run study` and checked in CI.

## Results

Coupon example: one pricing function, 27 Stryker mutants (one of them
equivalent) and 9 semantic mutants, i.e. plausible domain misunderstandings
written as whole alternative implementations.

| Suite | Tests | Stryker mutants killed | Semantic mutants caught |
|---|---:|---:|---:|
| Agent-style examples | 31 | 25 / 27 | 5 / 9 |
| ↳ pruned on Stryker mutants only | 4 | 25 / 27 | 3 / 9 |
| ↳ pruned on Stryker + semantic mutants | 5 | 25 / 27 | 5 / 9 |
| Properties (the model's rules) | 4 | 22 / 27 | 7 / 9 |
| Oracle (verified Dafny model, in process) | 1 | 26 / 27 | 9 / 9 |
| Oracle (verified Lean model, external process) | 1 | 26 / 27 | 9 / 9 |

- 26 of the 31 example tests can go without losing anything either kind of
  mutant detects. Four of them reject nothing at all.
- Pruning on syntactic mutants alone is not safe: it drops the only tests that
  catch two of the misunderstandings.
- One differential test against a verified model catches everything that can
  be caught, but only because its inputs are aimed at the boundary the model
  proves. With uniform inputs it misses that bug in 10 of 10 seeds.
- The model's language barely matters. A Dafny model compiled to JavaScript
  and a Lean model run as a separate process, one JSON line per case, give the
  same results, and the two models agree with each other.

Real libraries: three small unjs libraries, each with its maintainers'
suite and a suite written by an agent that never saw it, against Stryker and
against 8 semantic mutants written by a separate agent. "Pruned" is measured
on a copy with the tests deleted.

| Library | Suite | Tests | Stryker detected | Semantic caught | Tests after pruning |
|---|---|---:|---:|---:|---:|
| scule | human | 63 | 75 / 81 | 7 / 8 | 46 |
| scule | agent | 339 | 80 / 81 | 8 / 8 | 9 |
| defu | human | 23 | 87 / 103 | 6 / 8 | 8 |
| defu | agent | 225 | 101 / 103 | 8 / 8 | 21 |
| destr | human | 22 | 111 / 141 | 6 / 8 | 20 |
| destr | agent | 396 | 140 / 141 | 8 / 8 | 119 |

- The agent suites were stronger than the human ones, and surfaced three
  behaviors in the libraries that look like real bugs. They were mostly redundant: pruning removed up
  to 97% of their tests without losing a single detection.
- Pruning on syntactic mutants alone was unsafe again on scule.
- Mutating the formal model instead of the code shows which boundaries an
  input generator misses, before any implementation exists.

Redemption example: a coupon with limited uses under concurrent checkouts,
model-checked with TLC, with each counterexample replayed as a Vitest test.

| Design | TLC result |
|---|---|
| check, then write | over-redemption (safety) |
| reserve, forget to release on failed payment | broken promise (liveness) |
| reserve, release on failure | no error |

## Layout

```
src/                 the pruner: Stryker report (+ semantic mutants) in, verdicts or deletions out
corpus/              pinned list of real libraries, agent suites and semantic mutants as patches
examples/coupon/     function, agent-style suite, properties, semantic mutants, Dafny and Lean models
examples/redemption/ TLA+ spec, TypeScript implementations, replayed counterexamples
experiments/         scripts that produce experiments/results/
```

The libraries in the corpus are not versioned: `corpus/fetch.sh` clones them
at pinned commits into `vendor/`, which git ignores, and their code only runs
offline (`corpus/offline`).

## Running

Tools are pinned with [mise](https://mise.jdx.dev): Bun for scripts, Node for
Vitest and Stryker, elan for Lean (the toolchain itself is pinned in
`examples/coupon/lean/lean-toolchain`).

```sh
mise install && bun install
mise run test     # build the Lean oracle, type-check, run all suites
mise run study    # needs Java; regenerates experiments/results/ (the corpus takes ~15 min)
mise run prune    # pruner verdicts on the example suite (after the study)
mise run model    # re-verify and recompile the Dafny model (needs Dafny 4.11 and Z3 4.12.1)
```

The pruner works on any Stryker JSON report produced with
`coverageAnalysis: "perTest"` and `disableBail: true`:

```sh
bun src/cli.ts reports/mutation.json [--semantic kills.json] [--apply] [--strict]
```
