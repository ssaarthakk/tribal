import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{backend,web}/src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});
