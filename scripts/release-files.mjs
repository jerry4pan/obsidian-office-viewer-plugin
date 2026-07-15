export const releaseFileSources = Object.freeze([
  { archivePath: "main.js", sourcePath: "main.js" },
  { archivePath: "manifest.json", sourcePath: "manifest.json" },
  { archivePath: "styles.css", sourcePath: "styles.css" },
  { archivePath: "LICENSE", sourcePath: "LICENSE" },
  { archivePath: "NOTICE", sourcePath: "NOTICE" },
  {
    archivePath: "AIDEN-PPTX-RENDERER-LICENSE",
    sourcePath: "node_modules/@aiden0z/pptx-renderer/LICENSE",
  },
]);

export const releaseArchivePaths = Object.freeze(
  releaseFileSources.map(({ archivePath }) => archivePath),
);
