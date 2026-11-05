/**
 * Type-level tests for the literal types returned by scule's functions.
 *
 * `vitest run` does not typecheck, so the `expectTypeOf` assertions are no-ops
 * at runtime there. Every test also asserts the runtime value, so each test
 * still checks behavior under `vitest run`. To verify the type assertions,
 * from the library directory run:
 *
 *   ./node_modules/.bin/tsc --noEmit --strict --target esnext --module esnext \
 *     --moduleResolution bundler --skipLibCheck --types node test-agent/*.ts
 *
 * Tests under "type/runtime mismatches" pin the CURRENT declared types where
 * they disagree with what the function actually returns (suspected bugs).
 */
import { describe, expect, expectTypeOf, it } from "vitest";
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
import type {
  CamelCase,
  CaseOptions,
  FlatCase,
  JoinByCase,
  KebabCase,
  PascalCase,
  SnakeCase,
  SplitByCase,
  TrainCase,
} from "../src/index";

describe("literal types that match runtime values", () => {
  it("splitByCase", () => {
    const camel = splitByCase("fooBar");
    expect(camel).toEqual(["foo", "Bar"]);
    expectTypeOf(camel).toEqualTypeOf<["foo", "Bar"]>();

    const acronym = splitByCase("XMLHttpRequest");
    expect(acronym).toEqual(["XML", "Http", "Request"]);
    expectTypeOf(acronym).toEqualTypeOf<["XML", "Http", "Request"]>();

    const mixed = splitByCase("FooBARb");
    expect(mixed).toEqual(["Foo", "BA", "Rb"]);
    expectTypeOf(mixed).toEqualTypeOf<["Foo", "BA", "Rb"]>();

    const separated = splitByCase("foo-bar_baz");
    expect(separated).toEqual(["foo", "bar", "baz"]);
    expectTypeOf(separated).toEqualTypeOf<["foo", "bar", "baz"]>();

    const doubled = splitByCase("foo--bar");
    expect(doubled).toEqual(["foo", "", "bar"]);
    expectTypeOf(doubled).toEqualTypeOf<["foo", "", "bar"]>();

    const digits = splitByCase("foo1Bar");
    expect(digits).toEqual(["foo1", "Bar"]);
    expectTypeOf(digits).toEqualTypeOf<["foo1", "Bar"]>();

    const title = splitByCase("this-IS-aTitle");
    expect(title).toEqual(["this", "IS", "a", "Title"]);
    expectTypeOf(title).toEqualTypeOf<["this", "IS", "a", "Title"]>();

    const empty = splitByCase("");
    expect(empty).toEqual([]);
    expectTypeOf(empty).toEqualTypeOf<[]>();
  });

  it("splitByCase with const separators", () => {
    const underscore = splitByCase("foo_bar-baz", ["_"] as const);
    expect(underscore).toEqual(["foo", "bar-baz"]);
    expectTypeOf(underscore).toEqualTypeOf<["foo", "bar-baz"]>();

    const space = splitByCase("foo bar", [" "] as const);
    expect(space).toEqual(["foo", "bar"]);
    expectTypeOf(space).toEqualTypeOf<["foo", "bar"]>();
  });

  it("splitByCase widens to string[] for non-literal input or separators", () => {
    const wide = splitByCase("foo" as string);
    expect(wide).toEqual(["foo"]);
    expectTypeOf(wide).toEqualTypeOf<string[]>();

    const mutableSeps = splitByCase("foo_bar", ["_"]);
    expect(mutableSeps).toEqual(["foo", "bar"]);
    expectTypeOf(mutableSeps).toEqualTypeOf<string[]>();
  });

  it("pascalCase", () => {
    const fromString = pascalCase("foo-bar_baz");
    expect(fromString).toBe("FooBarBaz");
    expectTypeOf(fromString).toEqualTypeOf<"FooBarBaz">();

    const fromTuple = pascalCase(["foo", "bar"] as const);
    expect(fromTuple).toBe("FooBar");
    expectTypeOf(fromTuple).toEqualTypeOf<"FooBar">();

    const none = pascalCase();
    expect(none).toBe("");
    expectTypeOf(none).toEqualTypeOf<"">();

    const wide = pascalCase("foo" as string);
    expect(wide).toBe("Foo");
    expectTypeOf(wide).toEqualTypeOf<string>();

    const wideArray = pascalCase(["foo", "bar"]);
    expect(wideArray).toBe("FooBar");
    expectTypeOf(wideArray).toEqualTypeOf<string>();
  });

  it("camelCase", () => {
    const fromString = camelCase("foo-bar_baz");
    expect(fromString).toBe("fooBarBaz");
    expectTypeOf(fromString).toEqualTypeOf<"fooBarBaz">();

    const normalized = camelCase("FOO_BAR", { normalize: true });
    expect(normalized).toBe("fooBar");
    expectTypeOf(normalized).toEqualTypeOf<"fooBar">();

    const notNormalized = camelCase("FOO_BAR", { normalize: false });
    expect(notNormalized).toBe("fOOBAR");
    expectTypeOf(notNormalized).toEqualTypeOf<"fOOBAR">();

    const fromTuple = camelCase(["Foo", "Bar"] as const);
    expect(fromTuple).toBe("fooBar");
    expectTypeOf(fromTuple).toEqualTypeOf<"fooBar">();

    const none = camelCase();
    expect(none).toBe("");
    expectTypeOf(none).toEqualTypeOf<"">();
  });

  it("kebabCase, snakeCase and flatCase", () => {
    const kebab = kebabCase("fooBar_Baz");
    expect(kebab).toBe("foo-bar-baz");
    expectTypeOf(kebab).toEqualTypeOf<"foo-bar-baz">();

    const joined = kebabCase("fooBar", "+");
    expect(joined).toBe("foo+bar");
    expectTypeOf(joined).toEqualTypeOf<"foo+bar">();

    const kebabTuple = kebabCase(["Foo", "BAR"] as const);
    expect(kebabTuple).toBe("foo-bar");
    expectTypeOf(kebabTuple).toEqualTypeOf<"foo-bar">();

    const kebabAcronym = kebabCase("FooBARb");
    expect(kebabAcronym).toBe("foo-ba-rb");
    expectTypeOf(kebabAcronym).toEqualTypeOf<"foo-ba-rb">();

    const snake = snakeCase("foo-barBaz");
    expect(snake).toBe("foo_bar_baz");
    expectTypeOf(snake).toEqualTypeOf<"foo_bar_baz">();

    const snakeTuple = snakeCase(["Foo", "Bar"] as const);
    expect(snakeTuple).toBe("foo_bar");
    expectTypeOf(snakeTuple).toEqualTypeOf<"foo_bar">();

    const flat = flatCase("foo-barBaz");
    expect(flat).toBe("foobarbaz");
    expectTypeOf(flat).toEqualTypeOf<"foobarbaz">();

    const flatTuple = flatCase(["Foo", "Bar"] as const);
    expect(flatTuple).toBe("foobar");
    expectTypeOf(flatTuple).toEqualTypeOf<"foobar">();

    expectTypeOf(kebabCase()).toEqualTypeOf<"">();
    expectTypeOf(snakeCase()).toEqualTypeOf<"">();
    expectTypeOf(flatCase()).toEqualTypeOf<"">();
    expectTypeOf(kebabCase("x" as string)).toEqualTypeOf<string>();
    expect([kebabCase(), snakeCase(), flatCase()]).toEqual(["", "", ""]);
  });

  it("trainCase and titleCase without arguments", () => {
    const train = trainCase();
    const title = titleCase();
    expect(train).toBe("");
    expect(title).toBe("");
    expectTypeOf(train).toEqualTypeOf<"">();
    expectTypeOf(title).toEqualTypeOf<"">();
  });

  it("upperFirst, lowerFirst and isUppercase", () => {
    const upper = upperFirst("hello");
    expect(upper).toBe("Hello");
    expectTypeOf(upper).toEqualTypeOf<"Hello">();

    const lower = lowerFirst("Hello");
    expect(lower).toBe("hello");
    expectTypeOf(lower).toEqualTypeOf<"hello">();

    expectTypeOf(isUppercase).returns.toEqualTypeOf<boolean | undefined>();
    expect(isUppercase("A")).toBe(true);
  });

  it("exported type aliases", () => {
    expectTypeOf<SplitByCase<"foo bar", " ">>().toEqualTypeOf<["foo", "bar"]>();
    expectTypeOf<SplitByCase<string>>().toEqualTypeOf<string[]>();
    expectTypeOf<PascalCase<"foo_bar", true>>().toEqualTypeOf<"FooBar">();
    expectTypeOf<PascalCase<string>>().toEqualTypeOf<string>();
    expectTypeOf<CamelCase<"FOO_BAR", true>>().toEqualTypeOf<"fooBar">();
    expectTypeOf<KebabCase<"FooBar">>().toEqualTypeOf<"foo-bar">();
    expectTypeOf<SnakeCase<"FooBar">>().toEqualTypeOf<"foo_bar">();
    expectTypeOf<FlatCase<"FooBar">>().toEqualTypeOf<"foobar">();
    expectTypeOf<JoinByCase<"fooBar", ".">>().toEqualTypeOf<"foo.bar">();
    expectTypeOf<CaseOptions>().toEqualTypeOf<{ normalize?: boolean }>();

    // Runtime counterparts of the aliases above.
    expect(splitByCase("foo bar", [" "])).toEqual(["foo", "bar"]);
    expect(pascalCase("foo_bar", { normalize: true })).toBe("FooBar");
    expect(camelCase("FOO_BAR", { normalize: true })).toBe("fooBar");
    expect(kebabCase("FooBar")).toBe("foo-bar");
    expect(snakeCase("FooBar")).toBe("foo_bar");
    expect(flatCase("FooBar")).toBe("foobar");
    expect(kebabCase("fooBar", ".")).toBe("foo.bar");
  });
});

