import { describe, expect, it } from "vitest";
import { createDiagnosticSummary } from "../src/diagnostic-summary";

describe("diagnostic summary", () => {
  it("serializes only stable content-free fields in deterministic order", () => {
    const summary = createDiagnosticSummary({
      environment: {
        pluginVersion: "0.0.1",
        obsidianVersion: "1.13.1",
        rendererVersion: "1.2.4",
        operatingSystem: "darwin-arm64",
      },
      sourceBytes: 42,
      slideCount: 3,
      lifecyclePhase: "degraded",
      warningCategories: ["unsupported-content", "font-substitution"],
      errorCategory: null,
      timingsMs: { metadata: 10.125, firstReadable: 20.5, lastSlideSwitch: null },
      features: {
        thumbnails: true,
        prefetch: true,
        rememberReadingPosition: false,
        externalOpen: true,
      },
    });

    expect(summary).toBe(`{
  "schemaVersion": 1,
  "pluginVersion": "0.0.1",
  "obsidianVersion": "1.13.1",
  "operatingSystem": "darwin-arm64",
  "rendererVersion": "1.2.4",
  "sourceBytes": 42,
  "slideCount": 3,
  "lifecyclePhase": "degraded",
  "warningCategories": [
    "font-substitution",
    "unsupported-content"
  ],
  "errorCategory": null,
  "timingsMs": {
    "metadata": 10.125,
    "firstReadable": 20.5,
    "lastSlideSwitch": null
  },
  "features": {
    "thumbnails": true,
    "prefetch": true,
    "rememberReadingPosition": false,
    "externalOpen": true
  }
}`);
    expect(summary).not.toMatch(/filename|filepath|author|text|image|url/i);
  });

  it("uses null for unavailable document and timing observations", () => {
    const summary = JSON.parse(createDiagnosticSummary({
      environment: {
        pluginVersion: "0.0.1",
        obsidianVersion: "1.13.1",
        rendererVersion: "1.2.4",
        operatingSystem: "win32-x64",
      },
      sourceBytes: null,
      slideCount: null,
      lifecyclePhase: "error",
      warningCategories: [],
      errorCategory: "malformed",
      timingsMs: { metadata: null, firstReadable: null, lastSlideSwitch: null },
      features: {
        thumbnails: false,
        prefetch: false,
        rememberReadingPosition: true,
        externalOpen: false,
      },
    })) as Record<string, unknown>;

    expect(summary).toMatchObject({
      sourceBytes: null,
      slideCount: null,
      errorCategory: "malformed",
    });
  });
});
