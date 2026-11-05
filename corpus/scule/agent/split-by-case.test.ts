import { describe, expect, it } from "vitest";
import { isUppercase, splitByCase } from "../src/index";

describe("isUppercase", () => {
  it.each([
    ["A", true],
    ["Z", true],
    ["É", true],
    ["Ä", true],
    ["Σ", true],
    ["a", false],
    ["z", false],
    ["é", false],
    ["ß", false],
    ["σ", false],
  ])("classifies letter %j as %j", (char, expected) => {
    expect(isUppercase(char)).toBe(expected);
  });

  it.each(["0", "1", "5", "9"])("returns undefined for digit %j", (char) => {
    expect(isUppercase(char)).toBeUndefined();
  });

  it.each(["-", "_", "/", ".", " ", "!", "@", "😀", "日"])(
    "returns false for uncased character %j",
    (char) => {
      expect(isUppercase(char)).toBe(false);
    },
  );

  it("returns false for an empty string and when called without arguments", () => {
    expect(isUppercase("")).toBe(false);
    expect(isUppercase()).toBe(false);
    expect(isUppercase(undefined)).toBe(false);
  });

  it("only treats ASCII digits as numbers (\\d without the u flag)", () => {
    // Arabic-Indic digit three is not matched by /\d/, and it has no case.
    expect(isUppercase("٣")).toBe(false);
  });

  it("returns undefined for multi-character input that contains any digit", () => {
    expect(isUppercase("a1")).toBeUndefined();
    expect(isUppercase("A1")).toBeUndefined();
  });

  it("compares the whole string to its lowercase form for multi-character input", () => {
    expect(isUppercase("AB")).toBe(true);
    expect(isUppercase("Ab")).toBe(true); // any uppercase char makes it differ
    expect(isUppercase("ab")).toBe(false);
  });

  it("recognises astral-plane uppercase letters (Deseret)", () => {
    expect(isUppercase("𐐀")).toBe(true);
    expect(isUppercase("𐐨")).toBe(false);
  });
});

