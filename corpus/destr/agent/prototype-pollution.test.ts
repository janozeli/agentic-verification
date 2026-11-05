import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { destr, safeDestr } from "../src/index";

const POLLUTION = "[destr] Possible prototype pollution";
/** Backslash + "u": prefix of a JSON unicode escape, kept out of source literals. */
const U = "\\u";
const warning = (key: string) => `[destr] Dropping "${key}" key to prevent prototype pollution.`;

let warn: MockInstance<typeof console.warn>;
const objectProtoKeys = Object.getOwnPropertyNames(Object.prototype).sort();

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  // Nothing in this file may leak properties onto Object.prototype.
  expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(objectProtoKeys);
  expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});

/**
 * Every way of spelling `word` as JSON string content where each character is
 * either literal or a \uXXXX escape (with lower- and upper-case hex digits).
 */
function escapeVariants(word: string): string[] {
  let results = [""];
  for (const char of word) {
    const hex = char.charCodeAt(0).toString(16).padStart(4, "0");
    const options = new Set([char, `\\u${hex.toLowerCase()}`, `\\u${hex.toUpperCase()}`]);
    results = results.flatMap((prefix) => [...options].map((option) => prefix + option));
  }
  return results;
}

describe("escapeVariants helper", () => {
  it("produces literal, lower-hex and upper-hex spellings", () => {
    expect(escapeVariants("_o")).toEqual([
      "_o",
      `_${U}006f`,
      `_${U}006F`,
      `${U}005fo`,
      `${U}005f${U}006f`,
      `${U}005f${U}006F`,
      `${U}005Fo`,
      `${U}005F${U}006f`,
      `${U}005F${U}006F`,
    ]);
    expect(escapeVariants("p")).toEqual(["p", `${U}0070`]);
    expect(`${U}0070`).toHaveLength(6);
    expect(`${U}0070`.charCodeAt(0)).toBe(92); // a real backslash
  });
});

