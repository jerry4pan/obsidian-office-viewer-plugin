import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getRendererCandidateConfig,
  resolveRendererCandidate,
} from "../../src/renderer/renderer-candidate-config";

describe("renderer candidate acceptance configuration", () => {
  it("keeps candidate identity and evidence paths separate without changing gates", () => {
    expect(getRendererCandidateConfig("aiden")).toEqual({
      id: "aiden",
      packageName: "@aiden0z/pptx-renderer",
      version: "1.2.4",
      label: "@aiden0z/pptx-renderer@1.2.4",
      evidenceId: "aiden-pptx-renderer-1.2.4",
    });
    expect(getRendererCandidateConfig("pptx-preview")).toEqual({
      id: "pptx-preview",
      packageName: "pptx-preview",
      version: "1.0.7",
      label: "pptx-preview@1.0.7",
      evidenceId: "pptx-preview-1.0.7",
    });
  });

  it("defaults to Aiden and rejects unknown candidates", () => {
    expect(resolveRendererCandidate(undefined)).toBe("aiden");
    expect(() => resolveRendererCandidate("unknown")).toThrow(
      'Unsupported PPTX renderer candidate "unknown"',
    );
  });

  it("binds both build adapter modules to the canonical candidate manifest", async () => {
    const [aiden, preview] = await Promise.all([
      import("../../src/renderer/selected-pptx-renderer-adapter.aiden"),
      import("../../src/renderer/selected-pptx-renderer-adapter.pptx-preview"),
    ]);

    expect(aiden.SELECTED_PPTX_RENDERER).toEqual(
      getRendererCandidateConfig("aiden"),
    );
    expect(preview.SELECTED_PPTX_RENDERER).toEqual(
      getRendererCandidateConfig("pptx-preview"),
    );
  });

  it("provides candidate-specific compatibility and performance directories", async () => {
    const { acceptancePathsForCandidate } = await import(
      "../support/renderer-candidate"
    );

    expect(acceptancePathsForCandidate("aiden")).toEqual({
      compatibilityArtifactDir: path.resolve(
        "artifacts/compatibility/aiden-pptx-renderer-1.2.4",
      ),
      compatibilityBaselineDir: path.resolve(
        "tests/compatibility/baselines/aiden-pptx-renderer-1.2.4",
      ),
      performanceArtifactDir: path.resolve(
        "artifacts/performance/aiden-pptx-renderer-1.2.4-2026-07-19",
      ),
    });
    expect(acceptancePathsForCandidate("pptx-preview")).toEqual({
      compatibilityArtifactDir: path.resolve(
        "artifacts/compatibility/pptx-preview-1.0.7",
      ),
      compatibilityBaselineDir: path.resolve(
        "tests/compatibility/baselines/pptx-preview-1.0.7",
      ),
      performanceArtifactDir: path.resolve(
        "artifacts/performance/pptx-preview-1.0.7",
      ),
    });
  });

  it("exposes the same installed acceptance commands for both candidates", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const task of ["build", "test:e2e", "test:compatibility", "test:performance"]) {
      expect(packageJson.scripts[`${task}:aiden`]).toContain(
        `aiden ${task}`,
      );
      expect(packageJson.scripts[`${task}:pptx-preview`]).toContain(
        `pptx-preview ${task}`,
      );
    }
  });
});
