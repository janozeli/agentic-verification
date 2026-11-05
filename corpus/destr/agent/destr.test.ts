import { describe, expect, expectTypeOf, it } from "vitest";
import destrDefault, { destr, safeDestr, type Options } from "../src/index";

/** Backslash + "u": prefix of a JSON unicode escape, kept out of source literals. */
const U = "\\u";
const NBSP = String.fromCharCode(0xa0);
const BOM = String.fromCharCode(0xfeff);
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

describe("exports", () => {
  it("default export is the destr function", () => {
    expect(destrDefault).toBe(destr);
  });

  it("exposes destr and safeDestr as functions", () => {
    expect(typeof destr).toBe("function");
    expect(typeof safeDestr).toBe("function");
  });

  it("is typed as unknown by default and as the generic parameter when given", () => {
    // Type-level assertions are only enforced by `tsc` / `vitest --typecheck`;
    // the runtime assertions below hold regardless.
    expectTypeOf(destr("{}")).toEqualTypeOf<unknown>();
    expectTypeOf(destr<{ a: number }>('{"a":1}')).toEqualTypeOf<{ a: number }>();
    expectTypeOf(safeDestr<string[]>("[]")).toEqualTypeOf<string[]>();
    expectTypeOf<Options>().toEqualTypeOf<{ strict?: boolean }>();

    const typed = destr<{ a: number }>('{"a":1}');
    expect(typed.a).toBe(1);
  });
});

describe("destr: non-string input is returned as-is", () => {
  const sym = Symbol("s");
  const fn = () => 1;
  const obj = { a: 1 };
  const arr = [1, "2"];
  const date = new Date(0);
  const map = new Map([["k", "v"]]);
  const boxedString = new String("true");
  const nullProto = Object.create(null);

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["true", true],
    ["false", false],
    ["0", 0],
    ["-0", -0],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a float", 42.5],
    ["a bigint", 10n],
    ["a symbol", sym],
    ["a function", fn],
    ["a plain object", obj],
    ["an array", arr],
    ["a Date", date],
    ["a Map", map],
    ["a boxed String object", boxedString],
    ["a null-prototype object", nullProto],
  ])("%s", (_label, input) => {
    // toBe uses Object.is, so this also checks -0 / NaN identity and that
    // objects are returned by reference (not cloned).
    expect(destr(input)).toBe(input);
  });

  it("returns undefined when called without arguments", () => {
    expect((destr as (...args: unknown[]) => unknown)()).toBeUndefined();
  });

  it("does not modify object input", () => {
    const input = { nested: { value: "true" } };
    destr(input);
    expect(input).toEqual({ nested: { value: "true" } });
  });
});

describe("destr: quoted strings", () => {
  it.each([
    ['"hello"', "hello"],
    ['""', ""],
    ['"true"', "true"],
    ['"null"', "null"],
    ['"undefined"', "undefined"],
    ['"123"', "123"],
    ['"{}"', "{}"],
    ['"[1,2]"', "[1,2]"],
    ['"  spaced  "', "  spaced  "],
    ['"日本語 😀"', "日本語 😀"],
  ])("unwraps %s to a string", (input, expected) => {
    expect(destr(input)).toBe(expected);
  });

  it.each([
    [String.raw`"a\nb"`, "a\nb"],
    [String.raw`"tab\there"`, "tab\there"],
    [String.raw`"say \"hi\""`, 'say "hi"'],
    [String.raw`"back\\slash"`, "back\\slash"],
    [String.raw`"\/"`, "/"],
    [`"${U}0041${U}00e9"`, "Aé"],
    [`"${U}d83d${U}de00"`, "😀"],
    [String.raw`"\b\f\r"`, "\b\f\r"],
  ])("decodes escape sequences in %s", (input, expected) => {
    expect(input).toContain("\\"); // guard: input really goes through JSON.parse
    expect(destr(input)).toBe(expected);
    expect(destr(input)).toBe(JSON.parse(input));
  });

  it.each([
    [' "foo" ', "foo"],
    ['\n\t"foo"\r\n', "foo"],
    [String.raw`  "a\nb"  `, "a\nb"],
  ])("parses quoted string %j surrounded by whitespace", (input, expected) => {
    expect(destr(input)).toBe(expected);
  });

  it.each([
    '"foo',
    'foo"',
    String.raw`"\x"`,
    `"${U}12"`,
    `"${U}zzzz"`,
    String.raw`"\"`,
    String.raw`"a\n" b`,
    String.raw`"a\n""b"`,
  ])("returns malformed quoted input %j unchanged", (input) => {
    expect(destr(input)).toBe(input);
  });

  // Current behaviour: a string that starts and ends with `"` and contains no
  // backslash is unwrapped with slice() without validation, so some inputs that
  // are not valid JSON still produce a string.
  it("unwraps quote-delimited strings without validating them", () => {
    expect(destr('"')).toBe("");
    expect(destr('"a"b"')).toBe('a"b');
    expect(destr('"line\nbreak"')).toBe("line\nbreak");
    expect(destr('"tab\there"')).toBe("tab\there");
    expect(() => JSON.parse('"')).toThrow(SyntaxError);
    expect(() => JSON.parse('"a"b"')).toThrow(SyntaxError);
    expect(() => JSON.parse('"line\nbreak"')).toThrow(SyntaxError);
  });
});

