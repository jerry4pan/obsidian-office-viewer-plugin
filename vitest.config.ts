import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve("tests/obsidian-test-double.ts"),
      "#selected-pptx-renderer": path.resolve(
        "src/renderer/selected-pptx-renderer-adapter.aiden.ts",
      ),
    }
  },
  test: {
    environment: "jsdom",
    exclude: ["node_modules/**", ".worktrees/**"],
    globals: true,
    setupFiles: ["tests/setup-dom.ts"]
  }
});
