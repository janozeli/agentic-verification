# Study

## Questions

1. A test is a predicate over implementations: it accepts some and rejects
   others. If we sample wrong implementations, can we measure what each test
   rejects and safely remove the ones that add nothing?
2. Syntactic mutants (`<` to `<=`, `+` to `-`) are the usual sample. Do they
   capture the mistakes that matter, or do we need mutants that encode
   misunderstandings of the domain?
3. Can a formally verified model act as the oracle for ordinary tests, so that
   people and agents only ever see native code and native failures? Does it
   matter which formal language, or whether the model runs in process?
4. For behavior over time (concurrency, promises), can a model checker's
   counterexamples come back as native tests?
5. Can the specification alone tell whether an input generator reaches its
   boundaries, before any implementation exists?
6. Do the findings hold on real libraries? How do suites written by an agent
   compare with the ones their maintainers wrote?

## Setup

**Coupon** (`examples/coupon`). `applyCoupon(items, coupon?)` computes an order
total in cents with percent or fixed coupons, an optional minimum subtotal,
percent clamping and rounding down. Three suites exercise it:

- `test/`: 31 example-based tests in the style coding agents tend to write:
  one case per test, chosen by looking at the implementation, some checking
  only that a function exists or returns a number.
- `test-props/`, rules: 4 fast-check properties stating the rules.
- `test-props/`, oracle: 1 property comparing the implementation with a
  Dafny model on generated inputs.
- `test-lean/`, oracle: the same comparison against a Lean model running as a
  separate process.

Two kinds of wrong implementations:

- 27 Stryker mutants. One of them, `true && base < min`, is equivalent: when
  there is no minimum, `base < undefined` is already false.
- 9 semantic mutants in `mutants/`. Each is a whole implementation encoding a
  plausible misunderstanding: rounding up, rounding per line, reading
  "minimum" as strictly greater, checking the minimum after the discount,
  applying a fixed coupon per unit, trusting negative percentages, reading
  cents as reais, and two trivial ones (never discount, everything free).

The Dafny model (`spec/coupon.dfy`) defines the function and proves six
rules about it, among them that reaching the minimum exactly qualifies, that
percentages are clamped, that rounding never favors the customer and that a
bigger percentage never costs more. It compiles to JavaScript
(`spec/model.cjs`, committed and checked in CI). `spec/model.ts` translates
between the TypeScript types and the model's (union types to tags, `number`
to unbounded integers).

The Lean model (`lean/CouponModel.lean`) was written separately and proves
the same six rules. `lean/Main.lean` turns it into a Unix filter: one JSON
case per line on stdin, one result per line on stdout. The TypeScript side
(`spec/lean.ts`) sends all generated cases through a single pipe.

**Redemption** (`examples/redemption`). A coupon with a use limit, redeemed by
concurrent checkouts. `spec/Redemption.tla` models three designs; three
TypeScript functions implement them.

**Corpus** (`corpus/`). Three small, well-maintained MIT libraries from
unjs: scule (string case), defu (default properties) and destr (safer
`JSON.parse`), pinned by commit and fetched into `vendor/`, which is not
versioned. Each gets two suites and one set of mutants:

- the library's own, human-written suite;
- a suite written by a coding agent that saw only `src/` and the README,
  asked to "add a comprehensive Vitest test suite";
- 8 semantic mutants per library, written as patches by a second agent from
  the same `src/` and README, without seeing any tests.

The libraries were reviewed before running, and their code only ever runs
offline (`corpus/offline`, no network except loopback).

**Determinism.** Stryker runs with per-test coverage and without bailing, so
every test that kills a mutant is recorded. fast-check runs with fixed seeds.
The Dafny output is byte-for-byte reproducible. The Lean toolchain is pinned. CI re-runs the study and fails
if `experiments/results/` changes.

## Findings

### 1. Most of the agent-style suite rejects nothing new

The pruner builds a matrix of which tests kill which mutants and keeps a
greedy set cover: the smallest set it finds that kills everything the full
suite kills.

Counting both kinds of mutants, 5 of the 31 tests kill everything the 31 kill.
Applying the pruning for real and re-running Stryker and the semantic mutants
gives the same numbers: 25 Stryker mutants and 5 semantic mutants. Four tests
kill nothing at all: two `is defined` checks, a `does not throw` and a
`does not mutate the input`.

The last one shows the limit of the method: it guards a property no mutant
expresses. "Kills nothing in this sample" is evidence of uselessness, not
proof, and the verdict is only as good as the sample of wrong
implementations.

### 2. Syntactic mutants are not a safe basis for pruning

Pruning on Stryker mutants alone keeps 4 tests and loses two
misunderstandings the full suite caught: `rounds-up` and `fixed-per-unit`.
Stryker has no operator that turns `Math.floor` into `Math.ceil` or multiplies
a discount by the number of units, so the only tests that catch those looked
redundant.