describe("__proto__ keys", () => {
  it("drops a nested __proto__ key (README example)", () => {
    const input = '{ "user": { "__proto__": { "isAdmin": true } } }';
    const result = destr<{ user: Record<string, unknown> }>(input);

    expect(result).toEqual({ user: {} });
    expect(Object.keys(result.user)).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(result.user, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(result.user)).toBe(Object.prototype);
    expect(result.user.isAdmin).toBeUndefined();
  });

  it("differs from JSON.parse, which keeps __proto__ as an own property", () => {
    const input = '{ "user": { "__proto__": { "isAdmin": true } } }';
    const parsed = JSON.parse(input);
    expect(Object.prototype.hasOwnProperty.call(parsed.user, "__proto__")).toBe(true);
    expect(Object.keys(parsed.user)).toEqual(["__proto__"]);
  });

  it("drops a top-level __proto__ key and keeps the other keys", () => {
    expect(destr('{"__proto__":{"polluted":true},"a":1,"b":{"c":2}}')).toEqual({
      a: 1,
      b: { c: 2 },
    });
  });

  it.each(['{"x":1}', "1", '"str"', "null", "true", "[]", "{}", "[1,2]"])(
    "drops __proto__ whatever its value: %s",
    (value) => {
      const result = destr<object>(`{"__proto__":${value},"keep":1}`);
      expect(result).toEqual({ keep: 1 });
      expect(Object.keys(result)).toEqual(["keep"]);
    },
  );

  it("drops __proto__ keys inside arrays", () => {
    const result = destr<object[]>('[{"__proto__":{"x":1}},{"__proto__":2,"y":3},4]');
    expect(result).toEqual([{}, { y: 3 }, 4]);
    expect(Object.keys(result[0])).toEqual([]);
  });

  it("drops deeply nested __proto__ keys", () => {
    const result = destr('{"a":{"b":{"c":[{"d":{"__proto__":{"polluted":true},"e":1}}]}}}');
    expect(result).toEqual({ a: { b: { c: [{ d: { e: 1 } }] } } });
  });

  it.each([
    '{"__proto__":{"polluted":true}}',
    '{"__proto__" :{"polluted":true}}',
    '{"__proto__"   \n\t\r :{"polluted":true}}',
    '{ "__proto__" : { "polluted" : true } }',
  ])("detects __proto__ regardless of whitespace before the colon: %j", (input) => {
    expect(destr(input)).toEqual({});
    expect(warn).toHaveBeenCalledWith(warning("__proto__"));
    expect(() => safeDestr(input)).toThrow(POLLUTION);
  });

  it("detects every \\u-escaped spelling of the __proto__ key", () => {
    const variants = escapeVariants("__proto__");
    expect(variants).toHaveLength(3 ** 6 * 2 ** 3);

    for (const key of variants) {
      const input = `{"${key}":{"polluted":true},"ok":1}`;
      // Sanity check: the key really decodes to __proto__.
      expect(Object.keys(JSON.parse(input))).toEqual(["__proto__", "ok"]);

      const result = destr<object>(input);
      expect(result, key).toEqual({ ok: 1 });
      expect(Object.prototype.hasOwnProperty.call(result, "__proto__"), key).toBe(false);
      expect(() => safeDestr(input), key).toThrow(POLLUTION);
    }
    expect(warn).toHaveBeenCalledTimes(variants.length);
  });

  it("logs a warning naming the dropped key", () => {
    destr('{"__proto__":{}}');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(warning("__proto__"));
  });

  it("logs one warning per dropped key", () => {
    destr('[{"__proto__":1},{"__proto__":2},{"a":{"__proto__":3}}]');
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("returns malformed input containing __proto__ unchanged in non-strict mode", () => {
    const input = '{"__proto__": {"polluted": true}';
    expect(destr(input)).toBe(input);
  });

  it("keeps a naive deep merge of the result from polluting prototypes", () => {
    function naiveMerge(target: any, source: any): any {
      for (const key in source) {
        if (typeof source[key] === "object" && source[key] !== null) {
          if (typeof target[key] !== "object" || target[key] === null) {
            target[key] = {};
          }
          naiveMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    }
    const input = '{"__proto__":{"polluted":true}}';

    // With JSON.parse the merge walks into the target's prototype. Use a
    // private prototype so the demonstration does not touch Object.prototype.
    const unsafeProto: Record<string, unknown> = {};
    naiveMerge(Object.create(unsafeProto), JSON.parse(input));
    expect(unsafeProto.polluted).toBe(true);

    const safeProto: Record<string, unknown> = {};
    naiveMerge(Object.create(safeProto), destr(input));
    expect(safeProto.polluted).toBeUndefined();

    const merged = naiveMerge({}, destr(input));
    expect(merged).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("keeps Object.assign of the result from replacing the target's prototype", () => {
    const input = '{"__proto__":{"isAdmin":true}}';

    const unsafe = Object.assign({}, JSON.parse(input));
    expect(unsafe.isAdmin).toBe(true);

    const safe = Object.assign({}, destr<object>(input)) as Record<string, unknown>;
    expect(safe.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(safe)).toBe(Object.prototype);
  });
});

describe("constructor keys", () => {
  it("drops a constructor key whose value has a prototype key", () => {
    expect(destr('{"constructor":{"prototype":{"polluted":true}}}')).toEqual({});
    expect(warn).toHaveBeenCalledWith(warning("constructor"));
  });

  it("drops nested constructor.prototype payloads and keeps siblings", () => {
    expect(
      destr('{"a":{"constructor":{"prototype":{"isAdmin":true}},"b":2},"c":[{"constructor":{"prototype":1}}]}'),
    ).toEqual({ a: { b: 2 }, c: [{}] });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it.each(["null", "1", '"x"', "{}", "[]", "false"])(
    "drops constructor whose value has a prototype key set to %s",
    (prototypeValue) => {
      expect(destr(`{"constructor":{"prototype":${prototypeValue}},"keep":true}`)).toEqual({
        keep: true,
      });
    },
  );

  it.each<[string, unknown]>([
    ['"x"', "x"],
    ["1", 1],
    ["0", 0],
    ["null", null],
    ["true", true],
    ["false", false],
    ['""', ""],
    ["[]", []],
    ['["prototype"]', ["prototype"]],
    ["{}", {}],
    ['{"name":"Foo"}', { name: "Foo" }],
    ['{"Prototype":1}', { Prototype: 1 }],
    ['{"a":{"prototype":1}}', { a: { prototype: 1 } }],
  ])("keeps constructor whose value (%s) has no prototype key", (json, expected) => {
    const result = destr<{ constructor: unknown }>(`{"constructor":${json}}`);
    expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(true);
    expect(result.constructor).toEqual(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it("detects every \\u-escaped spelling of the constructor key", () => {
    const variants = escapeVariants("constructor");
    expect(variants).toHaveLength(3 ** 3 * 2 ** 8);

    for (const key of variants) {
      const input = `{"${key}":{"prototype":{"polluted":true}},"ok":1}`;
      expect(Object.keys(JSON.parse(input))).toEqual(["constructor", "ok"]);

      expect(destr(input), key).toEqual({ ok: 1 });
      expect(() => safeDestr(input), key).toThrow(POLLUTION);
    }
    expect(warn).toHaveBeenCalledTimes(variants.length);
  });

  it.each([
    '{"constructor":{"prototype":{}}}',
    '{"constructor" :{"prototype":{}}}',
    '{"constructor"\n\t :{"prototype":{}}}',
  ])("detects constructor regardless of whitespace before the colon: %j", (input) => {
    expect(destr(input)).toEqual({});
    expect(() => safeDestr(input)).toThrow(POLLUTION);
  });

  it("drops a prototype-carrying constructor that sits next to __proto__", () => {
    expect(destr('{"__proto__":{},"constructor":{"prototype":{}},"x":1}')).toEqual({ x: 1 });
    expect(warn).toHaveBeenCalledWith(warning("__proto__"));
    expect(warn).toHaveBeenCalledWith(warning("constructor"));
  });
});

describe("keys that only resemble dangerous keys", () => {
  it.each([
    '{"_proto_":1}',
    '{"__proto":1}',
    '{"proto__":1}',
    '{"_proto__":1}',
    '{"__proto_":1}',
    '{"___proto___":1}',
    '{"__PROTO__":1}',
    '{"__proto__x":1}',
    '{"x__proto__":1}',
    '{"prototype":1}',
    '{"constructors":1}',
    '{"Constructor":1}',
    '{"xconstructor":1}',
    '{"constructo":1}',
    '{"onstructor":1}',
  ])("parses %j normally in both modes", (input) => {
    expect(destr(input)).toEqual(JSON.parse(input));
    expect(safeDestr(input)).toEqual(JSON.parse(input));
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    '["__proto__"]',
    '{"a":"__proto__"}',
    '{"a":["constructor",{"b":"__proto__"}]}',
    String.raw`{"a":"\"__proto__\": 1"}`,
  ])("does not flag %j where the words appear only as values", (input) => {
    expect(destr(input)).toEqual(JSON.parse(input));
    expect(safeDestr(input)).toEqual(JSON.parse(input));
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn when parsing ordinary JSON", () => {
    destr('{"a":1,"b":[1,2,{"c":"d"}]}');
    destr("[]");
    destr("42");
    expect(warn).not.toHaveBeenCalled();
  });
});
