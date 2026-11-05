import { describe, expect, it } from "vitest";
import * as scule from "../src/index";
import {
  camelCase,
  flatCase,
  kebabCase,
  lowerFirst,
  pascalCase,
  snakeCase,
  splitByCase,
  titleCase,
  trainCase,
  upperFirst,
} from "../src/index";

describe("public API", () => {
  it("exports exactly the documented runtime functions", () => {
    expect(Object.keys(scule).sort()).toEqual([
      "camelCase",
      "flatCase",
      "isUppercase",
      "kebabCase",
      "lowerFirst",
      "pascalCase",
      "snakeCase",
      "splitByCase",
      "titleCase",
      "trainCase",
      "upperFirst",
    ]);
    for (const value of Object.values(scule)) {
      expect(typeof value).toBe("function");
    }
  });
});

describe("README examples", () => {
  it("pascalCase", () => {
    expect(pascalCase("foo-bar_baz")).toBe("FooBarBaz");
  });

  it("camelCase", () => {
    expect(camelCase("foo-bar_baz")).toBe("fooBarBaz");
  });

  it("kebabCase", () => {
    expect(kebabCase("fooBar_Baz")).toBe("foo-bar-baz");
  });

  it("snakeCase", () => {
    expect(snakeCase("foo-barBaz")).toBe("foo_bar_baz");
  });

  it("flatCase", () => {
    expect(flatCase("foo-barBaz")).toBe("foobarbaz");
  });

  it("trainCase (WWWAuthenticate note)", () => {
    expect(trainCase("WWWAuthenticate")).toBe("WWW-Authenticate");
    expect(trainCase("WWWAuthenticate", { normalize: true })).toBe(
      "Www-Authenticate",
    );
  });

  // README DISCREPANCY: the README documents trainCase("FooBARb") as
  // "Foo-Ba-Rb", but without `normalize` uppercase runs are preserved and the
  // result is "Foo-BA-Rb". The README output only matches with normalize: true.
  it("trainCase FooBARb (current behavior differs from README)", () => {
    expect(trainCase("FooBARb")).toBe("Foo-BA-Rb");
    expect(trainCase("FooBARb", { normalize: true })).toBe("Foo-Ba-Rb");
  });

  it("titleCase", () => {
    expect(titleCase("this-IS-aTitle")).toBe("This is a Title");
  });

  it("upperFirst", () => {
    expect(upperFirst("hello world!")).toBe("Hello world!");
  });

  it("lowerFirst", () => {
    expect(lowerFirst("Hello world!")).toBe("hello world!");
  });
});

describe("upperFirst", () => {
  it.each([
    ["", ""],
    ["a", "A"],
    ["A", "A"],
    ["foo", "Foo"],
    ["fOO", "FOO"],
    ["foo bar", "Foo bar"],
    ["éclair", "Éclair"],
    ["1abc", "1abc"],
    ["-abc", "-abc"],
    [" abc", " abc"],
  ])("upperFirst(%j) === %j", (input, expected) => {
    expect(upperFirst(input)).toBe(expected);
  });

  it("only changes the first character", () => {
    expect(upperFirst("aBC def")).toBe("ABC def");
  });

  it("uses full case mapping, which can lengthen the string", () => {
    expect(upperFirst("ßa")).toBe("SSa");
  });

  // SUSPECTED BUG (minor): indexes by UTF-16 code unit, so a lowercase
  // astral-plane letter is left unchanged.
  it("does not uppercase astral-plane letters (current behavior)", () => {
    expect(upperFirst("𐐨x")).toBe("𐐨x");
  });

  it("returns an empty string for falsy input", () => {
    expect(upperFirst(undefined as any)).toBe("");
    expect(upperFirst(null as any)).toBe("");
  });
});

describe("lowerFirst", () => {
  it.each([
    ["", ""],
    ["A", "a"],
    ["a", "a"],
    ["Foo", "foo"],
    ["FOO", "fOO"],
    ["Foo Bar", "foo Bar"],
    ["Éclair", "éclair"],
    ["1ABC", "1ABC"],
  ])("lowerFirst(%j) === %j", (input, expected) => {
    expect(lowerFirst(input)).toBe(expected);
  });

  it("does not lowercase astral-plane letters (current behavior)", () => {
    expect(lowerFirst("𐐀x")).toBe("𐐀x");
  });

  it("returns an empty string for falsy input", () => {
    expect(lowerFirst(undefined as any)).toBe("");
  });
});

