Axioms, checked against scule on 5,000 generated inputs each:

| Axiom | Holds |
|---|---|
| converters are splitByCase plus a recipe | yes |
| camelCase is lowerFirst of pascalCase | yes |
| snake and flat case are kebab case with another joiner | yes |

| Suite | Lost tests | Derivable from kept facts + axioms | Derived value contradicts the test |
|---|---:|---:|---:|
| human | 14 | 4 | 0 |
| agent | 273 | 3 | 0 |
