// Type-level tests. The runtime assertions run under `vitest run`; the
// `expectTypeOf` assertions are only enforced by the TypeScript compiler
// (e.g. `vitest --typecheck` or `tsc --noEmit`).
import { describe, expect, expectTypeOf, it } from "vitest";
import { createDefu, defu, defuArrayFn, defuFn } from "../src/defu";
import type { Defu, DefuFn, DefuInstance } from "../src/defu";
import type { Merger } from "../src/types";

describe("Defu type utility", () => {
  it("merges a list of defaults (README example)", () => {
    type Options = Defu<{ foo: "bar" }, [{}, { bar: "baz" }, { something: 42 }]>;
    expectTypeOf<Options>().toExtend<{ foo: "bar"; bar: "baz"; something: 42 }>();
    expectTypeOf<{ foo: "bar"; bar: "baz"; something: 42 }>().toExtend<Options>();
  });

  it("skips ignored inputs in the defaults list", () => {
    type Result = Defu<{ a: string }, [null, undefined, false, 0, { b: number }]>;
    expectTypeOf<Result>().toExtend<{ a: string; b: number }>();
    expectTypeOf<{ a: string; b: number }>().toExtend<Result>();
  });

  it("returns the source type unchanged when there are no defaults", () => {
    expectTypeOf<Defu<{ a: 1 }, []>>().toEqualTypeOf<{ a: 1 }>();
  });

  it("drops nullish from a key when the default is non-nullish", () => {
    type Result = Defu<{ a: string | undefined }, [{ a: string }]>;
    expectTypeOf<Result["a"]>().toEqualTypeOf<string>();
  });

  it("uses the default type when the source key is nullish", () => {
    type Result = Defu<{ a: null }, [{ a: number }]>;
    expectTypeOf<Result["a"]>().toEqualTypeOf<number>();
  });

  it("merges array element types", () => {
    type Result = Defu<{ list: string[] }, [{ list: number[] }]>;
    expectTypeOf<Result["list"]>().toEqualTypeOf<Array<string | number>>();
  });

  it("merges nested object types", () => {
    type Result = Defu<{ nested: { a: string } }, [{ nested: { b: number } }]>;
    expectTypeOf<Result["nested"]>().toExtend<{ a: string; b: number }>();
    expectTypeOf<{ a: string; b: number }>().toExtend<Result["nested"]>();
  });
});

describe("function signatures", () => {
  it("infers the merged type from defu arguments", () => {
    const result = defu({ a: 1 }, { b: "two" }, { c: true });
    expect(result).toEqual({ a: 1, b: "two", c: true });
    expectTypeOf(result.a).toEqualTypeOf<number>();
    expectTypeOf(result.b).toEqualTypeOf<string>();
    expectTypeOf(result.c).toEqualTypeOf<boolean>();
  });

  it("infers nested merged types", () => {
    const result = defu({ nested: { a: 1 } }, { nested: { b: "x" } });
    expect(result.nested).toEqual({ a: 1, b: "x" });
    expectTypeOf(result.nested.a).toEqualTypeOf<number>();
    expectTypeOf(result.nested.b).toEqualTypeOf<string>();
  });

  it("types defu as DefuInstance and the variants as DefuFn", () => {
    expectTypeOf(defu).toEqualTypeOf<DefuInstance>();
    expectTypeOf(defuFn).toEqualTypeOf<DefuFn>();
    expectTypeOf(defuArrayFn).toEqualTypeOf<DefuFn>();
    expectTypeOf(createDefu).parameter(0).toEqualTypeOf<Merger | undefined>();
    expectTypeOf(createDefu()).toEqualTypeOf<DefuFn>();
    expect(typeof createDefu()).toBe("function");
  });

  // When the source is an ignored input, `Source` falls back to the `Input`
  // record type, so property types degrade to `any`.
  it("accepts ignored inputs as the source of defu (properties are typed as any)", () => {
    const result = defu(null, { a: 1 });
    expect(result).toEqual({ a: 1 });
    expectTypeOf(result.a).toBeAny();
  });
});
