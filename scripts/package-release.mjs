import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { checkRelease } from "./check-release.mjs";
import { releaseFileSources } from "./release-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixedZipDate = new Date("1980-01-01T00:00:00.000Z");

export async function packageRelease() {
  const { version } = await checkRelease();
  const zip = new JSZip();
  for (const { archivePath, sourcePath } of releaseFileSources) {
    zip.file(archivePath, await readFile(path.join(root, sourcePath)), {
      date: fixedZipDate,
      createFolders: false,
      unixPermissions: 0o100644,
    });
  }
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
  const outputDir = path.join(root, "dist");
  const outputPath = path.join(outputDir, `office-viewer-${version}.zip`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, bytes);
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await packageRelease()}\n`);
}
