# Study

## Questions

1. A test is a predicate over implementations: it accepts some and rejects
   others. If we sample wrong implementations, can we measure what each test
   rejects and safely remove the ones that add nothing?
2. Syntactic mutants (`<` to `<=`, `+` to `-`) are the usual sample. Do they
   capture the mistakes that matter, or do we need mutants that encode
   misunderstandings of the domain?
3. Can a formally verified model act as the oracle for ordinary tests, so that
   people and agents only ever see native code and native failures?
4. For behavior over time (concurrency, promises), can a model checker's
   counterexamples come back as native tests?

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

**Redemption** (`examples/redemption`). A coupon with a use limit, redeemed by
concurrent checkouts. `spec/Redemption.tla` models three designs; three
TypeScript functions implement them.

**Determinism.** Stryker runs with per-test coverage and without bailing, so
every test that kills a mutant is recorded. fast-check runs with fixed seeds.
The Dafny output is byte-for-byte reproducible. CI re-runs the study and fails
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
and the whole property file, oracle included, is about a third shorter (101 lines
against 147). The two they miss are both about fixed coupons,
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

### 5. Counterexamples come back as native tests

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

## What this says about the ideas

- **Tests as predicates over implementations** works as a basis: vacuity,
  redundancy and test strength all fall out of one kill matrix, without a
  catalogue of ad hoc rules.
- **Meaning needs more than syntax.** The inferential level (what a test
  rules out) is measurable, but only against a sample. Semantic mutants are
  the cheapest way found here to bring intent into that sample.
- **A translation layer around formal tools is viable** for pure functions
  with simple data. Nobody using the coupon suite needs to read Dafny; a
  failure is an ordinary Vitest diff with a shrunk input.
- **Specification cannot be avoided, only moved.** Every gain in this study
  came from someone stating what correct means: rules, a model, mutants,
  a TLA+ property. The tools only make that statement checkable.

## Limits

- One small function and one small protocol. Nothing here shows how the
  approach scales to glue code, I/O or a real codebase.
- The agent-style suite was written to imitate agent output; it was not
  sampled from real agent runs.
- The semantic mutants, the rules and the model were written by the same
  author, an AI coding agent, in the same session. Blind spots may be shared.
  The fixed-coupon gap in the rules is one that surfaced; others may not have.
- Greedy set cover is not guaranteed minimal.
- No agent was run with and without these tools, so nothing here measures
  effect on agent task success.

## Next

- Run the pruner on a real repository whose tests were written by agents.
- Generate semantic mutants from a task description and measure how many
  survive review.
- Translate TLC traces into native tests automatically.
- An ablation: agent task success with and without the pruning gate in CI.
