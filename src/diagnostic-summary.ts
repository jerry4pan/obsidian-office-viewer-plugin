import type { PptxOpenErrorCategory } from "./pptx-open-error";
import type { PptxCompatibilityWarningCategory } from "./renderer/pptx-renderer-adapter";

export interface DiagnosticEnvironment {
  readonly pluginVersion: string;
  readonly obsidianVersion: string;
  readonly rendererVersion: string;
  readonly operatingSystem: string;
}

export interface DiagnosticSummaryInput {
  readonly environment: DiagnosticEnvironment;
  readonly sourceBytes: number | null;
  readonly slideCount: number | null;
  readonly lifecyclePhase: string;
  readonly warningCategories: readonly PptxCompatibilityWarningCategory[];
  readonly errorCategory: PptxOpenErrorCategory | null;
  readonly timingsMs: {
    readonly metadata: number | null;
    readonly firstReadable: number | null;
    readonly lastSlideSwitch: number | null;
  };
  readonly features: {
    readonly thumbnails: boolean;
    readonly prefetch: boolean;
    readonly rememberReadingPosition: boolean;
    readonly externalOpen: boolean;
  };
}

export function createDiagnosticSummary(input: DiagnosticSummaryInput): string {
  return JSON.stringify({
    schemaVersion: 1,
    pluginVersion: input.environment.pluginVersion,
    obsidianVersion: input.environment.obsidianVersion,
    operatingSystem: input.environment.operatingSystem,
    rendererVersion: input.environment.rendererVersion,
    sourceBytes: input.sourceBytes,
    slideCount: input.slideCount,
    lifecyclePhase: input.lifecyclePhase,
    warningCategories: [...new Set(input.warningCategories)].sort(),
    errorCategory: input.errorCategory,
    timingsMs: input.timingsMs,
    features: input.features,
  }, null, 2);
}