describe("pascalCase", () => {
  it("returns an empty string with no input", () => {
    expect(pascalCase()).toBe("");
    expect(pascalCase("")).toBe("");
  });

  it.each([
    ["foo", "Foo"],
    ["Foo", "Foo"],
    ["foo-bar", "FooBar"],
    ["foo_bar", "FooBar"],
    ["foo.bar", "FooBar"],
    ["foo/bar", "FooBar"],
    ["foo-bar_baz", "FooBarBaz"],
    ["fooBar", "FooBar"],
    ["FooBar", "FooBar"],
    ["foo--bar", "FooBar"],
    ["-foo-", "Foo"],
    ["foo1-bar2", "Foo1Bar2"],
    ["foo 1", "Foo 1"],
  ])("pascalCase(%j) === %j", (input, expected) => {
    expect(pascalCase(input)).toBe(expected);
  });

  it("preserves uppercase runs by default", () => {
    expect(pascalCase("FOO_BAR")).toBe("FOOBAR");
    expect(pascalCase("FooBARb")).toBe("FooBARb");
    expect(pascalCase("XMLHttpRequest")).toBe("XMLHttpRequest");
    expect(pascalCase("this-IS-aTitle")).toBe("ThisISATitle");
  });

  it("lowercases each word before capitalizing with normalize: true", () => {
    expect(pascalCase("FOO_BAR", { normalize: true })).toBe("FooBar");
    expect(pascalCase("FooBARb", { normalize: true })).toBe("FooBaRb");
    expect(pascalCase("XMLHttpRequest", { normalize: true })).toBe(
      "XmlHttpRequest",
    );
  });

  it("behaves like the default with normalize: false", () => {
    expect(pascalCase("FOO_BAR", { normalize: false })).toBe("FOOBAR");
  });

  it("joins array input without re-splitting the items", () => {
    expect(pascalCase(["foo", "bar"])).toBe("FooBar");
    expect(pascalCase(["foo-bar", "baz"])).toBe("Foo-barBaz");
    expect(pascalCase(["fooBar"])).toBe("FooBar");
    expect(pascalCase(["FOO", "bar"], { normalize: true })).toBe("FooBar");
    expect(pascalCase([])).toBe("");
  });

  it("returns an empty string for non-string input", () => {
    expect(pascalCase(null as any)).toBe("");
    expect(pascalCase(123 as any)).toBe("");
  });
});

describe("camelCase", () => {
  it("returns an empty string with no input", () => {
    expect(camelCase()).toBe("");
    expect(camelCase("")).toBe("");
  });

  it.each([
    ["foo", "foo"],
    ["Foo", "foo"],
    ["foo-bar", "fooBar"],
    ["foo_bar_baz", "fooBarBaz"],
    ["FooBar", "fooBar"],
    ["fooBar", "fooBar"],
    ["foo.bar/baz", "fooBarBaz"],
    ["-foo", "foo"],
    ["foo1-bar", "foo1Bar"],
  ])("camelCase(%j) === %j", (input, expected) => {
    expect(camelCase(input)).toBe(expected);
  });

  // Consequence of preserving uppercase runs: only the very first character
  // is lowercased, so a leading acronym becomes e.g. "xMLHttpRequest".
  it("only lowercases the first character of a leading acronym by default", () => {
    expect(camelCase("XMLHttpRequest")).toBe("xMLHttpRequest");
    expect(camelCase("FOOBar")).toBe("fOOBar");
    expect(camelCase("FOO_BAR")).toBe("fOOBAR");
  });

  it("produces conventional camelCase with normalize: true", () => {
    expect(camelCase("XMLHttpRequest", { normalize: true })).toBe(
      "xmlHttpRequest",
    );
    expect(camelCase("FOO_BAR", { normalize: true })).toBe("fooBar");
    expect(camelCase("this-IS-aTitle", { normalize: true })).toBe(
      "thisIsATitle",
    );
  });

  it("accepts array input", () => {
    expect(camelCase(["Foo", "Bar"])).toBe("fooBar");
    expect(camelCase(["FOO", "BAR"], { normalize: true })).toBe("fooBar");
    expect(camelCase([])).toBe("");
  });

  it("returns an empty string for non-string input", () => {
    expect(camelCase(null as any)).toBe("");
  });
});

