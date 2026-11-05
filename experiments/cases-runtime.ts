// Wraps a library's exported functions to measure case coverage.
//   CASES_MODE=record   append every call a test makes: {test, key}
//   CASES_MODE=perturb  for calls whose key was recorded by test $CASES_TEST,
//                       return a wrong result; every other call is untouched
// A call's key is the function name plus a deterministic rendering of its
// arguments, computed before the call.
import { appendFileSync, readFileSync } from "node:fs";
import { inspect } from "node:util";
import { expect } from "vitest";

const mode = process.env.CASES_MODE;
const file = process.env.CASES_FILE ?? "";
const target = process.env.CASES_TEST;
let keys: Set<string> | undefined;

const loadKeys = () =>
  new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((c) => c.test === target)
      .map((c) => c.key),
  );

const render = (args: unknown[]) =>
  inspect(args, { depth: 50, sorted: true, maxArrayLength: Infinity, maxStringLength: Infinity, breakLength: Infinity, getters: false });

// JSON-safe copy when there is one, so derivation scripts can read calls back.
const plain = (x: unknown) => {
  try {
    return JSON.parse(JSON.stringify(x ?? null));
  } catch {
    return null;
  }
};

export function perturb(value: unknown): unknown {
  if (typeof value === "string") return `${value}⁣`;
  if (typeof value === "number") return Number.isNaN(value) ? 0 : value + 1;
  if (typeof value === "boolean") return !value;
  if (typeof value === "bigint") return value + 1n;
  if (value === null || value === undefined) return "perturbed";
  if (Array.isArray(value)) return [...value, "perturbed"];
  if (typeof value === "function") return (...a: unknown[]) => perturb((value as (...x: unknown[]) => unknown)(...a));
  if (typeof value === "object") {
    const copy: Record<PropertyKey, unknown> = { ...(value as object), __perturbed__: true };
    const first = Object.keys(value as object)[0];
    if (first !== undefined) copy[first] = perturb((value as Record<string, unknown>)[first]);
    return copy;
  }
  return "perturbed";
}

// The same function exported under two names stays one function.
const wrappers = new WeakMap<object, unknown>();

export function wrap<T>(name: string, fn: T): T {
  if (typeof fn !== "function") return fn;
  if (wrappers.has(fn)) return wrappers.get(fn) as T;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const key = `${name}${render(args)}`;
    if (mode === "record") {
      const out = fn.apply(this, args);
      const call = { fn: name, args: plain(args), out: plain(out) };
      appendFileSync(file, `${JSON.stringify({ test: expect.getState().currentTestName, key, call })}\n`);
      return out;
    }
    if (mode === "perturb") {
      keys ??= loadKeys();
      if (keys.has(key)) {
        try {
          return perturb(fn.apply(this, args));
        } catch {
          return "perturbed"; // the case expected a throw: return instead
        }
      }
    }
    return fn.apply(this, args);
  };
  Object.assign(wrapped, fn);
  wrappers.set(fn, wrapped);
  return wrapped as T;
}