Adding semantic mutants to the matrix fixes it: the cover grows to 5 tests and
keeps both. Semantic mutants are meant to be written once, by a person or a
model, and committed. The judge that runs them stays deterministic.

### 3. Many examples, few rules

The 31 examples miss 4 of 9 misunderstandings, among them the inclusive
minimum, which Stryker also flags as a surviving `<=`. The 4 rule properties catch 7 of 9,
and the property suite, oracle and generators included, is about a quarter
shorter (112 lines against 147). The two they miss are both about fixed coupons,
because none of the rules mentions fixed coupons. Properties are only as
complete as the rules someone thought to write.

### 4. A verified oracle catches everything, if its inputs reach the bugs

The single oracle test kills 26 of 27 Stryker mutants (the survivor is the
equivalent one) and all 9 semantic mutants. The model defines the whole
function, so there is no rule to forget.

Two caveats came out of the experiment:

- **The proof covers the model, not the code.** The differential test is
  what connects the two. In the literature this is translation validation:
  instead of proving the translator correct, each translation is checked.
  The adapter (`spec/model.ts`) is about twenty lines, and every one of them
  is a place where meaning could drift: integer bounds, the encoding of
  "no minimum", union types.
- **Inputs decide what the oracle sees.** The minimum generator is biased
  toward the subtotal (equal, one above, one below). With uniform minimums,
  the oracle alone misses the inclusive-minimum bug in 10 of 10 seeds, 300
  runs each (`experiments/results/generators.md`). Only the explicit rule
  catches it then. The lemma `MinimumIsInclusive` points at that boundary, so
  the proof also tells you where to aim the inputs.

### 5. The formal language barely matters; the process boundary does a little

The Lean oracle gives exactly the same numbers as the Dafny one: 26 of 27
Stryker mutants and 9 of 9 semantic mutants. The two models, written
separately in different languages, agree on all 300 generated cases. That
agreement is a check on the specifications themselves, not on the code, so
the pruner correctly reports the test that runs it as killing nothing.

Running the model as a process is cheap: about 50 ms for a batch of 300
cases, with a 118 MB binary because it links the Lean runtime. What the
boundary costs is shrinking. fast-check shrinks a failing case by calling the
oracle again and again; with a batch, the test can only report the smallest
mismatching case it already has. Per-case process calls would restore
shrinking at the price of speed.

The protocol is what makes the language interchangeable. The Lean side is a
40-line filter; any language that reads and writes lines could take its place.

### 6. Counterexamples come back as native tests

TLC checks each redemption design in under a hundred distinct states:

- **Check, then write** violates `NeverOverRedeemed`. Two checkouts read the
  same count before either writes, and three redemptions go through with a
  limit of two.
- **Reserve, no release on failed payment** violates `Promise`. A reservation
  is a promise; it is felicitous only if it is eventually kept or withdrawn,
  which is a liveness property (`paying ~> confirmed or released`). The
  counterexample also shows the business cost: two abandoned slots, and a
  paying customer turned away.
- **Reserve and release** passes both.

Each counterexample is replayed step by step in
`test/redemption.test.ts`. The tests on flawed designs are marked `it.fails`:
they document known violations and turn red if a flaw silently disappears.
fast-check's scheduler, which explores promise interleavings natively, finds
the same two failures on its own. So a model checker is not required to find
these bugs in this example. Its value is that it states the design and its
properties before any code exists, and checks all interleavings instead of a
sample.

In this study the step from TLC trace to Vitest test was done by hand.
Automating it is open.

### 7. The specification can show which boundaries the inputs miss

Shifting each comparison in the compiled Dafny model (`<` to `<=` and back)
and asking whether the generated inputs tell the shifted model from the
original measures input quality without any implementation
(`experiments/results/boundaries.md`).

Of the model's five comparisons, an exhaustive pass over a small domain shows
that only one is a real boundary: the minimum subtotal. The other four
(both ends of the percentage clamp, the "discount covers everything" check
and the encoding of "no minimum") change nothing when shifted. Biased inputs
reach the real boundary in 10 of 10 seeds, uniform inputs in 0 of 10.

These are the same numbers the implementation-level experiment gave in
finding 4, obtained here from the specification alone. A generator can be
checked against the spec before any code exists, and the check also says
which comparisons in the spec carry meaning.

### 8. On three polished libraries, agent suites were strong and mostly redundant

(`experiments/results/corpus.md`.) Every "after pruning" number is measured
on a copy where the tests were actually deleted, not computed.

