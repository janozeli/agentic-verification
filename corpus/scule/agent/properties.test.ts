import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  camelCase,
  flatCase,
  isUppercase,
  kebabCase,
  lowerFirst,
  pascalCase,
  snakeCase,
  splitByCase,
  titleCase,
  trainCase,
  upperFirst,
} from "../src/index";

// Raise for a local stress run, e.g. FC_NUM_RUNS=100000.
const NUM_RUNS = Number(process.env.FC_NUM_RUNS ?? 300);
const run = (property: fc.IProperty<any>) =>
  fc.assert(property, { numRuns: NUM_RUNS });

const DEFAULT_SPLITTERS = ["-", "_", "/", "."];
const SPLITTER_RE = /[-_/.]/g;

// A small alphabet that exercises every branch of splitByCase: lower/upper
// letters, digits, all default splitters, an uncased char, and a few
// non-ASCII cased letters.
const ALPHABET = [
  "a", "b", "x", "A", "B", "X", "0", "7",
  "-", "_", "/", ".", " ",
  "é", "É", "ß", "σ", "Σ", "日",
];
const stringFrom = (alphabet: string[]) =>
  fc
    .array(fc.constantFrom(...alphabet), { maxLength: 24 })
    .map((chars) => chars.join(""));
const identifierLike = stringFrom(ALPHABET);
// "ß".toUpperCase() is "SS": upperFirst turns one lowercase letter into an
// uppercase run, which re-splits differently (see the explicit tests below).
const identifierLikeNoSharpS = stringFrom(ALPHABET.filter((c) => c !== "ß"));

// Includes astral-plane characters and lone surrogates.
const anyString = fc.oneof(
  identifierLike,
  fc.string({ unit: "binary", maxLength: 24 }),
  fc.string({ unit: "grapheme", maxLength: 12 }),
);

// Lowercase words of 2+ letters survive a round trip through every format.
const word = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
    minLength: 2,
    maxLength: 8,
  })
  .map((chars) => chars.join(""));
const words = fc.array(word, { minLength: 1, maxLength: 6 });

const upperWord = fc
  .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"), {
    minLength: 1,
    maxLength: 8,
  })
  .map((chars) => chars.join(""));

const countSplitters = (s: string) => (s.match(SPLITTER_RE) ?? []).length;