describe("splitByCase", () => {
  describe("empty and invalid input", () => {
    it("returns an empty array for an empty string", () => {
      expect(splitByCase("")).toEqual([]);
    });

    it.each([undefined, null, 0, 123, true, {}, ["foo"]])(
      "returns an empty array for non-string input %j",
      (input) => {
        expect(splitByCase(input as any)).toEqual([]);
      },
    );

    it("returns a fresh array on every call", () => {
      const a = splitByCase("fooBar");
      const b = splitByCase("fooBar");
      expect(a).not.toBe(b);
      a.push("mutated" as never);
      expect(splitByCase("fooBar")).toEqual(["foo", "Bar"]);
    });
  });

  describe("default splitters (- _ / .)", () => {
    it.each([
      ["foo-bar", ["foo", "bar"]],
      ["foo_bar", ["foo", "bar"]],
      ["foo/bar", ["foo", "bar"]],
      ["foo.bar", ["foo", "bar"]],
      ["foo-bar_baz", ["foo", "bar", "baz"]],
      ["foo.bar/baz", ["foo", "bar", "baz"]],
      ["a-b-c-d", ["a", "b", "c", "d"]],
    ])("splits %j into %j", (input, expected) => {
      expect(splitByCase(input)).toEqual(expected);
    });

    it.each([
      ["foo--bar", ["foo", "", "bar"]],
      ["foo__bar", ["foo", "", "bar"]],
      ["foo-_bar", ["foo", "", "bar"]],
      ["-foo", ["", "foo"]],
      ["foo-", ["foo", ""]],
      ["_foo_", ["", "foo", ""]],
      ["-", ["", ""]],
      ["--", ["", "", ""]],
    ])("keeps empty segments produced by %j", (input, expected) => {
      expect(splitByCase(input)).toEqual(expected);
    });

    it("does not treat whitespace as a splitter", () => {
      expect(splitByCase("foo bar")).toEqual(["foo bar"]);
      expect(splitByCase("foo\tbar")).toEqual(["foo\tbar"]);
    });

    it("drops splitter characters from the output", () => {
      const parts = splitByCase("a-b_c/d.e");
      expect(parts.join("")).toBe("abcde");
      for (const part of parts) {
        expect(part).not.toMatch(/[-_/.]/);
      }
    });
  });

  describe("case boundaries", () => {
    it.each([
      ["foo", ["foo"]],
      ["Foo", ["Foo"]],
      ["FOO", ["FOO"]],
      ["a", ["a"]],
      ["A", ["A"]],
      ["Ab", ["Ab"]],
      ["aB", ["a", "B"]],
      ["fooBar", ["foo", "Bar"]],
      ["FooBar", ["Foo", "Bar"]],
      ["fooBarBaz", ["foo", "Bar", "Baz"]],
      ["fooBAR", ["foo", "BAR"]],
    ])("splits %j into %j on lower-to-upper transitions", (input, expected) => {
      expect(splitByCase(input)).toEqual(expected);
    });

    it.each([
      ["ABc", ["A", "Bc"]],
      ["FOOBar", ["FOO", "Bar"]],
      ["FooBARb", ["Foo", "BA", "Rb"]],
      ["XMLHttpRequest", ["XML", "Http", "Request"]],
      ["WWWAuthenticate", ["WWW", "Authenticate"]],
      ["HTMLParser", ["HTML", "Parser"]],
      ["getHTTPSUrl", ["get", "HTTPS", "Url"]],
      ["IPhone", ["I", "Phone"]],
      ["iPhone", ["i", "Phone"]],
    ])(
      "splits %j into %j, keeping the last capital of an acronym with the next word",
      (input, expected) => {
        expect(splitByCase(input)).toEqual(expected);
      },
    );

    it("preserves the case of every part", () => {
      expect(splitByCase("this-IS-aTitle")).toEqual(["this", "IS", "a", "Title"]);
    });

    it("does not split right after a splitter, even when case changes", () => {
      expect(splitByCase("foo-Bar")).toEqual(["foo", "Bar"]);
      expect(splitByCase("FOO_bar")).toEqual(["FOO", "bar"]);
      expect(splitByCase("-ABc")).toEqual(["", "A", "Bc"]);
    });

    it("treats uncased non-splitter characters like lowercase", () => {
      // A space or symbol followed by an uppercase letter counts as a rising edge.
      expect(splitByCase("foo Bar")).toEqual(["foo ", "Bar"]);
      expect(splitByCase("foo!Bar")).toEqual(["foo!", "Bar"]);
      expect(splitByCase("foo😀Bar")).toEqual(["foo😀", "Bar"]);
      expect(splitByCase("😀Foo")).toEqual(["😀", "Foo"]);
    });
  });

  describe("numbers", () => {
    it.each([
      ["123", ["123"]],
      ["foo123", ["foo123"]],
      ["foo1bar", ["foo1bar"]],
      ["foo1Bar", ["foo1", "Bar"]],
      ["Foo123Bar", ["Foo123", "Bar"]],
      ["A1Bc", ["A1", "Bc"]],
      ["foo1BAR", ["foo1BAR"]],
      ["abc123DEF", ["abc123DEF"]],
      ["ABC123def", ["ABC123def"]],
      ["foo-123-bar", ["foo", "123", "bar"]],
    ])("ignores digits for case changes: %j -> %j", (input, expected) => {
      expect(splitByCase(input)).toEqual(expected);
    });
  });

  describe("non-ASCII input", () => {
    it.each([
      ["fooÄpfel", ["foo", "Äpfel"]],
      ["ÉcoleNormale", ["École", "Normale"]],
      ["αΒγ", ["α", "Βγ"]],
      ["日本語", ["日本語"]],
      ["ǅungla", ["ǅungla"]],
    ])("splits %j into %j", (input, expected) => {
      expect(splitByCase(input)).toEqual(expected);
    });

    it("iterates by code point, so astral characters are never split internally on rising edges", () => {
      expect(splitByCase("a𐐀")).toEqual(["a", "𐐀"]);
      expect(splitByCase("A𐐨")).toEqual(["A𐐨"]);
    });

    // SUSPECTED BUG: the falling-edge branch moves `buff.at(-1)` (one UTF-16
    // code unit) into the next part. When the last uppercase character is an
    // astral-plane letter (a surrogate pair), its surrogates are split across
    // two parts, producing lone surrogates (malformed UTF-16).
    it("splits surrogate pairs of astral uppercase letters at a falling edge (current behavior)", () => {
      expect(splitByCase("𐐀𐐨")).toEqual(["\uD801", "\uDC00𐐨"]);
      expect(splitByCase("𐐀𐐀𐐨")).toEqual(["𐐀\uD801", "\uDC00𐐨"]);
      // The concatenation of the code units is still intact.
      expect(splitByCase("𐐀𐐨").join("")).toBe("𐐀𐐨");
    });
  });

  describe("custom separators", () => {
    it("uses only the provided separators", () => {
      expect(splitByCase("foo_bar-baz", ["_"])).toEqual(["foo", "bar-baz"]);
      expect(splitByCase("foo_bar-baz", ["-"])).toEqual(["foo_bar", "baz"]);
      expect(splitByCase("foo.bar/baz", ["/"])).toEqual(["foo.bar", "baz"]);
    });

    it("supports whitespace and arbitrary characters as separators", () => {
      expect(splitByCase("foo bar baz", [" "])).toEqual(["foo", "bar", "baz"]);
      expect(splitByCase("foo+bar|baz", ["+", "|"])).toEqual(["foo", "bar", "baz"]);
      expect(splitByCase("fooxbar", ["x"])).toEqual(["foo", "bar"]);
      expect(splitByCase("a😀b", ["😀"])).toEqual(["a", "b"]);
    });

    it("still splits on case changes alongside custom separators", () => {
      expect(splitByCase("fooBar baz", [" "])).toEqual(["foo", "Bar", "baz"]);
    });

    it("splits only on case when given an empty separator list", () => {
      expect(splitByCase("fooBar", [])).toEqual(["foo", "Bar"]);
      expect(splitByCase("foo-bar_baz", [])).toEqual(["foo-bar_baz"]);
    });

    it("ignores multi-character separators because input is compared one character at a time", () => {
      expect(splitByCase("foo--bar", ["--"])).toEqual(["foo--bar"]);
      expect(splitByCase("foo::bar", ["::"])).toEqual(["foo::bar"]);
    });

    it("accepts readonly (as const) separator tuples", () => {
      const seps = ["_", " "] as const;
      expect(splitByCase("a_b c", seps)).toEqual(["a", "b", "c"]);
    });
  });
});
