# Pruning verdict: definition

Two independent implementations of this definition must produce identical
output. Neither may read the other.

## Input

1. A Stryker mutation report (JSON, mutation-testing-report-schema):
   - `testFiles`: map from file name to `{ tests: [{ id, name, ... }] }`.
     The order of tests is the order of `testFiles` keys, then the order of
     `tests` within each file.
   - `files`: map from file name to `{ mutants: [{ id, status, killedBy?, ... }] }`.
     The order of mutants is the order of `files` keys, then of `mutants`.
2. A semantic report (JSON): a list of `{ id, killedBy: [test name, ...] }`.
   `killedBy` holds test *names*, which match `tests[].name` in the Stryker
   report; names with no match are ignored.

## Definitions

- `kills(t)` for a test `t`: the set of Stryker mutants with
  `status == "Killed"` whose `killedBy` contains `t.id`, plus the semantic
  mutants whose `killedBy` contains `t.name`. Mutants with any other status
  (Survived, Timeout, NoCoverage, ...) are never in any `kills(t)`.
- `killed`: the union of `kills(t)` over all tests.
- `kept`: built greedily. Start with an empty list and `remaining = killed`.
  While `remaining` is not empty, choose the test with the largest
  `|kills(t) ∩ remaining|`; on a tie, the one that comes first in test order.
  Append it to `kept` and remove its kills from `remaining`.
- `vacuous`: tests with `kills(t)` empty, in test order.
- `redundant`: tests not in `kept` and not vacuous, in test order.
- `survived`: Stryker mutants with `status` `"Survived"` or `"NoCoverage"`, then semantic
  mutants with an empty `killedBy` after dropping unmatched names, in input
  order. Stryker mutants are identified as `stryker:<id>`; semantic mutants
  by their `id` exactly as given.

## Output

One JSON object, keys in this order, test names as strings:

    { "kept": [...], "vacuous": [...], "redundant": [...], "survived": [...] }

Every list is in input order: `kept` lists the greedy choice in test order,
not in the order it was chosen.
