import { rename, writeFile } from "node:fs/promises";
import { stringifyJsonEvidence } from "./installed-performance-analysis";

export async function writePerformanceProgressAtomic(
  targetPath: string,
  progress: unknown,
): Promise<void> {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    `${stringifyJsonEvidence(progress, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, targetPath);
}
