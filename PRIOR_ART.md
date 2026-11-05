# Prior art, blind spots, unknown unknowns

What already exists for each idea in [STUDY.md](STUDY.md), what this study
adds, what it does not see, and how to look for what nobody here has thought
of. "Not found" means not found in this search, not that it does not exist.

## Prior art

| Idea in this study | Closest prior work | What it already establishes | What is left for this study |
|---|---|---|---|
| Prune tests by the mutants they kill (greedy set cover) | Test-suite minimization, Harrold–Gupta–Soffa heuristic; Rothermel et al. 2002; Jehan & Wotawa 2023 (greedy, mutation coverage, JavaScript) | Standard technique. Evidence on its cost is mixed: Wong et al. saw little loss, Rothermel et al. saw fault detection "severely compromised" (about 80% smaller suites losing about 48% of fault detection). | Nothing new in the algorithm. The case-coverage measurement (finding 9) is a sharper, black-box version of the loss Rothermel measured. |
| Redundancy is relative to a sample; absence of a countermodel is not a derivation | Mutant subsumption graphs and dominator mutants (Ammann, Kurtz, Offutt, Delamaro et al. 2014–2016) | "True" subsumption is undecidable; dynamic subsumption over a finite test set approximates it and can report subsumptions that are false. Most non-equivalent mutants are redundant, which inflates scores. | The dual on the test side, with Padoa's method as the frame, and the measured ladder from points to rules to model (finding 10). Not found as such. |
| Vacuous tests, trivial implementations | Pseudo-tested methods and extreme mutation (Niedermayr et al. 2016; Descartes; Maton et al. 2024 at statement level) | Methods whose whole body can be removed with no failing test are common; statement-level analysis finds many more. | Nothing new; the trivial-implementation check is extreme mutation. |
| Tests that execute but check nothing; case coverage | Checked coverage (Schuler & Zeller 2011, 2013); state field coverage (2025); the oracle problem survey (Barr et al. 2015) | Oracle quality can be measured by what the assertions actually depend on; checked coverage reacts to removed assertions more than mutation does. | Case coverage by per-test perturbation is a black-box relative of checked coverage, applied to pruning. Not found applied this way. |
| Semantic mutants written by an LLM | Meta's ACH (Foster, Harman et al. 2025); nl2postcond (Endres, Fakhoury, Chakraborty, Lahiri, FSE 2024) | ACH generates few, concern-specific mutants with an LLM, plus an LLM equivalence detector, and engineers accepted most of its tests. nl2postcond already uses LLM-written code mutants to measure how complete a specification is. | Using them to make pruning safe, as committed patches against pinned code, written by an agent that never saw the tests. Incremental. |
| Mutate the specification to judge inputs | Specification mutation with model checkers (Ammann & Black 1998; Black, Okun & Yesha 2000) | Mutating a formal spec gives a coverage metric for test sets; counterexamples become tests; equivalent spec mutants are detected automatically. | Applied to a property-based input generator against a Dafny model (finding 7). A direct descendant, not a new idea. |
| Model-checker counterexamples as tests; checking code against TLA+ | Ammann & Black (same work); trace validation against TLA+ (Cirstea, Kuppe, Loillier & Merz 2024) | Counterexamples convert into complete test cases. Trace validation found spec–implementation discrepancies in every distributed program it was applied to. | This study replays counterexamples by hand; trace validation is the stronger, existing method. |
| Proofs make some tests unnecessary | Complementing partial verification with test generation (Christakis, Müller & Wüstholz) | Test generation can skip executions already verified and focus on what the proofs do not cover. | The test-suite side: which existing tests a proof makes derivable, with certificates (Lean `decide`) and countermodels (Z3). |
| Formal model as oracle, LLM-friendly languages | Vericoding benchmark (2025); Dafny as an intermediate language for LLM code generation (2025); Cedar in Lean | LLMs succeed far more often in Dafny than in Lean; verified intermediate code compiled to a target language is being explored. | The protocol view (model as a line-oriented filter) and the measured cost of the process boundary. Minor. |
| What agents write when they write tests | Test smells in LLM-generated tests (Ouédraogo et al. 2024–2025); tests in agentic pull requests (Haque, Ingale & Csallner, MSR 2026; Yoshimoto et al., MSR 2026); oracle signals in agent-authored tests (2026) | LLM tests carry the same smells as human ones; agents now write a sizeable share of test-adding commits; most agent test patches in the wild have weak or no oracles, with large differences between agents. | A controlled comparison on the same code against the maintainers' suites. The agents here wrote strong suites, which contrasts with the population data; see blind spots. |
| Relevance: which detections matter | Operational profile (Musa); operational and relative coverage (Miranda & Bertolino 2016–2020) | Coverage can be weighted by how the software is actually used. | Not addressed here at all. |

