import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";

const execFileAsync = promisify(execFile);

const MANIFEST = JSON.parse(
  await readFile("manifest.json", "utf-8"),
) as { version: string };

const VERSION = MANIFEST.version;

describe("release artifacts", () => {
  it("accepts synchronized package, manifest, versions, and required files", async () => {
    await expect(
      execFileAsync(process.execPath, ["scripts/check-release.mjs"]),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining(`office-viewer v${VERSION}`),
    });
  });

  it("rejects a tag that does not match the manifest version", async () => {
    await expect(
      execFileAsync(process.execPath, ["scripts/check-release.mjs"], {
        env: { ...process.env, RELEASE_TAG: "v9.9.9" },
      }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining("does not match") });
  });

  it("builds a byte-identical package with exactly the Obsidian release files", async () => {
    const run = async () => {
      const { stdout } = await execFileAsync(
        process.execPath,
        ["scripts/package-release.mjs"],
      );
      const bytes = await readFile(stdout.trim());
      return {
        bytes,
        hash: createHash("sha256").update(bytes).digest("hex"),
      };
    };

    const first = await run();
    const second = await run();
    expect(second.hash).toBe(first.hash);

    const zip = await JSZip.loadAsync(first.bytes);
    expect(Object.keys(zip.files).sort()).toEqual([
      "AIDEN-PPTX-RENDERER-LICENSE",
      "LICENSE",
      "NOTICE",
      "main.js",
      "manifest.json",
      "styles.css",
    ]);
    await expect(
      zip.file("AIDEN-PPTX-RENDERER-LICENSE")!.async("text"),
    ).resolves.toContain("Apache License");
    const packagedManifest = JSON.parse(
      await zip.file("manifest.json")!.async("text"),
    ) as { version: string };
    expect(packagedManifest.version).toBe(VERSION);
  });
});
