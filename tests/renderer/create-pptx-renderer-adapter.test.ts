import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BUILD_TIME_PPTX_RENDERER_CANDIDATE,
  createPptxRendererAdapter,
  getPptxRendererMetadata,
  resolvePptxRendererCandidate,
} from "../../src/renderer/create-pptx-renderer-adapter";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "../../src/renderer/pptx-renderer-adapter";

async function loadFixture(pathname: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve(pathname));
  return Uint8Array.from(bytes).buffer;
}

function createSession(): PptxRendererSession {
  return {
    slideCount: 1,
    renderSlide: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

describe("PPTX renderer composition root", () => {
  it("publishes exact package metadata for both screened candidates", () => {
    expect(getPptxRendererMetadata("aiden")).toEqual({
      id: "aiden",
      packageName: "@aiden0z/pptx-renderer",
      version: "1.2.4",
    });
    expect(getPptxRendererMetadata("pptx-preview")).toEqual({
      id: "pptx-preview",
      packageName: "pptx-preview",
      version: "1.0.7",
    });
    expect(BUILD_TIME_PPTX_RENDERER_CANDIDATE).toBe("aiden");
  });

  it("selects an injected candidate factory without changing the adapter contract", async () => {
    const session = createSession();
    const candidate: PptxRendererAdapter = {
      open: vi.fn(async () => session),
    };
    const createCandidate = vi.fn(() => candidate);
    const adapter = createPptxRendererAdapter({
      candidate: "pptx-preview",
      factories: { "pptx-preview": createCandidate },
    });
    const buffer = await loadFixture("tests/fixtures/minimal.pptx");
    const container = document.createElement("div");
    const signal = new AbortController().signal;

    await expect(adapter.open(buffer, container, signal)).resolves.toBe(session);
    expect(createCandidate).toHaveBeenCalledOnce();
    expect(candidate.open).toHaveBeenCalledWith(buffer, container, signal);
  });

  it("applies the shared package preflight before the selected candidate", async () => {
    const candidate: PptxRendererAdapter = { open: vi.fn() };
    const adapter = createPptxRendererAdapter({
      candidate: "pptx-preview",
      factories: { "pptx-preview": () => candidate },
    });

    await expect(
      adapter.open(
        await loadFixture("tests/fixtures/failure/active-content.pptx"),
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "incompatible" });
    expect(candidate.open).not.toHaveBeenCalled();
  });

  it("rejects an unknown build-time candidate instead of silently falling back", () => {
    expect(() => resolvePptxRendererCandidate("unknown-renderer")).toThrow(
      'Unsupported PPTX renderer candidate "unknown-renderer"',
    );
  });
});