describe("kebabCase", () => {
  it("returns an empty string with no input", () => {
    expect(kebabCase()).toBe("");
    expect(kebabCase("")).toBe("");
  });

  it.each([
    ["foo", "foo"],
    ["Foo", "foo"],
    ["FOO", "foo"],
    ["fooBar", "foo-bar"],
    ["FooBar", "foo-bar"],
    ["fooBar_Baz", "foo-bar-baz"],
    ["foo_bar", "foo-bar"],
    ["foo.bar/baz", "foo-bar-baz"],
    ["XMLHttpRequest", "xml-http-request"],
    ["FooBARb", "foo-ba-rb"],
    ["foo1Bar", "foo1-bar"],
    ["foo-bar", "foo-bar"],
  ])("kebabCase(%j) === %j", (input, expected) => {
    expect(kebabCase(input)).toBe(expected);
  });

  it("keeps empty segments from repeated, leading and trailing splitters", () => {
    expect(kebabCase("foo--bar")).toBe("foo--bar");
    expect(kebabCase("foo__bar")).toBe("foo--bar");
    expect(kebabCase("-foo")).toBe("-foo");
    expect(kebabCase("_foo_")).toBe("-foo-");
  });

  it("does not split on spaces (spaces are not splitters)", () => {
    expect(kebabCase("foo bar")).toBe("foo bar");
    expect(kebabCase("foo Bar")).toBe("foo -bar");
  });

  it("supports a custom joiner", () => {
    expect(kebabCase("fooBar", "+")).toBe("foo+bar");
    expect(kebabCase("fooBarBaz", " / ")).toBe("foo / bar / baz");
    expect(kebabCase("fooBar", "")).toBe("foobar");
  });

  it("falls back to '-' when the joiner is undefined", () => {
    expect(kebabCase("fooBar", undefined as any)).toBe("foo-bar");
  });

  it("lowercases and joins array input without re-splitting", () => {
    expect(kebabCase(["Foo", "BAR"])).toBe("foo-bar");
    expect(kebabCase(["fooBar", "baz"])).toBe("foobar-baz");
    expect(kebabCase(["foo", "", "bar"])).toBe("foo--bar");
    expect(kebabCase(["a", "b"], "_")).toBe("a_b");
    expect(kebabCase([])).toBe("");
  });

  it("returns an empty string for non-string input", () => {
    expect(kebabCase(undefined as any)).toBe("");
    expect(kebabCase(42 as any)).toBe("");
  });
});

describe("snakeCase", () => {
  it("returns an empty string with no input", () => {
    expect(snakeCase()).toBe("");
    expect(snakeCase("")).toBe("");
  });

  it.each([
    ["foo-barBaz", "foo_bar_baz"],
    ["FooBar", "foo_bar"],
    ["fooBar", "foo_bar"],
    ["foo-bar", "foo_bar"],
    ["foo_bar", "foo_bar"],
    ["FOO_BAR", "foo_bar"],
    ["XMLHttpRequest", "xml_http_request"],
    ["foo--bar", "foo__bar"],
    ["-foo", "_foo"],
  ])("snakeCase(%j) === %j", (input, expected) => {
    expect(snakeCase(input)).toBe(expected);
  });

  it("accepts array input", () => {
    expect(snakeCase(["Foo", "Bar"])).toBe("foo_bar");
    expect(snakeCase([])).toBe("");
  });
});

describe("flatCase", () => {
  it("returns an empty string with no input", () => {
    expect(flatCase()).toBe("");
    expect(flatCase("")).toBe("");
  });

  it.each([
    ["foo-barBaz", "foobarbaz"],
    ["FooBar", "foobar"],
    ["foo_bar.baz/qux", "foobarbazqux"],
    ["FOO", "foo"],
    ["foo--bar", "foobar"],
    ["XMLHttpRequest", "xmlhttprequest"],
  ])("flatCase(%j) === %j", (input, expected) => {
    expect(flatCase(input)).toBe(expected);
  });

  it("accepts array input", () => {
    expect(flatCase(["Foo", "Bar"])).toBe("foobar");
  });
});

describe("trainCase", () => {
  it("returns an empty string with no or empty input", () => {
    expect(trainCase()).toBe("");
    expect(trainCase("")).toBe("");
    expect(trainCase(null as any)).toBe("");
  });

  it.each([
    ["foo", "Foo"],
    ["foo-bar", "Foo-Bar"],
    ["foo_bar.baz", "Foo-Bar-Baz"],
    ["fooBar", "Foo-Bar"],
    ["FooBar", "Foo-Bar"],
    ["XMLHttpRequest", "XML-Http-Request"],
    ["FOOBar", "FOO-Bar"],
    ["content-type", "Content-Type"],
    ["x-forwarded-for", "X-Forwarded-For"],
  ])("trainCase(%j) === %j", (input, expected) => {
    expect(trainCase(input)).toBe(expected);
  });

  it("drops empty segments", () => {
    expect(trainCase("foo--bar")).toBe("Foo-Bar");
    expect(trainCase("-foo_")).toBe("Foo");
    expect(trainCase("--")).toBe("");
  });

  it("normalizes uppercase runs with normalize: true", () => {
    expect(trainCase("XMLHttpRequest", { normalize: true })).toBe(
      "Xml-Http-Request",
    );
    expect(trainCase("FOO_BAR", { normalize: true })).toBe("Foo-Bar");
  });

  it("does not split on spaces", () => {
    expect(trainCase("foo bar")).toBe("Foo bar");
    expect(trainCase("foo Bar")).toBe("Foo -Bar");
  });

  it("accepts array input and drops empty items", () => {
    expect(trainCase(["foo", "bar"])).toBe("Foo-Bar");
    expect(trainCase(["foo", "", "bar"])).toBe("Foo-Bar");
    expect(trainCase(["FOO", "BAR"], { normalize: true })).toBe("Foo-Bar");
    expect(trainCase([])).toBe("");
  });
});

