import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function fileSha256(path: string): Promise<string> {
  return sha256(await readFile(path));
}
