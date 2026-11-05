| Library | Suite | Tests | Stryker detected | Semantic caught | Pruned: tests | Pruned: Stryker detected | Pruned: semantic caught | Semantic lost if pruned on Stryker only |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| scule | human | 63 | 75 / 81 | 7 / 8 | 46 | 75 / 81 | 7 / 8 | 5 |
| scule | agent | 339 | 80 / 81 | 8 / 8 | 9 | 80 / 81 | 8 / 8 | 4 |
| defu | human | 23 | 87 / 103 | 6 / 8 | 8 | 87 / 103 | 6 / 8 | 0 |
| defu | agent | 225 | 101 / 103 | 8 / 8 | 21 | 101 / 103 | 8 / 8 | 0 |
| destr | human | 22 | 111 / 141 | 6 / 8 | 20 | 111 / 141 | 6 / 8 | 0 |
| destr | agent | 396 | 140 / 141 | 8 / 8 | 119 | 140 / 141 | 8 / 8 | 0 |

Notes (semantic mutants missed, and what pruning could delete in source):
- scule, human: 01-digits-count-as-lowercase.
- scule, human pruning: 11 test definitions in source; 4 can be deleted; 35 removable tests share a definition with tests that stay.
- scule, agent pruning: 136 test definitions in source; 127 can be deleted.
- defu, human: 03-falsy-values-skipped, 07-defaults-mutated-in-place.
- defu, human pruning: 23 test definitions in source; 15 can be deleted.
- defu, agent pruning: 146 test definitions in source; 134 can be deleted; 9 removable tests share a definition with tests that stay.
- destr, human: 07-proto-regex-ignores-unicode-escapes, 08-unbounded-number-digits.
- destr, human pruning: 17 test definitions in source; 2 can be deleted; 4 removable tests share a definition with tests that stay.
- destr, agent pruning: 94 test definitions in source; 77 can be deleted; 97 removable tests share a definition with tests that stay.
