import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PreflightPptxRendererAdapter } from "../../src/renderer/preflight-pptx-renderer-adapter";
import type { PptxRendererAdapter } from "../../src/renderer/pptx-renderer-adapter";
import {
  expectedFailureFixtures,
  fixturePath,
} from "../failure/failure-fixtures";

async function loadFixture(id: string): Promise<ArrayBuffer> {
  const fixture = expectedFailureFixtures.find((entry) => entry.id === id)!;
  const bytes = await readFile(path.resolve(fixturePath(fixture)));
  return Uint8Array.from(bytes).buffer;
}

describe("PreflightPptxRendererAdapter", () => {
  it("blocks active content before invoking a candidate renderer", async () => {
    const candidate: PptxRendererAdapter = { open: vi.fn() };

    await expect(
      new PreflightPptxRendererAdapter(candidate).open(
        await loadFixture("active-content"),
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "incompatible" });
    expect(candidate.open).not.toHaveBeenCalled();
  });

  it("blocks the shared single-entry limit before invoking a candidate", async () => {
    const candidate: PptxRendererAdapter = {
      open: vi.fn(),
    };

    await expect(
      new PreflightPptxRendererAdapter(candidate).open(
        await loadFixture("renderer-resource-limit"),
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "incompatible" });
    expect(candidate.open).not.toHaveBeenCalled();
  });
});