| Library | Suite | Tests | Stryker detected | Semantic caught | Tests after pruning |
|---|---|---:|---:|---:|---:|
| scule | human | 63 | 75 / 81 | 7 / 8 | 46 |
| scule | agent | 339 | 80 / 81 | 8 / 8 | 9 |
| defu | human | 23 | 87 / 103 | 6 / 8 | 8 |
| defu | agent | 225 | 101 / 103 | 8 / 8 | 21 |
| destr | human | 22 | 111 / 141 | 6 / 8 | 20 |
| destr | agent | 396 | 140 / 141 | 8 / 8 | 119 |

Pruning never lost a detection: each pruned copy detects exactly the same
mutants of both kinds as the full suite.

The conditions matter for everything below: three small, mature, well
documented libraries, a clean isolated task, a clear README, no existing
tests to imitate, Stryker on disk. That is close to the best context an
agent can get. Field data on agent pull requests, where context is real and
messy, finds mostly weak oracles (see [PRIOR_ART.md](PRIOR_ART.md)). These
results say what agents do in this context, not what they do in general.

- **In this context, the agent suites were strong.** They were 5 to 18 times larger than
  the human ones, detected more Stryker mutants, and caught all 24 semantic
  mutants where the human suites caught 19. Two of the three agents also ran
  mutation testing on their own suites, unprompted. The agents reported
  suspected bugs; three were confirmed against the pinned code: scule splits
  letters outside the Basic Multilingual Plane into invalid UTF-16, destr's
  strict mode accepts `'"'`, which `JSON.parse` rejects, and defu drops
  symbol keys from all but the last argument.
- **They were mostly redundant.** Pruning cut them from 339 to 9 tests, 225
  to 21 and 396 to 119. Pruned, the scule and defu agent suites are smaller
  than the human suites and still catch more.
- **Human suites carry redundancy too.** defu's went from 23 tests to 8.
  scule's is redundant mostly inside `test.each` tables, so only 63 to 46
  could actually be deleted.
- **Most of what the human suites missed is documented.** scule's README
  says numbers are ignored for case changes; defu's says the inputs are
  never modified and only `null` and `undefined` are skipped; destr's
  promises to avoid prototype pollution, which the missed mutant breaks
  through escaped keys. The exception is destr's cap on the digits it parses
  as numbers, which the README does not mention. Since the agent suites catch
  all eight mutants of each library, none of them is equivalent.
- **Syntactic-only pruning was unsafe again, on one library.** On scule it
  would have dropped the tests behind 5 of the human suite's 7 semantic
  catches and 4 of the agent suite's 8. On defu and destr it lost nothing.
- **Tables limit what can be deleted.** A `test.each` table or a loop is one
  definition in the source that produces many tests; it can only be deleted
  when every test it produces is redundant. destr's agent suite keeps 119
  tests for that reason, although 22 of them would keep the same detections;
  defu's keeps 21 where 12 would do, and scule's human suite 46 where 11
  would do.

### 9. Pruning keeps fault coverage and loses case coverage

Pruning was measured against faults: the pruned suite rejects the same
mutants. A stricter question is whether it still checks the same cases,
every input-to-output pair the full suite checks
(`experiments/results/cases.md`).

The measure: record every call each test makes to the library; then, for
each removed test, run both suites against an implementation that is exact
except on that test's calls, where it returns a wrong result. The full suite
must fail (otherwise the perturbation is not observable). If the pruned
suite passes, the removed test's cases are no longer checked.

| Library | Suite | Tests removed | Perturbation observable | Cases still checked | Cases lost |
|---|---|---:|---:|---:|---:|
| scule | human | 17 | 14 | 0 | 14 |
| scule | agent | 330 | 295 | 22 | 273 |
| defu | human | 15 | 14 | 2 | 12 |
| defu | agent | 204 | 176 | 2 | 174 |
| destr | human | 2 | 2 | 0 | 2 |
| destr | agent | 277 | 255 | 13 | 242 |

About 95% of the observable cases of removed tests are no longer checked
by anything. This is close to inevitable: a test is usually the only one
that uses its exact inputs, so removing it removes its cases, and mutants
only show that those cases added no rejection power over the sample.

"Coverage" therefore needs a definition before a suite can shrink without
losing it. Fault coverage survives pruning; case coverage does not. Keeping
both means compressing rather than deleting: folding redundant tests into
rows of the tests that stay, so the cases remain as data while the test
code shrinks.

### 10. A test can only go if it is derivable

Finding 9 has a precise cause. Treat each test as a proposition and the
specification as axioms. A test is independent if there is a countermodel:
an implementation that satisfies everything else and violates it (Padoa's
method for the independence of axioms). It is redundant only if it is
derivable from the tests that stay plus the axioms. A mutant is a
countermodel, so finding one proves a test necessary; not finding one in a
sample proves nothing. Pruning on mutants treated that absence as a
derivation, and lost the cases.

Three experiments measure derivability directly (`experiments/derivation/`):

