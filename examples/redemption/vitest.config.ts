import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "redemption", include: ["test/**/*.test.ts"] },
});