describe("destr: known keyword values", () => {
  it.each<[string, unknown]>([
    ["true", true],
    ["false", false],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("resolves %j", (input, expected) => {
    expect(destr(input)).toBe(expected);
  });

  it.each<[string, unknown]>([
    ["TRUE", true],
    ["True", true],
    ["tRuE", true],
    ["FALSE", false],
    ["False", false],
    ["NULL", null],
    ["Null", null],
    ["UNDEFINED", undefined],
    ["Undefined", undefined],
    ["nan", Number.NaN],
    ["NAN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["INFINITY", Number.POSITIVE_INFINITY],
    ["-infinity", Number.NEGATIVE_INFINITY],
    ["-INFINITY", Number.NEGATIVE_INFINITY],
  ])("is case-insensitive: %j", (input, expected) => {
    expect(destr(input)).toBe(expected);
  });

  it.each<[string, unknown]>([
    [" true ", true],
    ["true ", true],
    [" true", true],
    ["\ttrue\n", true],
    ["  null  ", null],
    ["\r\nfalse\r\n", false],
    ["undefined   ", undefined],
    ["   undefined", undefined],
    ["  -Infinity  ", Number.NEGATIVE_INFINITY],
    ["\n NaN \n", Number.NaN],
  ])("ignores surrounding whitespace: %j", (input, expected) => {
    expect(destr(input)).toBe(expected);
  });

  it.each([
    "+Infinity",
    "+infinity",
    "Inf",
    "-NaN",
    "nil",
    "None",
    "yes",
    "no",
    "on",
    "off",
    "truee",
    "t rue",
    "true false",
    "null null",
    "undefinedx",
    "Infinity1",
    "-Infinityx",
  ])("does not treat %j as a keyword", (input) => {
    expect(destr(input)).toBe(input);
  });
});

describe("destr: numbers", () => {
  it.each<[string, number]>([
    ["0", 0],
    ["-0", -0],
    ["7", 7],
    ["42", 42],
    ["-42", -42],
    ["3.14", 3.14],
    ["-0.5", -0.5],
    ["10.0", 10],
    ["1e3", 1000],
    ["1E3", 1000],
    ["1e+3", 1000],
    ["1E+3", 1000],
    ["1e-3", 0.001],
    ["-2.5E-2", -0.025],
    ["1e0001", 10],
    ["  42  ", 42],
    ["\n12\t", 12],
    [" -7", -7],
    ["8 ", 8],
  ])("parses %j", (input, expected) => {
    expect(destr(input)).toBe(expected);
  });

  it("parses out-of-range exponents like JSON.parse does", () => {
    expect(destr("1e400")).toBe(Number.POSITIVE_INFINITY);
    expect(destr("-1e400")).toBe(Number.NEGATIVE_INFINITY);
    expect(destr("1e-400")).toBe(0);
  });

  it("parses integers of up to 16 digits", () => {
    expect(destr("1234567890123456")).toBe(1_234_567_890_123_456);
    expect(destr("-1234567890123456")).toBe(-1_234_567_890_123_456);
    expect(destr("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
    expect(destr("-9007199254740991")).toBe(Number.MIN_SAFE_INTEGER);
  });

  it.each([
    "12345678901234567",
    "-12345678901234567",
    "12345678901234567890",
    "00000000000000001",
    "12345678901234567.5",
    "12345678901234567e2",
  ])("keeps integers with 17+ digits as the original string: %j", (input) => {
    expect(destr(input)).toBe(input);
  });

  // Current behaviour: the 16-digit cutoff does not line up with
  // Number.MAX_SAFE_INTEGER, so some 16-digit integers silently lose precision.
  it("loses precision for 16-digit integers above MAX_SAFE_INTEGER", () => {
    expect(destr("9007199254740993")).toBe(9_007_199_254_740_992);
    expect(destr("9999999999999999")).toBe(10_000_000_000_000_000);
  });

  it("parses up to 17 fraction digits", () => {
    expect(destr("0.12345678901234567")).toBe(0.123_456_789_012_345_67);
    expect(destr("-1.12345678901234567")).toBe(-1.123_456_789_012_345_67);
    expect(destr("0.1")).toBe(0.1);
  });

  it.each(["0.123456789012345678", "1.000000000000000000", "0.0000012345678901234567"])(
    "keeps numbers with 18+ fraction digits as the original string: %j",
    (input) => {
      expect(destr(input)).toBe(input);
    },
  );

  it.each([
    "+1",
    ".5",
    "-.5",
    "1.",
    "1.e3",
    "1e",
    "1e+",
    "1e-",
    "e3",
    "-",
    "--1",
    "- 1",
    "0x10",
    "0b1",
    "0o7",
    "1_000",
    "1,000",
    "1 2",
    "1..2",
    "1.2.3",
    "123abc",
    "12px",
    "abc 123",
    "١٢٣",
  ])("returns non-JSON numeric-looking string %j unchanged", (input) => {
    expect(destr(input)).toBe(input);
  });

  it.each(["01", "00", "-01", "007", "01.5"])(
    "returns numbers with leading zeros (%j) unchanged because JSON.parse rejects them",
    (input) => {
      expect(destr(input)).toBe(input);
    },
  );
});

describe("destr: objects and arrays", () => {
  it("parses a JSON object", () => {
    expect(destr('{"a":1,"b":"two","c":[true,null],"d":{"e":1.5}}')).toEqual({
      a: 1,
      b: "two",
      c: [true, null],
      d: { e: 1.5 },
    });
  });

  it("parses a JSON array", () => {
    expect(destr('[1,"a",false,null,{"x":[]}]')).toEqual([1, "a", false, null, { x: [] }]);
  });

  it.each<[string, unknown]>([
    ["{}", {}],
    ["[]", []],
    ["{ }", {}],
    ["[ ]", []],
    ["[[[]]]", [[[]]]],
  ])("parses %j", (input, expected) => {
    expect(destr(input)).toEqual(expected);
  });

  it("parses JSON with surrounding and inner whitespace", () => {
    expect(destr('  \n{ "a" : 1 ,\n\t"b" : [ 1 , 2 ] }\n  ')).toEqual({ a: 1, b: [1, 2] });
  });

  it("matches JSON.parse for a pretty-printed document", () => {
    const doc = {
      id: 1,
      name: "destr",
      tags: ["json", "parse"],
      meta: { stars: 1e3, ratio: -0.25, ok: true, none: null },
      unicode: `日本語 ${LINE_SEP} 😀`,
      escaped: 'quote " backslash \\ newline \n',
    };
    const text = JSON.stringify(doc, null, 2);
    expect(destr(text)).toEqual(JSON.parse(text));
    expect(destr(text)).toEqual(doc);
  });

  it("returns a fresh object on each call", () => {
    const text = '{"a":{"b":1}}';
    const first = destr<{ a: { b: number } }>(text);
    const second = destr<{ a: { b: number } }>(text);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.a).not.toBe(second.a);
  });

  it("produces plain objects with Object.prototype", () => {
    const result = destr<{ a: object }>('{"a":{}}');
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.a)).toBe(Object.prototype);
    expect(Array.isArray(destr("[]"))).toBe(true);
  });

  it("does not apply the 16-digit number limit inside objects or arrays", () => {
    expect(destr("[12345678901234567890]")).toEqual([12_345_678_901_234_567_000]);
    expect(destr('{"n":12345678901234567890}')).toEqual({ n: 12_345_678_901_234_567_000 });
  });

  it("does not revive dates", () => {
    expect(destr('"2020-01-01T00:00:00.000Z"')).toBe("2020-01-01T00:00:00.000Z");
    expect(destr('{"d":"2020-01-01T00:00:00.000Z"}')).toEqual({ d: "2020-01-01T00:00:00.000Z" });
  });

  it("keeps duplicate keys like JSON.parse (last one wins)", () => {
    expect(destr('{"a":1,"a":2}')).toEqual({ a: 2 });
  });

  it.each([
    "[foo",
    "{",
    "[",
    "}",
    "]",
    "{]",
    "[1,2",
    "[1,]",
    "{'a':1}",
    "{a:1}",
    '{"a":1,}',
    '{"a" 1}',
    '{"a":1} x',
    "[1] [2]",
    "[NaN]",
    "[undefined]",
    "[Infinity]",
    '{"a": .5}',
    "[01]",
    "{} // comment",
  ])("returns malformed JSON %j unchanged", (input) => {
    expect(destr(input)).toBe(input);
  });

  it("returns the original untrimmed input when parsing fails", () => {
    expect(destr("  [foo  ")).toBe("  [foo  ");
    expect(destr("\n{bad}\n")).toBe("\n{bad}\n");
  });
});

describe("destr: plain strings fall back to the input", () => {
  it.each([
    "",
    " ",
    "   ",
    "\n\t",
    "hello",
    "salam",
    "  hello  ",
    "hello world",
    "foo:bar",
    "a,b,c",
    "TRUE!",
    "nulll",
    "/path/to/file",
    "https://example.com/?q=1",
    "2020-01-01",
    "12:30",
    "v1.2.3",
    "€100",
    "😀",
    "hello [world]",
    "key={}",
    "a\"b",
  ])("returns %j unchanged", (input) => {
    expect(destr(input)).toBe(input);
  });

  it("returns a long non-JSON string unchanged", () => {
    const input = "x".repeat(100_000);
    expect(destr(input)).toBe(input);
  });
});

describe("destr: non-JSON whitespace", () => {
  // String#trim() and the regex \s treat Unicode whitespace (NBSP, BOM, line
  // separators) as whitespace, but JSON.parse only accepts space, tab, CR, LF.
  it("treats Unicode whitespace around keywords as whitespace", () => {
    expect(destr(`${NBSP}true${NBSP}`)).toBe(true);
    expect(destr(`${BOM}null`)).toBe(null);
    expect(destr(`${LINE_SEP}false${PARA_SEP}`)).toBe(false);
  });

  it("does not parse JSON or numbers padded with Unicode whitespace", () => {
    expect(destr(`${BOM}{"a":1}`)).toBe(`${BOM}{"a":1}`);
    expect(destr(`${NBSP}42`)).toBe(`${NBSP}42`);
    expect(destr(`[1]${NBSP}`)).toBe(`[1]${NBSP}`);
  });
});

describe("destr: options", () => {
  it("treats { strict: false } like the default", () => {
    expect(destr("salam", { strict: false })).toBe("salam");
    expect(destr("[foo", { strict: false })).toBe("[foo");
    expect(destr('{"a":1}', { strict: false })).toEqual({ a: 1 });
  });

  it("accepts an explicit undefined options argument", () => {
    expect(destr("salam", undefined)).toBe("salam");
    expect(destr("[1]", undefined)).toEqual([1]);
  });

  it("treats { strict: true } like safeDestr", () => {
    expect(() => destr("salam", { strict: true })).toThrow("[destr] Invalid JSON");
    expect(() => destr("[foo", { strict: true })).toThrow(SyntaxError);
    expect(destr('{"a":1}', { strict: true })).toEqual({ a: 1 });
  });
});
