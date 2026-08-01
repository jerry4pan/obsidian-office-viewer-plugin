import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "svg-as-dataurl",
      enforce: "pre",
      load(id) {
        const filePath = id.split("?")[0] ?? id;
        if (!filePath.endsWith(".svg")) return null;
        const source = fs.readFileSync(filePath, "utf8");
        const dataUrl =
          `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
        return `export default ${JSON.stringify(dataUrl)};`;
      },
    },
  ],
  resolve: {
    alias: {
      obsidian: path.resolve("tests/obsidian-test-double.ts"),
      "#selected-pptx-renderer": path.resolve(
        "src/renderer/selected-pptx-renderer-adapter.aiden.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["node_modules/**", ".worktrees/**"],
    globals: true,
    setupFiles: ["tests/setup-dom.ts"],
  },
});
