import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// IMPL swaps the implementation under test, e.g. IMPL=mutants/rounds-up.ts.
// Used to run a suite against semantic mutants.
export const suite = (name: string, include: string) => {
  const impl = process.env.IMPL;
  return defineConfig({
    test: { name, include: [include] },
    resolve: impl
      ? { alias: [{ find: /^\.\.\/src\/coupon$/, replacement: resolve(impl) }] }
      : undefined,
  });
};
