import { suite } from "./vitest.shared";

// The Lean model as an external-process oracle.
export default suite("coupon:lean", "test-lean/**/*.test.ts");
