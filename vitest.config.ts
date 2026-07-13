import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve("tests/obsidian-test-double.ts")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup-dom.ts"]
  }
});
