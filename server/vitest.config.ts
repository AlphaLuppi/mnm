import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Git operations on Windows in governed-workflows-artifacts tests
    // (clone, init, hash-object) regularly take 5-10 s. Default 5 000 ms
    // vitest timeout is too tight for this package.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
