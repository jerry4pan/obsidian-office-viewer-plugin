import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { inspectDocxPackage } from "../../src/docx/docx-semantic-model";
import { createDocxRendererAdapter } from "../../src/docx/renderer/create-docx-renderer-adapter";

async function fixture(name: string): Promise<ArrayBuffer> {
  const bytes = await readFile(
    path.resolve("tests/fixtures/docx-exploration", name),
  );
  return Uint8Array.from(bytes).buffer;
}

describe("production DOCX renderer", () => {
  it("uses the full-fidelity renderer for ordinary documents", async () => {
    const source = await fixture("body-led-reference.docx");
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(source, signal);
    const container = document.createElement("div");

    const session = await createDocxRendererAdapter().open(source, model, {
      mode: "reading",
      signal,
    });
    session.mount(container);

    expect(session.candidate).toBe("docx-preview");
    expect(session.supportedModes).toEqual(["reading", "layout"]);
    expect(session.paragraphAnchors.size).toBe(model.paragraphs.length);
  });

  it("uses bounded semantic rendering for the stress document", async () => {
    const source = await fixture(
      "performance-stress-5000-paragraphs.docx",
    );
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(source, signal);
    const container = document.createElement("div");

    const session = await createDocxRendererAdapter().open(source, model, {
      mode: "reading",
      signal,
    });
    session.mount(container);

    expect(session.candidate).toBe("bounded-semantic");
    expect(session.supportedModes).toEqual(["reading"]);
    expect(container.querySelectorAll("*").length).toBeLessThanOrEqual(1_200);
  });
});
