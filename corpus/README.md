# Corpus

Real libraries used to test the ideas outside a toy example. Their code is
not in this repository: `fetch.sh` clones each one into `vendor/` (ignored by
git) at the commit pinned in `libraries.json`. Only what we add is versioned:

- `<name>/agent/`: a test suite written by a coding agent that saw the
  library's `src/` and README, never its own tests. It was asked to "add a
  comprehensive Vitest test suite", as a user would ask.
- `<name>/mutants/`: semantic mutants written by a second agent from the same
  `src/` and README, also without seeing any tests. Each is a patch against
  the pinned commit; its first line describes the misunderstanding it encodes.

Third-party code only runs through `offline`, which removes network access
except loopback.

| Library | What it does | License |
|---|---|---|
| [unjs/scule](https://github.com/unjs/scule) | string case utilities | MIT |
| [unjs/defu](https://github.com/unjs/defu) | recursive default properties | MIT |
| [unjs/destr](https://github.com/unjs/destr) | safer JSON.parse | MIT |

The patches are small derivative changes of MIT-licensed code; the original
copyright and license remain with the libraries' authors.
