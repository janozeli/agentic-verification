# Beliefs

What this study currently believes, how strongly, on what evidence, and
what would change it. Credences are the author's, stated as rough
probabilities; they are not computed. Their use is to make revisions
visible: a belief that never moves, whatever the data, is not being tested.

Each belief carries the strongest kind of evidence behind it:

| Grade | Meaning |
|---|---|
| proved | a machine-checked proof inside a stated model |
| finite | checked exhaustively over a stated finite domain |
| sampled | holds on every sampled input; no bound beyond the sample |
| measured | an observed count in this study's setup |
| cited | reported by others; not reproduced here |
| hypothesis | proposed; no evidence in this study yet |

A grade says how a claim was checked, not that it is true outside the
setup. A proof is about the model, not the code; a measurement is about
these libraries, these agents, this prompt.

`before` is marked *prereg* when it was committed before the data that
moved it, and *recon* when it was written down afterwards. A
reconstructed prior is weak evidence of anything: it is easy to remember
having expected what happened.

## Ledger

| # | Belief | Grade | Before | After | Would lower it |
|---|---|---|---|---|---|
| B1 | On clean, isolated tasks, most tests an agent writes reject no fault the rest miss | measured | 0.6 recon | 0.8 | the same measurement on application code, or under messier context |
| B2 | Agent test quality depends more on context than on the agent | hypothesis | 0.6 recon | 0.6 | same model and code, varied context, quality unchanged |
| B3 | Syntactic mutants alone are not a safe basis for pruning | measured | 0.7 recon | 0.93 | semantic or historical faults that the Stryker-pruned suites still catch |
| B4 | Pruning that keeps every killed mutant still loses cases | measured | 0.5 recon | 0.95 | a case-coverage instrument error; see B9 |
| B5 | Without a formal core, only duplicate cases can be cut soundly | proved / finite (coupon), measured (scule) | 0.7 recon | 0.85 | a sound cut found by another method (e.g. metamorphic relations) on a library with no model |
| B6 | A verified model as oracle catches what its inputs reach | measured | 0.8 recon | 0.9 | a fault inside the reached input space the oracle misses |
| B7 | The formal language of the oracle barely matters | measured | 0.5 recon | 0.7 | an oracle language whose models are much cheaper to write or to trust |
| B8 | The pruning verdict computes its definition | measured | 0.9 recon | 0.95 | a disagreement on a new report; see finding 11 |
| B10 | Mutant-based pruning can delete a regression test for a fault that really happened | measured (1 of 4 faults) | 0.4 prereg (H3) | 0.9 that it can; frequency unknown | the case is an artefact of the revert (it is not: the deleted test is the one the fix added) |
| B9 | The case-coverage and patch instruments measure what they claim | measured (self-checks only) | 0.8 recon | 0.8 | an independent implementation disagreeing |

B8 went up after triangulation, but the first run also found a real gap,
which is evidence that the earlier 0.9 was too high at the time.

## Preregistered: historical faults

Question: do the suites catch bugs that really happened, and does pruning
lose any? Faults that real users hit are a sample the study's own mutants
did not choose.

Method: each `fix` commit in the libraries' history that touches `src`,
excluding type-only fixes, is reverted on the pinned source. Only reverts
that apply cleanly are used: 4 of 23 (scule 57cfd15, defu 11ba022,
defu 1b9fcab, destr d9ba16d). Each is run against the full and the pruned
human and agent suites, offline.

Written before running any of them:

| # | Prediction | Credence |
|---|---|---|
| H1 | The full human suites catch all 4 (each fix added a regression test that is still there) | 0.85 |
| H2 | The full agent suites catch at least 3 of 4 | 0.6 |
| H3 | Some pruned human suite misses a fault its full suite catches | 0.4 |
| H4 | Some pruned agent suite misses a fault its full suite catches | 0.35 |

With 4 faults, no outcome moves B1, B3 or B4 much; the point is to find
out whether the method works before porting the 19 reverts that do not
apply cleanly.

### Outcome

Run after the commit above; table in
[experiments/results/history.md](experiments/results/history.md).

| # | Credence | Outcome |
|---|---|---|
| H1 | 0.85 | true: 4 of 4 |
| H2 | 0.6 | true: 4 of 4 |
| H3 | 0.4 | true: pruning deleted defu's `should ignore inherited enumerable properties`, the regression test added by the fix being reverted, as redundant; the pruned suite lets the bug back in |
| H4 | 0.35 | false: every pruned agent suite still catches all 4, with fewer failing tests (scule 25 to 1, destr 18 to 10) |

H2 was underconfident. H3 happened at 0.4: a regression test records a
fault that happened, which no mutant set chosen afterwards needs to
contain. One case shows that it can happen, not how often.