- **Coupon, with Z3** (`results/derivation-coupon.md`). Each value test of
  the agent-style suite becomes a fact about an uninterpreted function. Of
  the 15 tests pruning removed, 0 follow from the kept tests alone, 4 from
  the kept tests plus the six proved rules, and 15 from the kept tests plus
  the model. Every "no" comes with a countermodel, confirmed by building that
  implementation and checking the rules on it. They show exactly what the
  rules leave open: "10% off 1000 is 900" does not follow, because 901
  satisfies every rule; the rounding rule bounds the discount from above but
  never says it is the floor. The 4 kept tests form an irredundant basis:
  each has a countermodel that satisfies all the others.
- **Coupon, with Lean** (`lean/Cases.lean`). All 25 value tests are
  theorems about the Lean model, each closed by `decide`, a kernel-checked
  certificate that the test is an instance of the model. The 6 others make
  no claim a pure model can express. One of them, "does not mutate the
  input", is a property of the implementation, not of the function.
- **scule, with relational axioms** (`results/derivation-scule.md`). Three
  relations read from scule's source and README (converters are
  `splitByCase` plus a recipe, `camelCase` is `lowerFirst` of `pascalCase`,
  snake and flat case are kebab case with another joiner) hold on 5,000
  generated inputs each. Closing the kept tests' facts under them makes 4 of
  the 14 lost human cases derivable, and 3 of the 273 lost agent cases. No
  derived value contradicted a test. Relations move a fact between functions
  on the same input; almost every lost case is about an input no kept test
  touches.

How far a suite can shrink without losing cases is therefore a function of
how much is formally known:

| Knowledge | Coupon tests derivable | scule lost cases derivable |
|---|---:|---:|
| the kept tests only | 0 / 15 | 0 |
| + relations between functions | not applicable | 4 / 14 human, 3 / 273 agent |
| + proved rules | 4 / 15 | no rules |
| + full model | 15 / 15 | no model |

Without a formal core, the only sound cut is a duplicate case. With a full
model, every case is derivable, and what is left to test is that the code
matches the model.

## What this says about the ideas

- **Tests as predicates over implementations** works as a basis: vacuity,
  redundancy and test strength all fall out of one kill matrix, without a
  catalogue of ad hoc rules.
- **Meaning needs more than syntax.** The inferential level (what a test
  rules out) is measurable, but only against a sample. Semantic mutants are
  the cheapest way found here to bring intent into that sample.
- **A translation layer around formal tools is viable** for pure functions
  with simple data. Nobody using the coupon suite needs to read Dafny or
  Lean; a failure is an ordinary Vitest diff with a small input. Behind a
  line-oriented protocol, the formal language is a replaceable part.
- **Input quality can be measured against the spec** before any code
  exists, by mutating the model instead of the implementation.
- **Test quality may depend on context more than on the agent.** With a
  clean, documented, isolated task, the agents here wrote strong suites in
  which most tests added nothing; field data from messy real projects shows
  mostly weak oracles. This is a hypothesis, not a finding: it needs the
  same agent and code under varied context.
- **Pruning is only sound as derivation.** A mutant proves a test
  necessary; only a proof shows it is unnecessary. How much a suite can
  shrink without losing cases depends on how much formal knowledge exists.
- **Specification cannot be avoided, only moved.** Every gain in this study
  came from someone stating what correct means: rules, a model, mutants,
  a TLA+ property. The tools only make that statement checkable.

## Limits

- One small function, one small protocol and three small pure libraries.
  Nothing here shows how the approach scales to glue code, I/O or an
  application codebase.
- The coupon's agent-style suite was written to imitate agent output. The
  corpus suites were written by real agent runs, but by one model family,
  once each, with one prompt.
- In the corpus, the test-writing and mutant-writing agents shared a
  directory. The test writers saw the mutant files' names in a listing and
  report not opening them; their suites were validated against the pinned,
  unmodified code.
- The human suites belong to small, mature libraries; they are a baseline of
  careful human work, not of typical application tests.
- In the coupon example, the semantic mutants, the rules and both models were
  written by the same author, an AI coding agent, in the same session. Blind
  spots may be shared. In the corpus, mutants and suites came from separate
  agents, but of the same model family.
  The fixed-coupon gap in the rules is one that surfaced; others may not have.
- Greedy set cover is not guaranteed minimal.
- No agent was run with and without these tools, so nothing here measures
  effect on agent task success.

## Next

- Prune at the table-row level, so a redundant row of a `test.each` table
  can go without its siblings.
- Use the boundaries the spec reveals to generate inputs, not only to
  measure them.
- Run the corpus with agents of different model families and several runs
  each, to measure how much of this is one model's habit.
- Translate TLC traces into native tests automatically.
- An ablation: agent task success with and without the pruning gate in CI.
