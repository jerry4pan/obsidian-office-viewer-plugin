import esbuild from "esbuild";
import process from "node:process";

const production = process.argv[2] === "production";
const rendererCandidate = process.env.PPTX_RENDERER_CANDIDATE ?? "aiden";

if (rendererCandidate !== "aiden" && rendererCandidate !== "pptx-preview") {
  throw new Error(
    `Unsupported PPTX renderer candidate "${rendererCandidate}"`,
  );
}

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
  outfile: "main.js",
  sourcemap: production ? false : "inline",
  minify: production,
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"',
    "__PPTX_RENDERER_CANDIDATE__": JSON.stringify(rendererCandidate)
  },
  logLevel: "info"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
