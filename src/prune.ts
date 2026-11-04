// Reads a Stryker mutation report and decides which tests earn their place.
//
// A test is a predicate over implementations. Mutants are a sample of wrong
// implementations, so what a test kills approximates what it rejects:
//   - vacuous:   kills nothing
//   - redundant: everything it kills is killed by the tests that are kept
// The kept set is a greedy set cover: same killed mutants, fewer tests.

export type TestCase = { id: string; name: string; file: string; line?: number };

export type Mutant = {
  id: string;
  file: string;
  line: number;
  mutator: string;
  replacement: string;
  status: string;
  killedBy: string[];
};

export type Analysis = {
  tests: TestCase[];
  kept: TestCase[];
  vacuous: TestCase[];
  redundant: TestCase[];
  survived: Mutant[];
  killedCount: number;
};

type Report = {
  files: Record<string, { mutants: any[] }>;
  testFiles?: Record<string, { tests: any[] }>;
};

export function readReport(report: Report): { tests: TestCase[]; mutants: Mutant[] } {
  const tests: TestCase[] = [];
  for (const [file, { tests: list }] of Object.entries(report.testFiles ?? {})) {
    for (const t of list) {
      tests.push({ id: t.id, name: t.name, file, line: t.location?.start?.line });
    }
  }
  const mutants: Mutant[] = [];
  for (const [file, { mutants: list }] of Object.entries(report.files)) {
    for (const m of list) {
      mutants.push({
        id: m.id,
        file,
        line: m.location.start.line,
        mutator: m.mutatorName,
        replacement: m.replacement ?? "",
        status: m.status,
        killedBy: m.killedBy ?? [],
      });
    }
  }
  return { tests, mutants };
}

// Greedy set cover. Ties go to the test that appears first, so the result is
// deterministic for a given report.
export function cover(kills: Map<string, Set<string>>, order: string[]): string[] {
  const remaining = new Set<string>();
  for (const ms of kills.values()) for (const m of ms) remaining.add(m);
  const kept: string[] = [];
  while (remaining.size > 0) {
    let best = "";
    let gain = 0;
    for (const t of order) {
      let g = 0;
      for (const m of kills.get(t) ?? []) if (remaining.has(m)) g++;
      if (g > gain) {
        best = t;
        gain = g;
      }
    }
    kept.push(best);
    for (const m of kills.get(best)!) remaining.delete(m);
  }
  return kept;
}

// Semantic mutants refer to tests by full name, as test runners report them.
export type NamedMutant = { id: string; file: string; description: string; killedBy: string[] };

export function analyze(report: Report, semantic: NamedMutant[] = []): Analysis {
  const { tests, mutants } = readReport(report);
  const idByName = new Map(tests.map((t) => [t.name, t.id]));
  for (const s of semantic) {
    const killedBy = s.killedBy.map((n) => idByName.get(n)).filter((id) => id !== undefined);
    mutants.push({
      id: s.id,
      file: s.file,
      line: 1,
      mutator: "Semantic",
      replacement: s.description,
      status: killedBy.length > 0 ? "Killed" : "Survived",
      killedBy,
    });
  }
  const kills = new Map<string, Set<string>>(tests.map((t) => [t.id, new Set()]));
  for (const m of mutants) {
    if (m.status !== "Killed") continue;
    for (const t of m.killedBy) kills.get(t)?.add(m.id);
  }
  const keptIds = new Set(cover(kills, tests.map((t) => t.id)));
  return {
    tests,
    kept: tests.filter((t) => keptIds.has(t.id)),
    vacuous: tests.filter((t) => kills.get(t.id)!.size === 0),
    redundant: tests.filter((t) => !keptIds.has(t.id) && kills.get(t.id)!.size > 0),
    survived: mutants.filter((m) => m.status === "Survived"),
    killedCount: mutants.filter((m) => m.status === "Killed").length,
  };
}
