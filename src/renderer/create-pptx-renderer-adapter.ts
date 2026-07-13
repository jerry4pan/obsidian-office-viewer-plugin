import { AidenPptxRendererAdapter } from "./aiden-pptx-renderer-adapter";
import { PptxPreviewRendererAdapter } from "./pptx-preview-renderer-adapter";
import type { PptxRendererAdapter } from "./pptx-renderer-adapter";
import { PreflightPptxRendererAdapter } from "./preflight-pptx-renderer-adapter";

declare const __PPTX_RENDERER_CANDIDATE__: string;

export type PptxRendererCandidate = "aiden" | "pptx-preview";

export interface PptxRendererMetadata {
  readonly id: PptxRendererCandidate;
  readonly packageName: string;
  readonly version: string;
}

const RENDERER_METADATA: Readonly<
  Record<PptxRendererCandidate, PptxRendererMetadata>
> = {
  aiden: {
    id: "aiden",
    packageName: "@aiden0z/pptx-renderer",
    version: "1.2.4",
  },
  "pptx-preview": {
    id: "pptx-preview",
    packageName: "pptx-preview",
    version: "1.0.7",
  },
};

export function resolvePptxRendererCandidate(
  candidate: string,
): PptxRendererCandidate {
  if (candidate === "aiden" || candidate === "pptx-preview") {
    return candidate;
  }
  throw new Error(`Unsupported PPTX renderer candidate "${candidate}"`);
}

const configuredCandidate =
  typeof __PPTX_RENDERER_CANDIDATE__ === "undefined"
    ? "aiden"
    : __PPTX_RENDERER_CANDIDATE__;

export const BUILD_TIME_PPTX_RENDERER_CANDIDATE =
  resolvePptxRendererCandidate(configuredCandidate);

export function getPptxRendererMetadata(
  candidate: PptxRendererCandidate,
): PptxRendererMetadata {
  return RENDERER_METADATA[candidate];
}

export type PptxRendererAdapterFactory = () => PptxRendererAdapter;

const createBuildTimePptxRendererAdapter: PptxRendererAdapterFactory =
  typeof __PPTX_RENDERER_CANDIDATE__ === "undefined" ||
  __PPTX_RENDERER_CANDIDATE__ === "aiden"
    ? () => new AidenPptxRendererAdapter()
    : () => new PptxPreviewRendererAdapter();

export interface CreatePptxRendererAdapterOptions {
  readonly candidate?: string;
  readonly factories?: Partial<
    Record<PptxRendererCandidate, PptxRendererAdapterFactory>
  >;
}

export function createPptxRendererAdapter(
  options: CreatePptxRendererAdapterOptions = {},
): PptxRendererAdapter {
  const candidate = resolvePptxRendererCandidate(
    options.candidate ?? BUILD_TIME_PPTX_RENDERER_CANDIDATE,
  );
  const factory =
    options.factories?.[candidate] ??
    (candidate === BUILD_TIME_PPTX_RENDERER_CANDIDATE
      ? createBuildTimePptxRendererAdapter
      : undefined);
  if (!factory) {
    throw new Error(
      `PPTX renderer adapter for "${candidate}" is not registered`,
    );
  }
  return new PreflightPptxRendererAdapter(factory());
}
