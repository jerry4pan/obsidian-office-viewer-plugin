import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { releaseArchivePaths } from "./release-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const releaseRoot = path.join(root, "artifacts", "release");
const pluginRoot = path.join(releaseRoot, "plugin");
const vaultRoot = path.join(releaseRoot, "vault");
const zipPath = path.join(root, "dist", `office-viewer-${manifest.version}.zip`);

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(pluginRoot, { recursive: true });
await mkdir(path.join(vaultRoot, ".obsidian"), { recursive: true });

const zip = await JSZip.loadAsync(await readFile(zipPath));
const archivePaths = Object.keys(zip.files).sort();
const expectedPaths = [...releaseArchivePaths].sort();
if (JSON.stringify(archivePaths) !== JSON.stringify(expectedPaths)) {
  throw new Error(`Unexpected release package entries: ${archivePaths.join(", ")}`);
}
for (const name of releaseArchivePaths) {
  const entry = zip.file(name);
  if (!entry) throw new Error(`Release package is missing ${name}`);
  await writeFile(path.join(pluginRoot, name), await entry.async("nodebuffer"));
}
await cp(
  path.join(root, "tests", "fixtures", "minimal.pptx"),
  path.join(vaultRoot, "minimal.pptx"),
);
process.stdout.write(`${pluginRoot}\n${vaultRoot}\n`);
