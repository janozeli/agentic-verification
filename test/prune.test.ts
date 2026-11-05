import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { analyze, cover } from "../src/prune";
import { removeCalls } from "../src/remove";

fc.configureGlobal({ seed: 42, numRuns: 500 });

// Random kill matrices: test id -> mutants it kills.
const matrix = fc
  .array(fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 12 }), { maxLength: 15 })
  .map((rows) => new Map(rows.map((ms, i) => [`t${i}`, new Set(ms.map((m) => `m${m}`))])));

const killedBy = (kills: Map<string, Set<string>>, tests: string[]) =>
  new Set(tests.flatMap((t) => [...(kills.get(t) ?? [])]));

describe("cover", () => {
  it("keeps exactly the mutants the whole suite kills", () => {
    fc.assert(
      fc.property(matrix, (kills) => {
        const all = [...kills.keys()];
        expect(killedBy(kills, cover(kills, all))).toEqual(killedBy(kills, all));
      }),
    );
  });

  it("every kept test kills something no earlier kept test kills", () => {
    fc.assert(
      fc.property(matrix, (kills) => {
        const kept = cover(kills, [...kills.keys()]);
        kept.forEach((t, i) => {
          const before = killedBy(kills, kept.slice(0, i));
          expect([...kills.get(t)!].some((m) => !before.has(m))).toBe(true);
        });
      }),
    );
  });
});

describe("removeCalls", () => {
  const src = [
    'describe("a", () => {',
    '  it("keeps", () => {',
    "    expect(f(`)`)).toBe(1);",
    "  });",
    "",
    '  it("goes", () => {',
    '    // a ) in a comment',
    '    expect(g(")")).toBe(2);',
    "  });",
    "});",
    "",
    'describe("b", () => {',
    '  it("goes too", () => {});',
    "});",
    "",
  ].join("\n");

  it("removes the calls and the groups they leave empty, nothing else", () => {
    expect(removeCalls(src, [6, 13])).toBe(
      ['describe("a", () => {', '  it("keeps", () => {', "    expect(f(`)`)).toBe(1);", "  });", "});", ""].join("\n"),
    );
  });
});

describe("removeCalls on each-tables", () => {
  // Runners report the line where the test call starts, which for a
  // multi-line table is the `])(` line, not the `test.each(` line.
  const src = [
    'describe("g", () => {',
    "  test.each([",
    "    [1],",
    "    [2],",
    '  ])("n %s", (n) => {',
    "    expect(n).toBeGreaterThan(0);",
    "  });",
    "",
    '  it("stays", () => {});',
    "});",
    "",
  ].join("\n");

  it("removes the whole table and its call from any line inside it", () => {
    const expected = ['describe("g", () => {', '  it("stays", () => {});', "});", ""].join("\n");
    expect(removeCalls(src, [5])).toBe(expected);
    expect(removeCalls(src, [2])).toBe(expected);
  });
});

describe("analyze", () => {
  it("reports a mutant no test covers as one no test rejects", () => {
    const report = {
      testFiles: { "a.test.ts": { tests: [{ id: "0", name: "t" }] } },
      files: {
        "a.ts": {
          language: "typescript",
          source: "",
          mutants: [
            { id: "1", mutatorName: "M", replacement: "x", status: "Killed", killedBy: ["0"], location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } },
            { id: "2", mutatorName: "M", replacement: "y", status: "NoCoverage", location: { start: { line: 2, column: 1 }, end: { line: 2, column: 2 } } },
            { id: "3", mutatorName: "M", replacement: "z", status: "Timeout", location: { start: { line: 3, column: 1 }, end: { line: 3, column: 2 } } },
          ],
        },
      },
    };
    expect(analyze(report as never).survived.map((m) => m.id)).toEqual(["2"]);
  });
});
