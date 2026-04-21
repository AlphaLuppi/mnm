import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db",
      "packages/governed-workflows",
      "packages/git-provider",
      "packages/adapters/opencode-local",
      "server",
      "ui",
      "cli",
    ],
  },
});
