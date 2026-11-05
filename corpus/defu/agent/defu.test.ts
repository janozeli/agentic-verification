import vm from "node:vm";
import { describe, expect, it } from "vitest";
import defuDefault, { createDefu, defu, defuArrayFn, defuFn } from "../src/defu";

class Point {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
}

describe("exports", () => {
  it("exposes defu as both named and default export", () => {
    expect(defuDefault).toBe(defu);
  });

  it("exports callable defu, defuFn, defuArrayFn and createDefu", () => {
    expect(typeof defu).toBe("function");
    expect(typeof defuFn).toBe("function");
    expect(typeof defuArrayFn).toBe("function");
    expect(typeof createDefu).toBe("function");
  });

  // The DefuInstance type declares `fn`, `arrayFn` and `extend` members, but
  // the runtime object does not attach them. This pins the current behavior.
  it("does not attach fn / arrayFn / extend to defu at runtime (despite DefuInstance typing)", () => {
    expect((defu as any).fn).toBeUndefined();
    expect((defu as any).arrayFn).toBeUndefined();
    expect((defu as any).extend).toBeUndefined();
  });
});

describe("defu: basic merging", () => {
  it("assigns default properties recursively (README example)", () => {
    expect(defu({ a: { b: 2 } }, { a: { b: 1, c: 3 } })).toEqual({ a: { b: 2, c: 3 } });
  });

  it("gives leftmost arguments the highest priority", () => {
    expect(defu({ a: 1 }, { a: 2, b: 2 }, { a: 3, b: 3, c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("adds keys that only exist in the defaults", () => {
    expect(defu({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("merges many arguments in priority order", () => {
    const result = defu(
      { level: "first" },
      { level: "second", second: true },
      { level: "third", third: true },
      { level: "fourth", fourth: true, second: false },
    );
    expect(result).toEqual({ level: "first", second: true, third: true, fourth: true });
  });

  it("returns an empty object when called without arguments", () => {
    expect((defu as any)()).toEqual({});
  });

  it("returns a shallow copy (not the same reference) for a single argument", () => {
    const input = { a: 1, nested: { b: 2 } };
    const result = defu(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it("returns a new object even when every argument is empty", () => {
    const a = {};
    const b = {};
    const result = defu(a, b);
    expect(result).toEqual({});
    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
  });

  it("returns a plain object with Object.prototype", () => {
    const result = defu({ a: 1 }, { b: 2 });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("supports numeric-like keys", () => {
    expect(defu({ 1: "a" }, { 1: "b", 2: "c" })).toEqual({ 1: "a", 2: "c" });
  });

  it("does not deduplicate or reorder values from different keys", () => {
    expect(defu({ a: "x" }, { b: "x" })).toEqual({ a: "x", b: "x" });
  });
});

describe("defu: non-object arguments", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a string", "str"],
    ["a boolean", true],
    ["an array", [1, 2, 3]],
    ["a function", () => ({ a: 2 })],
    ["a Date", new Date(0)],
    ["a Map", new Map([["a", 2]])],
    ["a class instance", new Point(5, 6)],
  ])("ignores %s passed as defaults", (_label, value) => {
    expect(defu({ a: 1 }, value as any)).toEqual({ a: 1 });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a string", "str"],
    ["an array", ["x", "y"]],
    ["a class instance", new Point(5, 6)],
  ])("ignores %s passed as the first argument", (_label, value) => {
    expect(defu(value as any, { a: 1 })).toEqual({ a: 1 });
  });

  it("ignores non-object arguments interleaved with objects", () => {
    expect(defu({ a: 1 }, null, { b: 2 }, undefined, false, 0, { c: 3 }, [] as any)).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it("returns an empty object when no argument is a plain object", () => {
    expect(defu(null as any, undefined, 1, "x" as any, [1])).toEqual({});
  });

  it("does not copy own properties of a class instance used as a top-level argument", () => {
    const instance = new Point(1, 2);
    const result = defu(instance as any, { z: 3 });
    expect(result).toEqual({ z: 3 });
    expect(result).not.toHaveProperty("x");
  });
});

describe("defu: nullish values", () => {
  it("skips null and undefined values, falling back to defaults", () => {
    expect(defu({ a: null, b: undefined }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("skips nullish values in nested objects", () => {
    expect(defu({ a: { b: null, c: undefined, d: 4 } }, { a: { b: 2, c: 3, d: 0 } })).toEqual({
      a: { b: 2, c: 3, d: 4 },
    });
  });

  it("keeps nullish values that come from the last (defaults) argument", () => {
    const result = defu({}, { a: null, b: undefined });
    expect(result).toStrictEqual({ a: null, b: undefined });
    expect(Object.keys(result)).toEqual(["a", "b"]);
  });

  it("keeps nullish values when only one argument is given", () => {
    const result = defu({ a: null, b: undefined });
    expect(Object.keys(result)).toEqual(["a", "b"]);
    expect(result.a).toBeNull();
  });

  it("drops nullish keys from earlier arguments when a later argument does not define them", () => {
    const result = defu({ a: null, b: undefined, c: 1 }, {});
    expect(result).toStrictEqual({ c: 1 });
    expect(Object.keys(result)).toEqual(["c"]);
  });

  it("lets a later nullish default fill in for an earlier nullish value", () => {
    expect(defu({ a: undefined }, { a: null })).toStrictEqual({ a: null });
  });

  it("does not let a nullish value in a higher-priority argument overwrite a nested default object", () => {
    expect(defu({ nested: null }, { nested: { a: 1 } })).toEqual({ nested: { a: 1 } });
  });

  it("does not treat falsy non-nullish values as missing", () => {
    const result = defu(
      { zero: 0, no: false, empty: "", nan: Number.NaN, big: 0n },
      { zero: 1, no: true, empty: "default", nan: 5, big: 10n },
    );
    expect(result).toEqual({ zero: 0, no: false, empty: "", nan: Number.NaN, big: 0n });
  });
});

describe("defu: arrays", () => {
  it("concatenates arrays, leftmost values first (README example)", () => {
    expect(defu({ array: ["b", "c"] }, { array: ["a"] })).toEqual({ array: ["b", "c", "a"] });
  });

  it("concatenates arrays across many arguments in priority order", () => {
    expect(defu({ a: [1] }, { a: [2] }, { a: [3, 4] })).toEqual({ a: [1, 2, 3, 4] });
  });

  it("does not deduplicate concatenated values", () => {
    expect(defu({ a: [1, 2] }, { a: [2, 3] })).toEqual({ a: [1, 2, 2, 3] });
  });

  it("cannot clear a default array with an empty array", () => {
    expect(defu({ a: [] }, { a: [1, 2] })).toEqual({ a: [1, 2] });
  });

  it("creates a new array and leaves the input arrays unchanged", () => {
    const left = [1];
    const right = [2];
    const result = defu({ a: left }, { a: right });
    expect(result.a).not.toBe(left);
    expect(result.a).not.toBe(right);
    expect(left).toEqual([1]);
    expect(right).toEqual([2]);
  });

  it("keeps the array reference when only one side defines it", () => {
    const fromObject = [1];
    const fromDefaults = [2];
    expect(defu({ a: fromObject }, {}).a).toBe(fromObject);
    expect(defu({}, { a: fromDefaults }).a).toBe(fromDefaults);
  });

  it("does not merge array elements; objects inside arrays are kept as-is", () => {
    const item1 = { id: 1 };
    const item2 = { id: 2 };
    const result = defu({ list: [item1] }, { list: [item2] });
    expect(result.list).toHaveLength(2);
    expect(result.list[0]).toBe(item1);
    expect(result.list[1]).toBe(item2);
  });

  it("concatenates nested arrays without flattening their elements", () => {
    expect(defu({ a: [[1]] }, { a: [[2]] })).toEqual({ a: [[1], [2]] });
  });

  it("concatenates arrays inside nested objects", () => {
    expect(defu({ a: { b: { list: ["x"] } } }, { a: { b: { list: ["y"] } } })).toEqual({
      a: { b: { list: ["x", "y"] } },
    });
  });

  it("lets an array override a non-array default", () => {
    expect(defu({ a: [1] }, { a: "str" })).toEqual({ a: [1] });
    expect(defu({ a: [1] }, { a: { b: 1 } })).toEqual({ a: [1] });
    expect(defu({ a: [1] }, { a: 0 })).toEqual({ a: [1] });
  });

  it("lets a non-array value override an array default", () => {
    expect(defu({ a: "str" }, { a: [1] })).toEqual({ a: "str" });
    expect(defu({ a: { b: 1 } }, { a: [1] })).toEqual({ a: { b: 1 } });
    expect(defu({ a: false }, { a: [1] })).toEqual({ a: false });
  });

  it("treats arrays as values that are not deep-merged by index", () => {
    expect(defu({ a: [{ x: 1 }] }, { a: [{ y: 2 }] })).toEqual({ a: [{ x: 1 }, { y: 2 }] });
  });

  it("treats a cross-realm array as an array for concatenation", () => {
    const foreign = vm.runInNewContext("[1, 2]");
    const result = defu({ a: foreign }, { a: [3] });
    expect(Array.from(result.a)).toEqual([1, 2, 3]);
  });
});

describe("defu: nested objects", () => {
  it("merges deeply nested objects", () => {
    const result = defu(
      { a: { b: { c: { d: 1 } } } },
      { a: { b: { c: { d: 0, e: 2 }, f: 3 }, g: 4 }, h: 5 },
    );
    expect(result).toEqual({ a: { b: { c: { d: 1, e: 2 }, f: 3 }, g: 4 }, h: 5 });
  });

  it("merges nested objects across multiple defaults", () => {
    expect(defu({ a: { x: 1 } }, { a: { y: 2 } }, { a: { z: 3, x: 0 } })).toEqual({
      a: { x: 1, y: 2, z: 3 },
    });
  });

  it("lets a plain object override a primitive default", () => {
    expect(defu({ a: { b: 1 } }, { a: "str" })).toEqual({ a: { b: 1 } });
    expect(defu({ a: { b: 1 } }, { a: 42 })).toEqual({ a: { b: 1 } });
  });

  it("lets a primitive override a plain object default", () => {
    expect(defu({ a: "str" }, { a: { b: 1 } })).toEqual({ a: "str" });
    expect(defu({ a: 0 }, { a: { b: 1 } })).toEqual({ a: 0 });
  });

  it("creates a new nested object when both sides have plain objects", () => {
    const left = { x: 1 };
    const right = { y: 2 };
    const result = defu({ a: left }, { a: right });
    expect(result.a).toEqual({ x: 1, y: 2 });
    expect(result.a).not.toBe(left);
    expect(result.a).not.toBe(right);
  });

  it("keeps nested references when only one side defines the key (shallow copy semantics)", () => {
    const fromObject = { x: 1 };
    const fromDefaults = { y: 2 };
    const result = defu({ a: fromObject }, { b: fromDefaults });
    expect(result.a).toBe(fromObject);
    expect(result.b).toBe(fromDefaults);
  });

  it("merges null-prototype objects like plain objects", () => {
    const left = Object.assign(Object.create(null), { a: 1, nested: Object.assign(Object.create(null), { x: 1 }) });
    const right = Object.assign(Object.create(null), { b: 2, nested: { y: 2 } });
    const result = defu(left, right);
    expect({ ...result }).toEqual({ a: 1, b: 2, nested: { x: 1, y: 2 } });
  });

  it("merges objects created in another realm", () => {
    const foreign = vm.runInNewContext("({ nested: { a: 1 } })");
    const result = defu(foreign, { nested: { b: 2 } });
    expect(result.nested).toEqual({ a: 1, b: 2 });
  });

  it("merges object literals whose prototype is a null-prototype object", () => {
    const base = Object.create(Object.create(null));
    base.a = 1;
    expect(defu(base, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("does not merge into a nested object whose prototype is a plain object", () => {
    const child = Object.create({ inherited: true });
    child.own = 1;
    const result = defu({ a: child }, { a: { other: 2 } });
    expect(result.a).toBe(child);
  });
});

describe("defu: non-plain values are assigned, not merged", () => {
  it.each([
    ["Date", new Date(1000), new Date(2000)],
    ["RegExp", /left/, /right/],
    ["Map", new Map([["left", 1]]), new Map([["right", 2]])],
    ["Set", new Set(["left"]), new Set(["right"])],
    ["class instance", new Point(1, 1), new Point(2, 2)],
    ["Promise", Promise.resolve("left"), Promise.resolve("right")],
    ["function", () => "left", () => "right"],
    ["Error", new Error("left"), new Error("right")],
    ["Uint8Array", new Uint8Array([1]), new Uint8Array([2])],
  ])("keeps the leftmost %s by reference", (_label, left, right) => {
    const result = defu({ value: left }, { value: right });
    expect(result.value).toBe(left);
  });

  it("does not merge a plain object into a class instance default", () => {
    const point = new Point(1, 2);
    const plain = { z: 3 };
    const result = defu({ p: plain }, { p: point });
    expect(result.p).toBe(plain);
    expect(result.p).not.toBeInstanceOf(Point);
  });

  it.each([
    ["a string", "str"],
    ["a number", 42],
    ["an array", [1, 2]],
    ["a Date", new Date(0)],
    ["a function", () => {}],
  ])("keeps a plain object by reference (nullish entries included) when the default is %s", (_label, defaultValue) => {
    const plain = { kept: 1, empty: null };
    const result = defu({ value: plain }, { value: defaultValue as any });
    expect(result.value).toBe(plain);
    expect(result.value).toStrictEqual({ kept: 1, empty: null });
  });

  it("does not merge a class instance into a plain object default", () => {
    const point = new Point(1, 2);
    const result = defu({ p: point }, { p: { z: 3 } });
    expect(result.p).toBe(point);
  });

  it("does not merge objects that define Symbol.iterator", () => {
    const iterable = { a: 1, *[Symbol.iterator]() {} };
    const result = defu({ v: iterable }, { v: { b: 2 } });
    expect(result.v).toBe(iterable);
  });

  it("does not merge objects with a custom Symbol.toStringTag", () => {
    const tagged = { a: 1, [Symbol.toStringTag]: "Custom" };
    const result = defu({ v: tagged }, { v: { b: 2 } });
    expect(result.v).toBe(tagged);
  });

  it("merges objects whose Symbol.toStringTag is 'Module'", () => {
    const moduleLike = { a: 1, [Symbol.toStringTag]: "Module" };
    const result = defu({ v: moduleLike }, { v: { b: 2 } });
    expect(result.v).not.toBe(moduleLike);
    expect(result.v).toMatchObject({ a: 1, b: 2 });
  });

  it("keeps default functions when not overridden", () => {
    const fn = () => 1;
    expect(defu({}, { fn }).fn).toBe(fn);
  });
});

describe("defu: input immutability", () => {
  it("does not modify any of its arguments", () => {
    const object = { a: { b: 1, list: [1] }, c: null, d: [1] };
    const defaults1 = { a: { b: 2, e: 3, list: [2] }, c: 4, d: [2], f: { g: 1 } };
    const defaults2 = { a: { h: 5 }, f: { g: 2, i: 3 }, d: "x" };

    const snapshots = [structuredClone(object), structuredClone(defaults1), structuredClone(defaults2)];
    const result = defu(object, defaults1, defaults2);

    expect(result).toEqual({
      a: { b: 1, list: [1, 2], e: 3, h: 5 },
      c: 4,
      d: [1, 2],
      f: { g: 1, i: 3 },
    });
    expect(object).toEqual(snapshots[0]);
    expect(defaults1).toEqual(snapshots[1]);
    expect(defaults2).toEqual(snapshots[2]);
  });

  it("does not freeze or otherwise change the input objects", () => {
    const object = { a: 1 };
    defu(object, { b: 2 });
    expect(Object.isFrozen(object)).toBe(false);
    expect(Object.keys(object)).toEqual(["a"]);
  });

  it("returns objects that share references with inputs for non-merged nested values", () => {
    const nested = { x: 1 };
    const result = defu({}, { nested });
    result.nested.x = 2;
    // Mutating the result leaks into the input because defu copies shallowly.
    expect(nested.x).toBe(2);
  });
});

describe("defu: property handling", () => {
  it("copies symbol keys from the defaults (last) argument", () => {
    const sym = Symbol("sym");
    const result = defu({}, { [sym]: 1 });
    expect(result[sym]).toBe(1);
  });

  it("keeps symbol keys when called with a single argument", () => {
    const sym = Symbol("sym");
    expect(defu({ [sym]: 1 })[sym]).toBe(1);
  });

  // Object.keys() is used to walk the higher-priority object, so symbol keys
  // from anything but the last argument are dropped and defaults win for them.
  it("drops symbol keys of higher-priority arguments when defaults follow", () => {
    const sym = Symbol("sym");
    expect(Object.getOwnPropertySymbols(defu({ [sym]: 1 }, {}))).toEqual([]);
    expect((defu({ [sym]: 1 }, { [sym]: 2 }) as any)[sym]).toBe(2);
  });

  it("ignores non-enumerable properties", () => {
    const object = {};
    Object.defineProperty(object, "hidden", { value: 1, enumerable: false });
    const result = defu(object, { visible: 2 });
    expect(result).toEqual({ visible: 2 });
    expect(Object.getOwnPropertyNames(result)).toEqual(["visible"]);
  });

  it("ignores inherited properties of plain objects", () => {
    const proto = Object.create(null);
    proto.inherited = "from-proto";
    const object = Object.create(proto);
    object.own = 1;
    const result = defu(object, { inherited: "default" });
    expect(result).toEqual({ inherited: "default", own: 1 });
  });

  it("ignores inherited properties of nested plain objects that are merged", () => {
    const proto = Object.create(null);
    proto.inherited = "from-proto";
    const nested = Object.create(proto);
    nested.own = 1;
    const result = defu({ nested }, { nested: { inherited: "default" } });
    expect(result.nested).toEqual({ inherited: "default", own: 1 });
    expect(Object.keys(result.nested)).toEqual(["inherited", "own"]);
  });

  it("evaluates getters and stores their values as data properties", () => {
    let calls = 0;
    const object = {
      get value() {
        calls++;
        return "computed";
      },
    };
    const result = defu(object, { value: "default" });
    expect(result.value).toBe("computed");
    expect(Object.getOwnPropertyDescriptor(result, "value")).toMatchObject({
      value: "computed",
      writable: true,
      enumerable: true,
    });
    expect(calls).toBeGreaterThan(0);
  });

  it("places default keys first and appends keys only present in the object", () => {
    expect(Object.keys(defu({ c: 1, a: 1 }, { a: 2, b: 2 }))).toEqual(["a", "b", "c"]);
  });
});

describe("defu: prototype pollution protection", () => {
  it("does not pollute Object.prototype via a __proto__ key", () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}}');
    const result = defu(malicious, {});
    expect(({} as any).polluted).toBeUndefined();
    expect((result as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(false);
  });

  it("does not pollute via a nested __proto__ key", () => {
    const malicious = JSON.parse('{"nested": {"__proto__": {"polluted": "yes"}}}');
    const result = defu(malicious, { nested: {} });
    expect(({} as any).polluted).toBeUndefined();
    expect((result.nested as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype);
    expect(Object.keys(result.nested)).toEqual([]);
  });

  it("does not change the prototype of the result for a __proto__ key in a single argument", () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}, "a": 1}');
    const result = defu(malicious);
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as any).polluted).toBeUndefined();
    expect(result.a).toBe(1);
  });

  it("does not change the prototype of the result for a __proto__ key in the defaults", () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}}');
    const result = defu({ a: 1 }, malicious);
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as any).polluted).toBeUndefined();
  });

  it("skips constructor keys from higher-priority arguments", () => {
    const malicious = { constructor: { prototype: { polluted: "yes" } } };
    const result = defu(malicious as any, {});
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(false);
  });

  it("keeps a constructor key that only comes from the defaults", () => {
    const result = defu({}, { constructor: "value" } as any);
    expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(true);
    expect((result as any).constructor).toBe("value");
  });

  it("lets a default constructor key win over a higher-priority one", () => {
    const result = defu({ constructor: "object" } as any, { constructor: "default" } as any);
    expect((result as any).constructor).toBe("default");
  });

  it("does not skip keys that merely contain 'proto' or 'constructor'", () => {
    expect(defu({ proto: 1, __proto: 2, constructors: 3 }, {})).toEqual({
      proto: 1,
      __proto: 2,
      constructors: 3,
    });
  });
});

describe("defu: circular references", () => {
  it("handles a circular reference when the default side has no matching object", () => {
    const circular: any = { name: "root" };
    circular.self = circular;
    const result = defu(circular, { extra: true });
    expect(result.self).toBe(circular);
    expect(result.extra).toBe(true);
  });

  it("recurses infinitely (throws RangeError) when both sides are mutually circular", () => {
    const a: any = {};
    a.self = a;
    const b: any = {};
    b.self = b;
    expect(() => defu(a, b)).toThrow(RangeError);
  });
});
