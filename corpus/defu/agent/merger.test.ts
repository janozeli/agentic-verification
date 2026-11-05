import { describe, expect, it, vi } from "vitest";
import { createDefu, defu, defuArrayFn, defuFn } from "../src/defu";

describe("createDefu", () => {
  it("sums numbers instead of overriding (README example)", () => {
    const ext = createDefu((obj, key, value) => {
      if (typeof obj[key] === "number" && typeof value === "number") {
        (obj as any)[key] += value;
        return true;
      }
    });
    expect(ext({ cost: 15 }, { cost: 10 })).toEqual({ cost: 25 });
  });

  it("behaves like defu when created without a merger", () => {
    const plain = createDefu();
    const object = { a: { b: 1 }, list: [1], n: null };
    const defaults = { a: { c: 2 }, list: [2], n: 3, extra: "x" };
    expect(plain(object, defaults)).toEqual(defu(object, defaults));
    expect(plain(object, defaults)).toEqual({ a: { b: 1, c: 2 }, list: [1, 2], n: 3, extra: "x" });
  });

  it("returns a new function on every call", () => {
    expect(createDefu()).not.toBe(createDefu());
  });

  it("passes the target object, key, value and namespace to the merger", () => {
    const calls: Array<{ key: string; value: unknown; namespace: string; existing: unknown }> = [];
    const defaults = { a: 1, nested: { b: 2 } };
    const merger = vi.fn((object: any, key: any, value: any, namespace: string) => {
      expect(object).not.toBe(defaults);
      calls.push({ key, value, namespace, existing: object[key] });
    });

    const ext = createDefu(merger);
    const result = ext({ a: 10, nested: { b: 20, c: { d: 1 } } }, defaults);

    expect(result).toEqual({ a: 10, nested: { b: 20, c: { d: 1 } } });
    expect(calls).toEqual([
      { key: "a", value: 10, namespace: "", existing: 1 },
      { key: "nested", value: { b: 20, c: { d: 1 } }, namespace: "", existing: { b: 2 } },
      { key: "b", value: 20, namespace: "nested", existing: 2 },
      { key: "c", value: { d: 1 }, namespace: "nested", existing: undefined },
    ]);
    expect(merger).toHaveBeenCalledTimes(4);
  });

  it("passes the object being built so the merger can write to the result", () => {
    const ext = createDefu((object, key, value) => {
      (object as any)[`${String(key)}Seen`] = value;
    });
    expect(ext({ a: 1 }, { b: 2 })).toEqual({ a: 1, aSeen: 1, b: 2 });
  });

  it("builds dot-separated namespaces for deeply nested keys", () => {
    const namespaces: Record<string, string> = {};
    const ext = createDefu((_object, key, _value, namespace) => {
      namespaces[String(key)] = namespace;
    });
    ext({ a: { b: { c: { d: 1 } } } }, { a: { b: { c: { d: 0 } } } });
    expect(namespaces).toEqual({ a: "", b: "a", c: "a.b", d: "a.b.c" });
  });

  it("does not call the merger for nullish values", () => {
    const merger = vi.fn();
    const ext = createDefu(merger);
    expect(ext({ a: null, b: undefined }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(merger).not.toHaveBeenCalled();
  });

  it("does not call the merger for __proto__ or constructor keys", () => {
    const merger = vi.fn();
    const ext = createDefu(merger);
    ext(JSON.parse('{"__proto__": {"x": 1}, "constructor": 1}'), {});
    expect(merger).not.toHaveBeenCalled();
  });

  it("does not call the merger when only one argument is given", () => {
    const merger = vi.fn(() => true);
    const ext = createDefu(merger);
    expect(ext({ a: 1, b: { c: 2 } })).toEqual({ a: 1, b: { c: 2 } });
    expect(merger).not.toHaveBeenCalled();
  });

  it("calls the merger even when the default does not define the key", () => {
    const merger = vi.fn();
    const ext = createDefu(merger);
    ext({ onlyInObject: 1 }, {});
    expect(merger).toHaveBeenCalledWith(expect.any(Object), "onlyInObject", 1, "");
  });

  it("skips the default merge strategy when the merger returns a truthy value", () => {
    const ext = createDefu((_object, key) => (key === "keepDefault" ? 1 : undefined));
    expect(ext({ keepDefault: "object", other: "object" }, { keepDefault: "default", other: "default" })).toEqual({
      keepDefault: "default",
      other: "object",
    });
  });

  it.each([
    ["true", true],
    ["a non-empty string", "yes"],
    ["a number", 1],
    ["an object", {}],
  ])("treats %s as handled", (_label, returned) => {
    const ext = createDefu(() => returned);
    expect(ext({ a: "object" }, { a: "default" })).toEqual({ a: "default" });
  });

  it.each([
    ["false", false],
    ["undefined", undefined],
    ["null", null],
    ["zero", 0],
    ["an empty string", ""],
  ])("falls back to the default strategy when the merger returns %s", (_label, returned) => {
    const ext = createDefu(() => returned);
    expect(ext({ a: "object", list: [1] }, { a: "default", list: [2] })).toEqual({
      a: "object",
      list: [1, 2],
    });
  });

  it("applies the merger at every reduce step across multiple defaults", () => {
    const sum = createDefu((obj, key, value) => {
      if (typeof obj[key] === "number" && typeof value === "number") {
        (obj as any)[key] += value;
        return true;
      }
    });
    expect(sum({ cost: 1 }, { cost: 2 }, { cost: 3 })).toEqual({ cost: 6 });
  });

  it("applies the merger to nested keys", () => {
    const sum = createDefu((obj, key, value) => {
      if (typeof obj[key] === "number" && typeof value === "number") {
        (obj as any)[key] += value;
        return true;
      }
    });
    expect(sum({ a: { n: 1, m: 1 } }, { a: { n: 2 } })).toEqual({ a: { n: 3, m: 1 } });
  });

  it("can replace arrays instead of concatenating them", () => {
    const replaceArrays = createDefu((obj, key, value) => {
      if (Array.isArray(value)) {
        (obj as any)[key] = value;
        return true;
      }
    });
    expect(replaceArrays({ a: [1], nested: { b: ["x"] } }, { a: [2, 3], nested: { b: ["y"] } })).toEqual({
      a: [1],
      nested: { b: ["x"] },
    });
  });

  it("can use the namespace to customise only specific paths", () => {
    const ext = createDefu((obj, key, value, namespace) => {
      if (namespace === "replace" && Array.isArray(value)) {
        (obj as any)[key] = value;
        return true;
      }
    });
    expect(ext({ replace: { list: [1] }, concat: { list: [1] } }, { replace: { list: [2] }, concat: { list: [2] } })).toEqual({
      replace: { list: [1] },
      concat: { list: [1, 2] },
    });
  });

  it("does not modify the defaults when the merger writes to the target object", () => {
    const defaults = { a: 1, nested: { b: 1 } };
    const ext = createDefu((obj, key) => {
      (obj as any)[key] = "overwritten";
      return true;
    });
    const result = ext({ a: 2, nested: { b: 2 } }, defaults);
    expect(result).toEqual({ a: "overwritten", nested: "overwritten" });
    expect(defaults).toEqual({ a: 1, nested: { b: 1 } });
  });

  it("ignores non-object arguments like defu", () => {
    const merger = vi.fn();
    const ext = createDefu(merger);
    expect(ext({ a: 1 }, null as any, "str" as any, [1, 2] as any, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe("defuFn", () => {
  it("calls user functions with the default value (README example)", () => {
    const result = defuFn(
      {
        ignore: (val: string[]) => val.filter((item) => item !== "dist"),
        count: (count: number) => count + 20,
      },
      {
        ignore: ["node_modules", "dist"],
        count: 10,
      },
    );
    expect(result).toEqual({ ignore: ["node_modules"], count: 30 });
  });

  it("replaces the value with the function's return value", () => {
    const fn = vi.fn((value: string) => `${value}!`);
    const result = defuFn({ greeting: fn }, { greeting: "hello" });
    expect(result).toEqual({ greeting: "hello!" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("hello");
  });

  it("keeps the function as the value when the default is not defined", () => {
    const fn = vi.fn(() => "called");
    expect(defuFn({ fn }, {}).fn).toBe(fn);
    expect(defuFn({ fn }, { fn: undefined }).fn).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps the function when it is the only argument", () => {
    const fn = vi.fn();
    expect(defuFn({ fn }).fn).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  // `null !== undefined`, so a null default counts as defined for defuFn even
  // though defu otherwise treats null and undefined alike.
  it("calls the function with null when the default is null", () => {
    const fn = vi.fn((value: unknown) => `got:${String(value)}`);
    expect(defuFn({ a: fn }, { a: null })).toEqual({ a: "got:null" });
    expect(fn).toHaveBeenCalledWith(null);
  });

  it.each([
    ["zero", 0],
    ["false", false],
    ["an empty string", ""],
    ["an object", { x: 1 }],
    ["an array", [1]],
  ])("calls the function when the default is %s", (_label, defaultValue) => {
    const fn = vi.fn(() => "replaced");
    expect(defuFn({ a: fn }, { a: defaultValue })).toEqual({ a: "replaced" });
    expect(fn).toHaveBeenCalledWith(defaultValue);
  });

  it("does not call functions that only appear in the defaults", () => {
    const fn = vi.fn();
    expect(defuFn({}, { fn }).fn).toBe(fn);
    expect(defuFn({ other: 1 }, { fn }).fn).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("passes the default function to the user function when both are functions", () => {
    const defaultFn = () => "default";
    const userFn = vi.fn((inner: () => string) => () => `wrapped(${inner()})`);
    const result = defuFn({ handler: userFn }, { handler: defaultFn });
    expect(userFn).toHaveBeenCalledWith(defaultFn);
    // The DefuFn type does not model function application, so cast here.
    expect((result.handler as unknown as () => string)()).toBe("wrapped(default)");
  });

  it("stores undefined when the function returns undefined", () => {
    const result = defuFn({ a: () => undefined }, { a: 1 });
    expect(Object.keys(result)).toEqual(["a"]);
    expect(result.a).toBeUndefined();
  });

  it("applies functions to nested values", () => {
    const result = defuFn({ nested: { n: (n: number) => n * 2 } }, { nested: { n: 21, other: true } });
    expect(result).toEqual({ nested: { n: 42, other: true } });
  });

  it("merges non-function values like defu", () => {
    expect(defuFn({ a: [1], b: { c: 1 }, d: null }, { a: [2], b: { e: 2 }, d: "default" })).toEqual({
      a: [1, 2],
      b: { c: 1, e: 2 },
      d: "default",
    });
  });

  it("applies the function to the next argument that defines the key", () => {
    const fn = vi.fn((value: number) => value + 1);
    expect(defuFn({ a: fn }, {}, { a: 10 })).toEqual({ a: 11 });
    expect(fn).toHaveBeenCalledWith(10);
  });

  // Arguments are folded left to right, so the function only sees the first
  // defined default; the returned value is then merged with later defaults.
  it("only applies the function against the first defined default; later defaults merge with its result", () => {
    const fn = vi.fn((list: string[]) => list.filter((item) => item !== "x"));
    const result = defuFn({ list: fn }, { list: ["x", "y"] }, { list: ["x", "z"] });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(["x", "y"]);
    expect(result).toEqual({ list: ["y", "x", "z"] });
  });

  it("does not mutate the defaults", () => {
    const defaults = { list: ["a", "b"], count: 1 };
    defuFn({ list: (l: string[]) => l.slice(1), count: (c: number) => c + 1 }, defaults);
    expect(defaults).toEqual({ list: ["a", "b"], count: 1 });
  });
});

describe("defuArrayFn", () => {
  it("only calls functions for array defaults (README example)", () => {
    const count = () => 20;
    const result = defuArrayFn(
      {
        ignore: (val: string[]) => val.filter((i) => i !== "dist"),
        count,
      },
      {
        ignore: ["node_modules", "dist"],
        count: 10,
      },
    );
    expect(result).toEqual({ ignore: ["node_modules"], count });
    expect(result.count).toBe(count);
  });

  it("calls the function with the default array", () => {
    const fn = vi.fn((list: number[]) => [...list, 3]);
    expect(defuArrayFn({ list: fn }, { list: [1, 2] })).toEqual({ list: [1, 2, 3] });
    expect(fn).toHaveBeenCalledWith([1, 2]);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 10],
    ["a string", "str"],
    ["a plain object", { a: 1 }],
    ["a function", () => "default"],
  ])("keeps the function as the value when the default is %s", (_label, defaultValue) => {
    const fn = vi.fn();
    expect(defuArrayFn({ a: fn }, { a: defaultValue }).a).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps the function when the key is missing from the defaults", () => {
    const fn = vi.fn();
    expect(defuArrayFn({ a: fn }, {}).a).toBe(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls the function for an empty default array", () => {
    const fn = vi.fn(() => ["filled"]);
    expect(defuArrayFn({ a: fn }, { a: [] })).toEqual({ a: ["filled"] });
    expect(fn).toHaveBeenCalledWith([]);
  });

  it("applies functions to nested array defaults", () => {
    const result = defuArrayFn(
      { config: { plugins: (plugins: string[]) => plugins.filter((p) => p !== "b") } },
      { config: { plugins: ["a", "b", "c"], other: 1 } },
    );
    expect(result).toEqual({ config: { plugins: ["a", "c"], other: 1 } });
  });

  it("still concatenates arrays and merges objects for non-function values", () => {
    expect(defuArrayFn({ list: [1], obj: { a: 1 } }, { list: [2], obj: { b: 2 } })).toEqual({
      list: [1, 2],
      obj: { a: 1, b: 2 },
    });
  });

  it("does not mutate the defaults when the function is non-mutating", () => {
    const defaults = { list: [1, 2, 3] };
    expect(defuArrayFn({ list: (l: number[]) => l.filter((n) => n > 1) }, defaults)).toEqual({ list: [2, 3] });
    expect(defaults).toEqual({ list: [1, 2, 3] });
  });

  it("passes the default array by reference (no defensive copy)", () => {
    const list = [1, 2, 3];
    let received: number[] | undefined;
    defuArrayFn(
      {
        list: (l: number[]) => {
          received = l;
          return l;
        },
      },
      { list },
    );
    expect(received).toBe(list);
  });
});
