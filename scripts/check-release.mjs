import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { releaseFileSources } from "./release-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "main.js",
  "manifest.json",
  "styles.css",
  "README.md",
  "LICENSE",
  "NOTICE",
  "PRIVACY.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "release-contract.json",
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function checkRelease({ releaseTag = process.env.RELEASE_TAG } = {}) {
  const [packageJson, manifest, versions, releaseContract] = await Promise.all([
    readJson("package.json"),
    readJson("manifest.json"),
    readJson("versions.json"),
    readJson("release-contract.json"),
  ]);
  const errors = [];
  if (packageJson.version !== manifest.version) {
    errors.push("package.json and manifest.json versions differ");
  }
  if (versions[manifest.version] !== manifest.minAppVersion) {
    errors.push("versions.json does not map the current version to minAppVersion");
  }
  if (manifest.id !== "office-viewer") errors.push("manifest id must be office-viewer");
  if (manifest.isDesktopOnly !== true) errors.push("manifest must remain desktop-only");
  if (
    JSON.stringify(releaseContract.supportedExtensions) !==
    JSON.stringify(["pptx", "ppt"])
  ) {
    errors.push("release contract must declare pptx and legacy ppt routing");
  }
  if (
    releaseTag &&
    releaseTag !== manifest.version &&
    releaseTag !== `v${manifest.version}`
  ) {
    errors.push(
      `release tag ${releaseTag} does not match ${manifest.version} or v${manifest.version}`,
    );
  }
  for (const relativePath of requiredFiles) {
    try {
      await access(path.join(root, relativePath));
    } catch {
      errors.push(`required release file is missing: ${relativePath}`);
    }
  }
  for (const { sourcePath } of releaseFileSources) {
    try {
      await access(path.join(root, sourcePath));
    } catch {
      errors.push(`release package source is missing: ${sourcePath}`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { id: manifest.id, version: manifest.version, requiredFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkRelease();
  process.stdout.write(`Release metadata valid for ${result.id} v${result.version}.\n`);
}
