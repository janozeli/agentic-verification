import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { destr, safeDestr } from "../src/index";

const NUM_RUNS = 500;

let warn: MockInstance<typeof console.warn>;
const objectProtoKeys = Object.getOwnPropertyNames(Object.prototype).sort();

beforeEach(() => {
  // Random input can occasionally contain a "__proto__"/"constructor" key.
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(objectProtoKeys);
});

/** Arbitrary strings, biased towards prefixes that reach the JSON.parse branch. */
const anyString = fc.oneof(
  fc.string({ unit: "binary" }),
  fc.string({ unit: "grapheme-ascii" }),
  fc
    .tuple(
      fc.constantFrom("{", "[", '"', " ", "-", "1", '{"__proto__":', '{"constructor":'),
      fc.string({ unit: "grapheme-ascii" }),
      fc.constantFrom("", "}", "]", '"', " "),
    )
    .map(([prefix, body, suffix]) => prefix + body + suffix),
  fc.jsonValue().map((value) => JSON.stringify(value)),
);

/** JSON text for objects and arrays that contain no dangerous keys. */
const safeJsonText = fc
  .oneof(fc.array(fc.jsonValue()), fc.dictionary(fc.string(), fc.jsonValue()))
  .chain((value) =>
    fc.constantFrom(JSON.stringify(value), JSON.stringify(value, null, 2), ` \n${JSON.stringify(value)}\t `),
  )
  .filter((text) => !text.includes("__proto__") && !text.includes("constructor"));

describe("properties", () => {
  it("destr never throws in non-strict mode", () => {
    fc.assert(
      fc.property(anyString, (input) => {
        destr(input);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns every non-string value as-is in both modes", () => {
    fc.assert(
      fc.property(
        fc.anything({ withBigInt: true, withDate: true, withMap: true, withSet: true, withTypedArray: true }).filter(
          (value) => typeof value !== "string",
        ),
        (value) => {
          expect(destr(value)).toBe(value);
          expect(safeDestr(value)).toBe(value);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("round-trips any string serialized with JSON.stringify", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: "binary" }), fc.string()), (value) => {
        const text = JSON.stringify(value);
        expect(destr(text)).toBe(value);
        expect(safeDestr(text)).toBe(value);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("parses objects and arrays exactly like JSON.parse", () => {
    fc.assert(
      fc.property(safeJsonText, (text) => {
        expect(destr(text)).toEqual(JSON.parse(text));
        expect(safeDestr(text)).toEqual(JSON.parse(text));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("parses every safe integer", () => {
    fc.assert(
      fc.property(fc.maxSafeInteger(), (value) => {
        expect(destr(String(value)) === value).toBe(true);
        expect(safeDestr(String(value)) === value).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("parses every double whose magnitude is in [1, 1e15)", () => {
    const magnitude = fc.double({ min: 1, max: 1e15, maxExcluded: true, noNaN: true });
    fc.assert(
      fc.property(magnitude, fc.boolean(), (abs, negative) => {
        const value = negative ? -abs : abs;
        expect(destr(String(value))).toBe(value);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns either the number or the unchanged input for any finite double", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        const text = String(value);
        const result = destr(text);
        expect(result === value || result === text).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("strict mode either throws or agrees with non-strict mode", () => {
    fc.assert(
      fc.property(anyString, (input) => {
        let strictResult: unknown;
        try {
          strictResult = safeDestr(input);
        } catch {
          return;
        }
        expect(strictResult).toEqual(destr(input));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("strict mode throws whenever non-strict mode falls back to the input", () => {
    fc.assert(
      fc.property(anyString, (input) => {
        if (destr(input) === input) {
          expect(() => safeDestr(input)).toThrow();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns plain words unchanged in non-strict mode and throws in strict mode", () => {
    const keywords = new Set(["true", "false", "null", "undefined", "nan", "infinity"]);
    const word = fc
      .string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCXYZ _-:/."), minLength: 1 })
      .filter((text) => !keywords.has(text.trim().toLowerCase()) && !/^\s*-/.test(text));
    fc.assert(
      fc.property(word, (text) => {
        expect(destr(text)).toBe(text);
        expect(() => safeDestr(text)).toThrow("[destr] Invalid JSON");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("removes injected __proto__ keys at any depth", () => {
    const injected = fc
      .tuple(fc.array(fc.string({ unit: "grapheme-ascii" }).filter((key) => !key.includes("_")), { maxLength: 5 }), fc.jsonValue())
      .map(([path, payload]) => {
        let text = `{"__proto__":${JSON.stringify(payload)},"leaf":1}`;
        let expected: unknown = { leaf: 1 };
        for (const key of [...path].reverse()) {
          text = `{${JSON.stringify(key)}:${text}}`;
          expected = { [key]: expected };
        }
        return { text, expected };
      })
      // A path such as ["constructor", "prototype"] would legitimately be dropped too.
      .filter(({ text }) => !text.includes("constructor"));

    fc.assert(
      fc.property(injected, ({ text, expected }) => {
        expect(destr(text)).toEqual(expected);
        expect(() => safeDestr(text)).toThrow("[destr] Possible prototype pollution");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