## Blind spots

Known limits of the method, most of them flagged by the prior work above.

**Mutants are a weak proxy for real faults.** Correlations between mutation
score and real fault detection are weak once suite size is controlled for
(Papadakis et al., ICSE 2018). "Same detections after pruning" is a claim
about mutants, not about the bugs a project will actually have.

**Scores include redundant and equivalent mutants.** Most mutants are
subsumed by others (Kurtz et al.), and equivalents were only handled case by
case here. The pruning is unaffected; the reported detection counts are
inflated in a way that differs per library.

**Pruning damages things that were not measured:**
- Fault localization gets worse when suites are reduced (Yu, Jones &
  Harrold, ICSE 2008).
- A test also documents intent. The pruner flagged defu's prototype-
  pollution tests as redundant; no maintainer would delete them.
- Type-level tests are invisible to runtime mutation. The agents' `types.test.ts`
  files assert types that only `tsc` checks, so the pruner sees them as
  vacuous and would delete them.

**Oracle strength was not measured.** A test that runs code and asserts
little can still kill mutants by crashing. Checked coverage or assertion
analysis would separate the two.

**The agents are not the population.** Here, one model family wrote every
agent suite, once, with one prompt, on tiny pure libraries, with Stryker on
disk (two agents ran it unprompted). Field data shows most agent-written test
patches have weak oracles, and that this varies a lot between agents. The
strong agent suites here may say more about this setup than about agents.

**Correlated authorship.** The suites, the semantic mutants and the
analysis all came from the same model family. ACH's engineers judged only a
minority of its LLM tests relevant to the targeted concern; nobody judged the
relevance of the mutants here.

**The model–code gap.** Proofs cover the Dafny and Lean models; the
TypeScript is connected only through a differential test and a hand-written
adapter. Trace validation found discrepancies in every system it checked,
which suggests that gap is rarely empty.

**Small domains.** Equivalence of spec mutants was decided on an exhaustive
small domain. Z3 entailment was computed on a finite grid. Both are sound
for what they claim and silent about everything outside the grid.

## Unknown unknowns

These cannot be listed, only searched for. Each probe is meant to make the
method fail in a way nobody predicted.

1. **Replay history.** Take a library's real bug-fix commits, check out the
   parent, and ask whether the full and the pruned suites catch each fix's
   regression. Misses that mutants did not predict are, by construction,
   failures nobody modeled. (A JavaScript bug benchmark such as BugsJS fits.)
2. **Run it on code that changes.** A suite pruned for one version guards
   that version. Measure detections across the next N releases; pruning may
   remove exactly the tests that would have caught future changes.
