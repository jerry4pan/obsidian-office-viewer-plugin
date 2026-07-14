import esbuild from "esbuild";
import process from "node:process";
import path from "node:path";
import rendererCandidates from "./src/renderer/renderer-candidates.json" with {
  type: "json",
};

const production = process.argv[2] === "production";
const rendererCandidate = process.env.PPTX_RENDERER_CANDIDATE ?? "aiden";
const rendererTestAdapter = process.env.PPTX_RENDERER_TEST_ADAPTER;
const outfile = process.env.PPTX_BUNDLE_OUTFILE ?? "main.js";

if (!Object.hasOwn(rendererCandidates, rendererCandidate)) {
  throw new Error(
    `Unsupported PPTX renderer candidate "${rendererCandidate}"`,
  );
}
if (
  rendererTestAdapter !== undefined &&
  rendererTestAdapter !== "degraded-navigation"
) {
  throw new Error(`Unsupported PPTX renderer test adapter "${rendererTestAdapter}"`);
}

const selectedRendererModule = rendererTestAdapter
  ? "tests/support/selected-pptx-renderer-adapter.degraded.ts"
  : `src/renderer/selected-pptx-renderer-adapter.${rendererCandidate}.ts`;

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr"
  ],
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile,
  sourcemap: production ? false : "inline",
  minify: production,
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"'
  },
  plugins: [
    {
      name: "selected-pptx-renderer",
      setup(build) {
        build.onResolve({ filter: /^#selected-pptx-renderer$/ }, () => ({
          path: path.resolve(
            selectedRendererModule,
          ),
        }));
      },
    },
  ],
  logLevel: "info"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
