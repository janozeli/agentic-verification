import { describe, expect, it } from "vitest";
import { destr, safeDestr } from "../src/index";

const INVALID_JSON = "[destr] Invalid JSON";
const POLLUTION = "[destr] Possible prototype pollution";
/** Backslash + "u": prefix of a JSON unicode escape, kept out of source literals. */
const U = "\\u";
const NBSP = String.fromCharCode(0xa0);
const BOM = String.fromCharCode(0xfeff);

/** Runs fn and returns the thrown value, failing the test if nothing is thrown. */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected function to throw");
}

describe("safeDestr: valid input", () => {
  it.each([
    "{}",
    "[]",
    '{"a":1,"b":[true,false,null],"c":{"d":"e"}}',
    "[1,2,3]",
    '  { "spaced" : [ 1 , 2 ] }  ',
    '"plain"',
    String.raw`"esc\"aped\n"`,
    "0",
    "-1.5e-3",
    "1234567890123456",
    "0.12345678901234567",
    '{"constructorX":1,"x__proto__":2}',
  ])("parses %j like JSON.parse", (input) => {
    expect(safeDestr(input)).toEqual(JSON.parse(input));
  });

  it.each<[string, unknown]>([
    ["true", true],
    ["false", false],
    ["null", null],
    [" TRUE ", true],
    ["Null", null],
  ])("resolves keyword %j", (input, expected) => {
    expect(safeDestr(input)).toBe(expected);
  });

  // Current behaviour: the keyword lookup runs before strict validation, so
  // these non-JSON tokens are accepted in strict mode.
  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["UNDEFINED", undefined],
  ])("accepts non-JSON keyword %j", (input, expected) => {
    expect(safeDestr(input)).toBe(expected);
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["number", 1],
    ["boolean", false],
    ["NaN", Number.NaN],
    ["bigint", 1n],
  ])("returns non-string %s input as-is", (_label, input) => {
    expect(safeDestr(input)).toBe(input);
  });

  it("returns non-string object input by reference", () => {
    const obj = { a: 1 };
    const arr: unknown[] = [];
    const fn = () => {};
    expect(safeDestr(obj)).toBe(obj);
    expect(safeDestr(arr)).toBe(arr);
    expect(safeDestr(fn)).toBe(fn);
  });

  // Current behaviour (suspected bug): the quoted-string fast path runs before
  // strict validation, so these invalid JSON strings do not throw.
  it("accepts some invalid JSON strings through the quoted-string fast path", () => {
    expect(safeDestr('"')).toBe("");
    expect(safeDestr('"a"b"')).toBe('a"b');
    expect(safeDestr('"line\nbreak"')).toBe("line\nbreak");
  });

  // Current behaviour: 16-digit integers are accepted even when they cannot be
  // represented exactly.
  it("accepts 16-digit integers above MAX_SAFE_INTEGER with precision loss", () => {
    expect(safeDestr("9007199254740993")).toBe(9_007_199_254_740_992);
  });
});

describe("safeDestr: input that does not look like JSON", () => {
  it.each([
    "",
    " ",
    "\n\t",
    "salam",
    "  hello  ",
    "hello world",
    "hello [world]",
    "foo {}",
    "abc 123",
    "123abc",
    "1 2",
    "+1",
    ".5",
    "1.",
    "1e",
    "1e+",
    "-",
    "--1",
    "0x10",
    "+Infinity",
    "TRUE!",
    "12345678901234567",
    "-12345678901234567",
    "0.123456789012345678",
  ])("throws a SyntaxError with message '[destr] Invalid JSON' for %j", (input) => {
    const error = thrownBy(() => safeDestr(input));
    expect(error).toBeInstanceOf(SyntaxError);
    expect((error as Error).message).toBe(INVALID_JSON);
  });
});

describe("safeDestr: malformed JSON-looking input", () => {
  it.each([
    "[foo",
    "{",
    "[",
    "[1,]",
    "{a:1}",
    "{'a':1}",
    '{"a":1,}',
    '{"a":1} x',
    "[1] [2]",
    "[NaN]",
    '"foo',
    String.raw`"\x"`,
    String.raw`"\"`,
    "01",
    "-01",
    "  [foo  ",
    `${BOM}{"a":1}`,
    `${NBSP}42`,
  ])("rethrows the JSON.parse SyntaxError for %j", (input) => {
    let expected: unknown;
    try {
      JSON.parse(input);
    } catch (error) {
      expected = error;
    }
    expect(expected).toBeInstanceOf(SyntaxError);

    const error = thrownBy(() => safeDestr(input));
    expect(error).toBeInstanceOf(SyntaxError);
    expect((error as Error).message).not.toBe(INVALID_JSON);
    expect((error as Error).message).toBe((expected as Error).message);
  });
});

describe("safeDestr: prototype pollution", () => {
  it.each([
    '{ "user": { "__proto__": { "isAdmin": true } } }',
    '{"__proto__":{}}',
    '{"__proto__" : 1}',
    '[{"__proto__":null}]',
    `{"${U}005f${U}005fproto${U}005f${U}005f":{}}`,
    `{"__${U}0070r${U}006Ft${U}006f__":{}}`,
    '{"constructor":{"prototype":{}}}',
    `{"${U}0063onstructor":{"prototype":{}}}`,
  ])("throws '[destr] Possible prototype pollution' for %j", (input) => {
    const error = thrownBy(() => safeDestr(input));
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect((error as Error).message).toBe(POLLUTION);
  });

  // Current behaviour: in strict mode any "constructor" key is rejected, even
  // when non-strict mode would keep it.
  it.each(['{"constructor":"x"}', '{"constructor":1}', '{"constructor":{"name":"Foo"}}'])(
    "rejects harmless constructor key %j",
    (input) => {
      expect(() => safeDestr(input)).toThrow(POLLUTION);
      expect(destr(input)).toEqual(JSON.parse(input));
    },
  );

  it("checks for prototype pollution before validating the JSON", () => {
    expect(() => safeDestr('{"__proto__": ')).toThrow(POLLUTION);
    expect(() => safeDestr('{"constructor": ')).toThrow(POLLUTION);
  });

  it("does not reject __proto__ or constructor appearing as values", () => {
    expect(safeDestr('["__proto__","constructor"]')).toEqual(["__proto__", "constructor"]);
    expect(safeDestr('{"a":"__proto__","b":"constructor"}')).toEqual({
      a: "__proto__",
      b: "constructor",
    });
    expect(safeDestr('"__proto__"')).toBe("__proto__");
  });
});

describe("safeDestr: options", () => {
  it("cannot be switched to non-strict mode", () => {
    expect(() => safeDestr("salam", { strict: false })).toThrow(INVALID_JSON);
    expect(() => safeDestr("[foo", { strict: false })).toThrow(SyntaxError);
  });

  it("does not mutate the options object", () => {
    const options = { strict: false };
    expect(() => safeDestr("salam", options)).toThrow(INVALID_JSON);
    expect(options).toEqual({ strict: false });
  });

  it("behaves like destr(value, { strict: true })", () => {
    const inputs = ["[1]", '{"a":1}', "true", "42", '"x"', "undefined"];
    for (const input of inputs) {
      expect(safeDestr(input)).toEqual(destr(input, { strict: true }));
    }
    expect(() => destr("salam", { strict: true })).toThrow(INVALID_JSON);
    expect(() => destr("[foo", { strict: true })).toThrow(SyntaxError);
    expect(() => destr('{"__proto__":{}}', { strict: true })).toThrow(POLLUTION);
  });
});
