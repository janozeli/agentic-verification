| Suite | Tests | Stryker mutants killed | Semantic mutants caught | Semantic mutants missed |
|---|---:|---:|---:|---|
| Agent-style examples | 31 | 25 / 27 | 5 / 9 | exclusive-minimum, minimum-after-discount, no-clamp, per-item-rounding |
|   pruned on Stryker mutants only | 4 | 25 / 27 | 3 / 9 | exclusive-minimum, fixed-per-unit, minimum-after-discount, no-clamp, per-item-rounding, rounds-up |
|   pruned on Stryker + semantic mutants | 5 | 25 / 27 | 5 / 9 | exclusive-minimum, minimum-after-discount, no-clamp, per-item-rounding |
| Properties (the model's rules) | 4 | 22 / 27 | 7 / 9 | fixed-in-reais, fixed-per-unit |
| Oracle (verified Dafny model) | 1 | 26 / 27 | 9 / 9 | none |
| Properties + oracle | 5 | 26 / 27 | 9 / 9 | none |

Lines of test code: examples 147, properties + oracle 101.

Stryker survivors, examples: `ConditionalExpression -> true`; `EqualityOperator -> base <= coupon.minSubtotalCents`.
Stryker survivors, properties + oracle: `ConditionalExpression -> true`.

Semantic mutants the full example suite catches but the Stryker-only pruning loses: fixed-per-unit, rounds-up.

Vacuous example tests: "subtotal > is defined", "subtotal > does not mutate the input", "applyCoupon > is defined", "applyCoupon > does not throw with a coupon".
