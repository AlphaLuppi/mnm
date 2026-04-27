import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Git operations on Windows (clone, push, init) regularly take 10-15 s.
    // The default 5 000 ms vitest timeout is too tight for this package.
    testTimeout: 60_000,
  },
});
