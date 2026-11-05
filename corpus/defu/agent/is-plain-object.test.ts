import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { isPlainObject } from "../src/_utils";
import * as utilsNamespace from "../src/_utils";

class Foo {
  value = 1;
}

describe("isPlainObject", () => {
  describe("returns true for", () => {
    it.each([
      ["an empty object literal", {}],
      ["an object literal with properties", { a: 1, b: { c: 2 } }],
      ["new Object()", new Object()],
      ["Object.create(Object.prototype)", Object.create(Object.prototype)],
      ["a null-prototype object", Object.create(null)],
      ["an object whose prototype has a null prototype", Object.create(Object.create(null))],
      ["a JSON-parsed object", JSON.parse('{"a": 1}')],
      ["an object with a Symbol.toStringTag of 'Module'", { [Symbol.toStringTag]: "Module" }],
    ])("%s", (_label, value) => {
      expect(isPlainObject(value)).toBe(true);
    });

    it("an object from another realm", () => {
      expect(isPlainObject(vm.runInNewContext("({ a: 1 })"))).toBe(true);
    });

    it("a module namespace object", () => {
      expect(Object.prototype.toString.call(utilsNamespace)).toBe("[object Module]");
      expect(isPlainObject(utilsNamespace)).toBe(true);
    });
  });

  describe("returns false for", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a number", 1],
      ["NaN", Number.NaN],
      ["a bigint", 1n],
      ["a string", "str"],
      ["a boolean", true],
      ["a symbol", Symbol("s")],
      ["a function", () => {}],
      ["a class", Foo],
      ["an array", []],
      ["a class instance", new Foo()],
      ["a Date", new Date()],
      ["a RegExp", /re/],
      ["a Map", new Map()],
      ["a Set", new Set()],
      ["a WeakMap", new WeakMap()],
      ["a Promise", Promise.resolve()],
      ["an Error", new Error("e")],
      ["a typed array", new Uint8Array(1)],
      ["an ArrayBuffer", new ArrayBuffer(1)],
      ["a boxed number", new Number(1)],
      ["a boxed string", new String("s")],
      ["Math", Math],
      ["JSON", JSON],
      ["an object whose prototype is a plain object", Object.create({})],
      ["an object whose prototype is a class prototype", Object.create(Foo.prototype)],
      ["an object with Symbol.iterator", { [Symbol.iterator]: function* () {} }],
      [
        "a null-prototype object with Symbol.iterator",
        Object.assign(Object.create(null), { [Symbol.iterator]: function* () {} }),
      ],
      ["an object with a custom Symbol.toStringTag", { [Symbol.toStringTag]: "Custom" }],
      [
        "a null-prototype object with a custom Symbol.toStringTag",
        Object.assign(Object.create(null), { [Symbol.toStringTag]: "Custom" }),
      ],
    ])("%s", (_label, value) => {
      expect(isPlainObject(value)).toBe(false);
    });

    it("an arguments object", () => {
      // eslint-disable-next-line prefer-rest-params
      const args = (function () {
        return arguments;
      })();
      expect(isPlainObject(args)).toBe(false);
    });

    it("an array from another realm", () => {
      expect(isPlainObject(vm.runInNewContext("[1, 2]"))).toBe(false);
    });

    it("a class instance from another realm", () => {
      expect(isPlainObject(vm.runInNewContext("new (class Foo {})()"))).toBe(false);
    });

    it("an object that inherits Symbol.iterator from a null-prototype parent", () => {
      const parent = Object.create(null);
      parent[Symbol.iterator] = function* () {};
      expect(isPlainObject(Object.create(parent))).toBe(false);
    });
  });
});
