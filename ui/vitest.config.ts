import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirror the `@/` alias from vite.config.ts so tests that transitively load
  // components (which use `@/components/...`) resolve correctly under vitest.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
  },
});