3. **Let agents work under the gate.** Two agents optimized for mutation
   score unprompted. Under a pruning or mutation gate, agents may write tests
   aimed at mutants instead of behavior (Goodhart's law). Only an ablation
   with real tasks shows what they do.
4. **Replicate across models and runs.** Several model families, several
   runs each. The variance is unknown; it may be larger than every effect
   reported here.
5. **Ask maintainers.** Send pruning suggestions and the three confirmed bugs
   to the libraries' maintainers. What they reject, and why, is information
   none of the metrics can produce.
6. **Leave the pure-function regime.** I/O, state, time, concurrency in real
   code, UI. Each changes what a case, a mutant and a derivation even are.
7. **Attack the instruments.** Every instrument here was wrong at least once
   before its numbers were accepted (patches silently not applied, a wrapper
   with invalid syntax, an identity check broken by wrapping). A second,
   independent implementation of each measurement is the cheapest way to find
   the errors that are still there.

## Sources

- Rothermel, Harrold, von Ronne, Hong, [Empirical studies of test-suite reduction](https://zendy.io/title/10.1002/stvr.256), STVR 2002; Jeffrey & Gupta, [Improving fault detection capability by selectively retaining test cases during test suite reduction](https://typeset.io/pdf/improving-fault-detection-capability-by-selectively-4e3mzckg21.pdf), TSE 2007; Jehan & Wotawa, [An empirical study of greedy test suite minimization techniques using mutation coverage](https://doaj.org/article/2c476261156943f588292e22db8300bd), IEEE Access 2023
- Kurtz, Ammann, Delamaro, Offutt, Deng, [Mutant subsumption graphs](https://www.academia.edu/124341041/Mutant_Subsumption_Graphs), ICSTW 2014; Kurtz, Ammann, Offutt, [Static analysis of mutant subsumption](https://researchconnect.suny.edu/en/publications/static-analysis-of-mutant-subsumption/), ICSTW 2015; Kurtz et al., [Analyzing the validity of selective mutation with dominator mutants](https://acikerisim.mu.edu.tr/xmlui/bitstream/handle/20.500.12809/2655/G%C3%B6k%C3%A7e.pdf?sequence=1), FSE 2016
- Niedermayr, Juergens, Wagner, [Will my tests tell me if I break this code?](https://arxiv.org/pdf/1611.07163.pdf), 2016; Vera-Pérez, Monperrus, Baudry, [Descartes](https://www.arxiv.org/pdf/1811.03045); Maton, Kapfhammer, McMinn, [Exploring pseudo-testedness](https://eprints.whiterose.ac.uk/216881/1/paper.pdf), 2024
- Schuler & Zeller, [Assessing oracle quality with checked coverage](https://www.st.cs.uni-saarland.de/publications/files/schuler-icst-2011.pdf), ICST 2011; Barr, Harman, McMinn, Shahbaz, Yoo, [The oracle problem in software testing: a survey](https://discovery.ucl.ac.uk/1471263/), TSE 2015
- Foster, Harman et al., [Mutation-guided LLM-based test generation at Meta](https://arxiv.org/pdf/2501.12862), 2025; Endres, Fakhoury, Chakraborty, Lahiri, [Can LLMs transform natural language intent into formal method postconditions?](https://arxiv.org/pdf/2310.01831), FSE 2024
- Ammann, Black, Majurski, [Using model checking to generate tests from specifications](https://www.nist.gov/node/708391), ICFEM 1998; Black, Okun, Yesha, [Mutation of model checker specifications for test generation and evaluation](https://userpages.cs.umbc.edu/vokun1/Paper/m2000.pdf), 2000
- Cirstea, Kuppe, Loillier, Merz, [Validating traces of distributed programs against TLA+ specifications](https://arxiv.org/pdf/2404.16075), SEFM 2024
- Christakis, Müller, Wüstholz, [complementing partial verification with test generation](https://kar.kent.ac.uk/id/document/56313)
- [A benchmark for vericoding](https://arxiv.org/pdf/2509.22908), 2025
- Ouédraogo et al., [Test smells in LLM-generated unit tests](https://arxiv.org/abs/2410.10628v2); Haque, Ingale, Csallner, [Do autonomous agents contribute test code?](https://arxiv.org/pdf/2601.03556), MSR 2026; Yoshimoto et al., [Testing with AI agents](https://arxiv.org/pdf/2603.13724), MSR 2026; [All smoke, no alarm: oracle signals in agent-authored test code](https://www.emergentmind.com/papers/2606.18168), 2026
- Papadakis et al., [Are mutation scores correlated with real fault detection?](https://ieeexplore.ieee.org/document/8453121), ICSE 2018; Yu, Jones, Harrold, [An empirical study of the effects of test-suite reduction on fault localization](https://ersearch2.cvtisr.sk/vufind/SummonRecord/FETCH-LOGICAL-a344t-b997beacabcd7d75efaee1d8f15880ce84a44f10f6ea6e3cf56551f4f908f7ca3/Details), ICSE 2008
- Miranda & Bertolino, [Testing relative to usage scope: revisiting software coverage criteria](https://iris.cnr.it/retrieve/d727f31f-f4e7-444e-8c2b-25b67977994a/Miranda_Bertolino_Tosem20.pdf), TOSEM 2020