describe("splitByCase invariants", () => {
  it("concatenating the parts gives back the input without splitter characters", () => {
    run(
      fc.property(anyString, (s) => {
        expect(splitByCase(s).join("")).toBe(s.replace(SPLITTER_RE, ""));
      }),
    );
  });

  it("never returns a part that contains a splitter character", () => {
    run(
      fc.property(anyString, (s) => {
        for (const part of splitByCase(s)) {
          expect(part).not.toMatch(SPLITTER_RE);
        }
      }),
    );
  });

  it("returns at least one more part than there are splitters (for non-empty input)", () => {
    run(
      fc.property(anyString, (s) => {
        const parts = splitByCase(s);
        if (s === "") {
          expect(parts).toEqual([]);
        } else {
          expect(parts.length).toBeGreaterThanOrEqual(countSplitters(s) + 1);
        }
      }),
    );
  });

  it("only produces empty parts when the input contains splitters", () => {
    run(
      fc.property(identifierLike, (s) => {
        fc.pre(s.length > 0 && countSplitters(s) === 0);
        for (const part of splitByCase(s)) {
          expect(part.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it("never splits input that has no splitters and no uppercase letters", () => {
    const lowerOnly = fc
      .array(fc.constantFrom("a", "z", "é", "ß", "0", "9", " ", "日"), {
        minLength: 1,
        maxLength: 20,
      })
      .map((chars) => chars.join(""));
    run(
      fc.property(lowerOnly, (s) => {
        expect(splitByCase(s)).toEqual([s]);
      }),
    );
  });

  it("removes exactly the chosen single-character separators", () => {
    const separators = fc.uniqueArray(fc.constantFrom(...ALPHABET), {
      maxLength: 4,
    });
    run(
      fc.property(identifierLike, separators, (s, seps) => {
        const parts = splitByCase(s, seps);
        const expected = [...s].filter((c) => !seps.includes(c)).join("");
        expect(parts.join("")).toBe(expected);
        for (const part of parts) {
          for (const sep of seps) {
            expect(part.includes(sep)).toBe(false);
          }
        }
      }),
    );
  });

  it("is deterministic and does not depend on previous calls", () => {
    run(
      fc.property(anyString, anyString, (a, b) => {
        const first = splitByCase(a);
        splitByCase(b);
        expect(splitByCase(a)).toEqual(first);
      }),
    );
  });
});

describe("converter invariants", () => {
  it("snakeCase and flatCase are kebabCase with '-' replaced", () => {
    run(
      fc.property(anyString, (s) => {
        const kebab = kebabCase(s);
        expect(snakeCase(s)).toBe(kebab.replaceAll("-", "_"));
        expect(flatCase(s)).toBe(kebab.replaceAll("-", ""));
      }),
    );
  });

  it("kebabCase output is entirely lowercase", () => {
    run(
      fc.property(identifierLike, (s) => {
        const out = kebabCase(s);
        expect(out).toBe(out.toLowerCase());
      }),
    );
  });

  it("camelCase and pascalCase differ at most in the first character", () => {
    run(
      fc.property(identifierLike, fc.boolean(), (s, normalize) => {
        const pascal = pascalCase(s, { normalize });
        const camel = camelCase(s, { normalize });
        expect(camel.slice(1)).toBe(pascal.slice(1));
        expect(camel.charAt(0)).toBe(pascal.charAt(0).toLowerCase());
      }),
    );
  });

  it("normalize: true converts SCREAMING_SNAKE_CASE word by word", () => {
    run(
      fc.property(fc.array(upperWord, { minLength: 1, maxLength: 5 }), (ws) => {
        const constant = ws.join("_");
        const expectedWords = ws.map((w) => upperFirst(w.toLowerCase()));
        expect(pascalCase(constant, { normalize: true })).toBe(
          expectedWords.join(""),
        );
        expect(trainCase(constant, { normalize: true })).toBe(
          expectedWords.join("-"),
        );
        expect(kebabCase(constant)).toBe(
          ws.map((w) => w.toLowerCase()).join("-"),
        );
      }),
    );
  });

  it("trainCase never produces empty segments", () => {
    run(
      fc.property(identifierLike, (s) => {
        const out = trainCase(s);
        if (out !== "") {
          for (const segment of out.split("-")) {
            expect(segment.length).toBeGreaterThan(0);
          }
        }
      }),
    );
  });

  it("normalize: true ignores each word's casing style when words are separated by splitters", () => {
    const styledWord = word.chain((w) =>
      fc
        .constantFrom(w, w.toUpperCase(), upperFirst(w))
        .map((styled) => ({ plain: w, styled })),
    );
    run(
      fc.property(
        fc.array(styledWord, { minLength: 1, maxLength: 5 }),
        fc.constantFrom(...DEFAULT_SPLITTERS),
        (ws, sep) => {
          const plain = ws.map((w) => w.plain);
          const input = ws.map((w) => w.styled).join(sep);
          expect(pascalCase(input, { normalize: true })).toBe(pascalCase(plain));
          expect(camelCase(input, { normalize: true })).toBe(camelCase(plain));
          expect(trainCase(input, { normalize: true })).toBe(trainCase(plain));
          expect(titleCase(input, { normalize: true })).toBe(titleCase(plain));
          expect(kebabCase(input)).toBe(kebabCase(plain));
        },
      ),
    );
  });

  it.each([
    ["kebabCase", (s: string) => kebabCase(s)],
    ["snakeCase", (s: string) => snakeCase(s)],
    ["flatCase", (s: string) => flatCase(s)],
    ["pascalCase", (s: string) => pascalCase(s)],
    ["camelCase", (s: string) => camelCase(s)],
    ["trainCase", (s: string) => trainCase(s)],
  ] as const)("%s is idempotent", (_name, convert) => {
    run(
      fc.property(identifierLikeNoSharpS, (s) => {
        const once = convert(s);
        expect(convert(once)).toBe(once);
      }),
    );
  });

  it("kebabCase, snakeCase, flatCase, pascalCase and camelCase stay idempotent with 'ß'", () => {
    run(
      fc.property(identifierLike, (s) => {
        for (const convert of [kebabCase, snakeCase, flatCase, pascalCase, camelCase]) {
          const once = convert(s);
          expect(convert(once)).toBe(once);
        }
      }),
    );
  });

  // Counterexamples found by the properties above, pinned as examples.
  it("trainCase is not idempotent for 'ß' because upperFirst('ß') is 'SS'", () => {
    expect(trainCase("ßa")).toBe("SSa");
    expect(trainCase("SSa")).toBe("S-Sa");
    expect(trainCase("ß", { normalize: true })).toBe("SS");
    expect(trainCase("SS", { normalize: true })).toBe("Ss");
  });

  it("normalize is not idempotent when single-letter words merge into one uppercase run", () => {
    expect(pascalCase("a.a", { normalize: true })).toBe("AA");
    expect(pascalCase("AA", { normalize: true })).toBe("Aa");
    expect(camelCase("aB-a", { normalize: true })).toBe("aBA");
    expect(camelCase("aBA", { normalize: true })).toBe("aBa");
  });
});

describe("round trips through lowercase word lists", () => {
  it("each format joins the words as specified", () => {
    run(
      fc.property(words, (ws) => {
        const capitalized = ws.map((w) => upperFirst(w));
        expect(kebabCase(ws)).toBe(ws.join("-"));
        expect(snakeCase(ws)).toBe(ws.join("_"));
        expect(flatCase(ws)).toBe(ws.join(""));
        expect(pascalCase(ws)).toBe(capitalized.join(""));
        expect(camelCase(ws)).toBe(lowerFirst(capitalized.join("")));
        expect(trainCase(ws)).toBe(capitalized.join("-"));
      }),
    );
  });

  it("splitByCase recovers the words from every non-flat format", () => {
    run(
      fc.property(words, (ws) => {
        for (const formatted of [
          kebabCase(ws),
          snakeCase(ws),
          pascalCase(ws),
          camelCase(ws),
          trainCase(ws),
        ]) {
          expect(splitByCase(formatted).map((p) => p.toLowerCase())).toEqual(ws);
        }
      }),
    );
  });

  it("converting between formats is lossless", () => {
    run(
      fc.property(words, (ws) => {
        const camel = camelCase(ws);
        const pascal = pascalCase(ws);
        const kebab = kebabCase(ws);
        const snake = snakeCase(ws);
        const train = trainCase(ws);

        expect(kebabCase(camel)).toBe(kebab);
        expect(kebabCase(pascal)).toBe(kebab);
        expect(snakeCase(train)).toBe(snake);
        expect(camelCase(snake)).toBe(camel);
        expect(camelCase(kebab)).toBe(camel);
        expect(pascalCase(camel)).toBe(pascal);
        expect(trainCase(camel)).toBe(train);
        expect(titleCase(snake)).toBe(titleCase(ws));
      }),
    );
  });

  it("titleCase lowercases minor words and capitalizes every other word", () => {
    const minor =
      /^(a|an|and|as|at|but|by|for|if|in|is|nor|of|on|or|the|to|with)$/;
    const titleWords = fc.array(
      fc.oneof(word, fc.constantFrom("of", "the", "and", "to", "with")),
      { minLength: 1, maxLength: 6 },
    );
    run(
      fc.property(titleWords, (ws) => {
        const expected = ws.map((w) => (minor.test(w) ? w : upperFirst(w)));
        expect(titleCase(ws)).toBe(expected.join(" "));
      }),
    );
  });
});

describe("upperFirst / lowerFirst / isUppercase", () => {
  const asciiString = fc.string({ unit: "grapheme-ascii", maxLength: 20 });

  it("only ever changes the first character of ASCII strings", () => {
    run(
      fc.property(asciiString, (s) => {
        expect(upperFirst(s).length).toBe(s.length);
        expect(lowerFirst(s).length).toBe(s.length);
        expect(upperFirst(s).slice(1)).toBe(s.slice(1));
        expect(lowerFirst(s).slice(1)).toBe(s.slice(1));
      }),
    );
  });

  it("is idempotent and each cancels the other's effect on the first character", () => {
    run(
      fc.property(asciiString, (s) => {
        expect(upperFirst(upperFirst(s))).toBe(upperFirst(s));
        expect(lowerFirst(lowerFirst(s))).toBe(lowerFirst(s));
        expect(lowerFirst(upperFirst(s))).toBe(lowerFirst(s));
        expect(upperFirst(lowerFirst(s))).toBe(upperFirst(s));
      }),
    );
  });

  it("isUppercase matches /[A-Z]/ for ASCII letters", () => {
    const letter = fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    );
    run(
      fc.property(letter, (c) => {
        expect(isUppercase(c)).toBe(/[A-Z]/.test(c));
      }),
    );
  });

  it("isUppercase is undefined for any string that contains an ASCII digit", () => {
    run(
      fc.property(
        fc.string({ maxLength: 5 }),
        fc.constantFrom(..."0123456789"),
        fc.string({ maxLength: 5 }),
        (before, digit, after) => {
          expect(isUppercase(before + digit + after)).toBeUndefined();
        },
      ),
    );
  });
});

describe("default splitters", () => {
  it.each(DEFAULT_SPLITTERS)("splits on %j", (sep) => {
    expect(splitByCase(`foo${sep}bar`)).toEqual(["foo", "bar"]);
  });
});
