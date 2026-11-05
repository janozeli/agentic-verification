// Property-style tests: run defu against many deterministic pseudo-random
// inputs and check invariants that follow from its documented semantics.
import { describe, expect, it } from "vitest";
import { defu } from "../src/defu";

type Value = unknown;
type PlainObject = Record<string, Value>;

const KEYS = ["a", "b", "c", "d"];
const ITERATIONS = 300;

// Small seeded PRNG (mulberry32) so failures are reproducible.
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (max: number) => Math.floor(next() * max);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!;
  return { next, int, pick };
}

type Random = ReturnType<typeof createRandom>;

function randomScalar(random: Random): Value {
  return random.pick<() => Value>([
    () => random.int(5),
    () => 0,
    () => random.pick(["", "x", "y"]),
    () => random.next() < 0.5,
    () => null,
    () => undefined,
  ])();
}

function randomValue(random: Random, depth: number): Value {
  const roll = random.next();
  if (depth > 0 && roll < 0.3) {
    return randomObject(random, depth - 1);
  }
  if (depth > 0 && roll < 0.5) {
    return Array.from({ length: random.int(3) }, () => randomValue(random, depth - 1));
  }
  return randomScalar(random);
}

function randomObject(random: Random, depth: number): PlainObject {
  const object: PlainObject = {};
  for (const key of KEYS) {
    if (random.next() < 0.6) {
      object[key] = randomValue(random, depth);
    }
  }
  return object;
}

function randomArgument(random: Random): Value {
  // Mostly plain objects, sometimes values defu should ignore.
  return random.next() < 0.85
    ? randomObject(random, 3)
    : random.pick<Value>([null, undefined, 1, "str", [1, 2], true]);
}

const isPlain = (value: Value): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks that `result` is the defu-merge of `sources` (plain objects, highest
 * priority first):
 *  - the first non-nullish value for a key decides the kind of result;
 *  - scalars: leftmost wins;
 *  - arrays: all later arrays are concatenated in priority order;
 *  - plain objects: all later plain objects are merged recursively;
 *  - keys whose values are all nullish end up nullish or absent;
 *  - no keys appear that were not in any source.
 */
function expectMergedFrom(result: Value, sources: PlainObject[], path = "$"): void {
  expect(isPlain(result), `${path} should be a plain object`).toBe(true);
  const resultObject = result as PlainObject;
  const keys = new Set(sources.flatMap((source) => Object.keys(source)));

  for (const key of Object.keys(resultObject)) {
    expect(keys.has(key), `${path}.${key} should come from a source`).toBe(true);
  }

  for (const key of keys) {
    const keyPath = `${path}.${key}`;
    const values = sources.map((source) => source[key]);
    const firstIndex = values.findIndex((value) => value !== null && value !== undefined);

    if (firstIndex === -1) {
      expect(resultObject[key] == null, `${keyPath} should be nullish or absent`).toBe(true);
      continue;
    }

    const first = values[firstIndex];
    const candidates = values.slice(firstIndex);

    if (Array.isArray(first)) {
      const expected = candidates.filter((value) => Array.isArray(value)).flat(1);
      expect(resultObject[key], keyPath).toStrictEqual(expected);
    } else if (isPlain(first)) {
      expectMergedFrom(resultObject[key], candidates.filter(isPlain), keyPath);
    } else {
      expect(resultObject[key], keyPath).toBe(first);
    }
  }
}

function forEachCase(run: (random: Random, seed: number) => void): void {
  for (let seed = 1; seed <= ITERATIONS; seed++) {
    const random = createRandom(seed);
    try {
      run(random, seed);
    } catch (error) {
      throw new Error(`Failed for seed ${seed}: ${(error as Error).message}`, { cause: error });
    }
  }
}

describe("defu invariants on generated inputs", () => {
  it("merges according to leftmost priority, array concatenation and deep object merging", () => {
    forEachCase((random) => {
      const args = Array.from({ length: random.int(5) }, () => randomArgument(random));
      const result = (defu as any)(...args);
      expectMergedFrom(result, args.filter(isPlain));
    });
  });

  it("never mutates its arguments", () => {
    forEachCase((random) => {
      const args = Array.from({ length: 1 + random.int(4) }, () => randomArgument(random));
      const snapshot = structuredClone(args);
      (defu as any)(...args);
      expect(args).toStrictEqual(snapshot);
    });
  });

  it("returns a new top-level object that is none of its arguments", () => {
    forEachCase((random) => {
      const args = Array.from({ length: 1 + random.int(4) }, () => randomArgument(random));
      const result = (defu as any)(...args);
      for (const arg of args) {
        expect(result).not.toBe(arg);
      }
    });
  });

  it("returns an equal copy for a single plain object argument", () => {
    forEachCase((random) => {
      const object = randomObject(random, 3);
      expect(defu(object)).toStrictEqual(object);
    });
  });

  it("returns an equal copy when merging into an empty object", () => {
    forEachCase((random) => {
      const object = randomObject(random, 3);
      expect(defu({}, object)).toStrictEqual(object);
    });
  });

  it("drops only top-level nullish values when the defaults are empty", () => {
    forEachCase((random) => {
      const object = randomObject(random, 3);
      const expected = Object.fromEntries(Object.entries(object).filter(([, value]) => value != null));
      expect(defu(object, {})).toStrictEqual(expected);
    });
  });

  it("is equivalent to folding the arguments pairwise from the left", () => {
    forEachCase((random) => {
      const a = randomObject(random, 3);
      const b = randomObject(random, 3);
      const c = randomObject(random, 3);
      expect(defu(a, b, c)).toStrictEqual(defu(defu(a, b), c));
    });
  });
});