describe("type/runtime mismatches (current types, suspected bugs)", () => {
  // TrainCase passes `Joiner` into CapitalizedWords' `Accumulator` slot, so
  // the joiner is prepended once instead of placed between words.
  it("trainCase: declared type prepends the joiner instead of joining", () => {
    const fromString = trainCase("foo-bar");
    expect(fromString).toBe("Foo-Bar");
    expectTypeOf(fromString).toEqualTypeOf<"-FooBar">();

    const fromTuple = trainCase(["foo", "bar"] as const);
    expect(fromTuple).toBe("Foo-Bar");
    expectTypeOf(fromTuple).toEqualTypeOf<"-FooBar">();

    expectTypeOf<TrainCase<"foo-bar">>().toEqualTypeOf<"-FooBar">();
  });

  it("trainCase: declared type ignores normalize for string input", () => {
    const normalized = trainCase("FooBARb", { normalize: true });
    expect(normalized).toBe("Foo-Ba-Rb");
    expectTypeOf(normalized).toEqualTypeOf<"-FooBARb">();
  });

  it("titleCase: declared type prepends a space instead of joining with spaces", () => {
    const title = titleCase("foo-bar");
    expect(title).toBe("Foo Bar");
    expectTypeOf(title).toEqualTypeOf<" FooBar">();

    const fromTuple = titleCase(["foo", "bar"] as const);
    expect(fromTuple).toBe("Foo Bar");
    expectTypeOf(fromTuple).toEqualTypeOf<" FooBar">();
  });

  it("SplitByCase: leading/trailing splitters are kept in the type but split at runtime", () => {
    const leading = splitByCase("-foo");
    expect(leading).toEqual(["", "foo"]);
    expectTypeOf(leading).toEqualTypeOf<["-foo"]>();

    const trailing = splitByCase("foo-");
    expect(trailing).toEqual(["foo", ""]);
    expectTypeOf(trailing).toEqualTypeOf<["foo-"]>();

    const both = splitByCase("_foo_");
    expect(both).toEqual(["", "foo", ""]);
    expectTypeOf(both).toEqualTypeOf<["_foo_"]>();

    const snake = snakeCase("-foo");
    expect(snake).toBe("_foo");
    expectTypeOf(snake).toEqualTypeOf<"-foo">();
  });

  // pascalCase's implementation-facing overload declares `opts?: CaseOptions`
  // instead of `opts?: UserCaseOptions` (camelCase uses the latter), so the
  // `normalize` literal is never inferred and the result is a union.
  it("pascalCase: normalize option is not inferred, producing a union type", () => {
    const normalized = pascalCase("FOO_BAR", { normalize: true });
    expect(normalized).toBe("FooBar");
    expectTypeOf(normalized).toEqualTypeOf<
      "FOOBAR" | "FOOBar" | "FooBAR" | "FooBar"
    >();

    const notNormalized = pascalCase("FOO_BAR", { normalize: false });
    expect(notNormalized).toBe("FOOBAR");
    expectTypeOf(notNormalized).toEqualTypeOf<
      "FOOBAR" | "FOOBar" | "FooBAR" | "FooBar"
    >();
  });

  // Without options the Normalize parameter defaults to `boolean | undefined`,
  // so uppercase runs yield a union that contains the runtime value.
  it("pascalCase/camelCase without options: uppercase runs widen to a union", () => {
    const pascal = pascalCase("FooBARb");
    expect(pascal).toBe("FooBARb");
    expectTypeOf(pascal).toEqualTypeOf<"FooBARb" | "FooBaRb">();

    const camel = camelCase("XMLHttpRequest");
    expect(camel).toBe("xMLHttpRequest");
    expectTypeOf(camel).toEqualTypeOf<"xMLHttpRequest" | "xmlHttpRequest">();
  });
});
