import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function build(candidate: string): { source: string; bytes: number } {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pptx-bundle-test-"));
  const outfile = path.join(directory, `${candidate}.js`);
  const result = spawnSync(process.execPath, ["esbuild.config.mjs", "production"], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: {
      ...process.env,
      PPTX_BUNDLE_OUTFILE: outfile,
      PPTX_RENDERER_CANDIDATE: candidate,
    },
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  const resultBundle = {
    source: readFileSync(outfile, "utf8"),
    bytes: statSync(outfile).size,
  };
  rmSync(directory, { recursive: true, force: true });
  return resultBundle;
}

describe("single-candidate production bundle", () => {
  it("includes only the selected renderer implementation", () => {
    const previewBundle = build("pptx-preview");
    expect(previewBundle.bytes).toBeGreaterThan(0);
    expect(Buffer.byteLength(previewBundle.source)).toBe(previewBundle.bytes);
    expect(previewBundle.source).toContain("pptx-preview-slide-wrapper");
    expect(previewBundle.source).not.toContain("data-pptx-background-gradient");

    const aidenBundle = build("aiden");
    expect(aidenBundle.bytes).toBeGreaterThan(0);
    expect(Buffer.byteLength(aidenBundle.source)).toBe(aidenBundle.bytes);
    expect(aidenBundle.bytes).not.toBe(previewBundle.bytes);
    expect(aidenBundle.source).toContain("data-pptx-background-gradient");
    expect(aidenBundle.source).not.toContain("pptx-preview");
    expect(aidenBundle.source).not.toContain("pptx-preview-slide-wrapper");
  });

  it("hard-fails an unknown candidate", () => {
    const result = spawnSync(process.execPath, ["esbuild.config.mjs", "production"], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: { ...process.env, PPTX_RENDERER_CANDIDATE: "unknown" },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Unsupported PPTX renderer candidate "unknown"',
    );
  });
});
