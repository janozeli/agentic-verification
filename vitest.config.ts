import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "tool", include: ["test/**/*.test.ts"] } },
      "examples/coupon/vitest.config.ts",
      "examples/coupon/vitest.props.config.ts",
      "examples/coupon/vitest.lean.config.ts",
      "examples/redemption/vitest.config.ts",
    ],
  },
});