describe("titleCase", () => {
  const minorWords = [
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "if",
    "in",
    "is",
    "nor",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ];

  it("returns an empty string with no or empty input", () => {
    expect(titleCase()).toBe("");
    expect(titleCase("")).toBe("");
    expect(titleCase(undefined as any)).toBe("");
  });

  it.each([
    ["foo", "Foo"],
    ["foo-bar", "Foo Bar"],
    ["fooBar", "Foo Bar"],
    ["foo_bar-baz", "Foo Bar Baz"],
    ["this-IS-aTitle", "This is a Title"],
    ["lord-of-the-rings", "Lord of the Rings"],
    ["war_and_peace", "War and Peace"],
    ["XMLHttpRequest", "XML Http Request"],
  ])("titleCase(%j) === %j", (input, expected) => {
    expect(titleCase(input)).toBe(expected);
  });

  it.each(minorWords)("keeps the minor word %j lowercase", (word) => {
    expect(titleCase(`hello-${word}-world`)).toBe(`Hello ${word} World`);
    expect(titleCase(`hello-${word.toUpperCase()}-world`)).toBe(
      `Hello ${word} World`,
    );
  });

  it("only treats whole words as minor words", () => {
    expect(titleCase("another-island")).toBe("Another Island");
    expect(titleCase("then-into-ask")).toBe("Then Into Ask");
  });

  // Likely bug: conventional title case always capitalizes the first word,
  // but titleCase lowercases a minor word even in first position.
  it("lowercases a minor word even when it is the first word (current behavior)", () => {
    expect(titleCase("the-end")).toBe("the End");
    expect(titleCase("a-tale")).toBe("a Tale");
  });

  it("preserves uppercase runs by default and normalizes them with normalize: true", () => {
    expect(titleCase("THE_QUICK_FOX")).toBe("the QUICK FOX");
    expect(titleCase("THE_QUICK_FOX", { normalize: true })).toBe(
      "the Quick Fox",
    );
    expect(titleCase("FooBARb", { normalize: true })).toBe("Foo Ba Rb");
  });

  it("drops empty segments", () => {
    expect(titleCase("foo--bar")).toBe("Foo Bar");
    expect(titleCase("_foo_")).toBe("Foo");
  });

  it("does not split on spaces, which can produce doubled spaces", () => {
    expect(titleCase("hello world")).toBe("Hello world");
    expect(titleCase("foo Bar")).toBe("Foo  Bar");
  });

  it("accepts array input", () => {
    expect(titleCase(["hello", "of", "world"])).toBe("Hello of World");
    expect(titleCase(["HELLO", "", "WORLD"], { normalize: true })).toBe(
      "Hello World",
    );
    expect(titleCase([])).toBe("");
  });
});

describe("relationships between converters", () => {
  const samples = [
    "",
    "foo",
    "fooBar",
    "FooBar",
    "foo-bar_baz",
    "XMLHttpRequest",
    "FooBARb",
    "this-IS-aTitle",
    "foo--bar",
    "-foo_",
    "foo1Bar2",
    "ÉcoleNormale",
  ];

  it.each(samples)("snakeCase and flatCase are kebabCase with another joiner: %j", (s) => {
    expect(snakeCase(s)).toBe(kebabCase(s, "_"));
    expect(flatCase(s)).toBe(kebabCase(s, ""));
  });

  it.each(samples)("camelCase is pascalCase with a lowercased first character: %j", (s) => {
    expect(camelCase(s)).toBe(lowerFirst(pascalCase(s)));
    expect(camelCase(s, { normalize: true })).toBe(
      lowerFirst(pascalCase(s, { normalize: true })),
    );
  });

  it.each(samples)("string input behaves like its splitByCase parts: %j", (s) => {
    const parts = splitByCase(s);
    expect(kebabCase(s)).toBe(kebabCase(parts));
    expect(pascalCase(s)).toBe(pascalCase(parts));
    expect(trainCase(s)).toBe(trainCase(parts));
    expect(titleCase(s)).toBe(titleCase(parts));
  });

  it("converts between common identifier styles", () => {
    const words = "user-account-id";
    expect(camelCase(words)).toBe("userAccountId");
    expect(pascalCase(camelCase(words))).toBe("UserAccountId");
    expect(snakeCase(pascalCase(words))).toBe("user_account_id");
    expect(kebabCase(snakeCase(words))).toBe("user-account-id");
    expect(trainCase(snakeCase(words))).toBe("User-Account-Id");
    expect(titleCase(camelCase(words))).toBe("User Account Id");
    expect(flatCase(trainCase(words))).toBe("useraccountid");
  });
});
