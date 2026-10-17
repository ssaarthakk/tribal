import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  test: {
    include: ["{backend,web}/src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
