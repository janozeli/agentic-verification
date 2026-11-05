# Historical faults

Each fault is the revert of a real fix commit, applied to the pinned source.
Cells: failing tests in the full suite / in the pruned suite.

| Library | Fault | Human | Agent |
|---|---|---:|---:|
| scule | 57cfd15: fix(isUppercase): assume characters lowercase by default (#71) | 1 / 1 | 25 / 1 |
| defu | 11ba022: fix: ignore inherited enumerable properties | 1 / 0 | 1 / 1 |
| defu | 1b9fcab: fix: merge objects with `Module` type (#121) | 1 / 1 | 3 / 2 |
| destr | d9ba16d: fix: parsing decimals and scientific notation (#94) | 1 / 1 | 18 / 10 |
