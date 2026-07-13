import {
  createSelectedPptxRendererAdapter,
  SELECTED_PPTX_RENDERER,
} from "#selected-pptx-renderer";
import type { PptxRendererAdapter } from "./pptx-renderer-adapter";
import { PreflightPptxRendererAdapter } from "./preflight-pptx-renderer-adapter";
import type { PptxRendererCandidate } from "./renderer-candidate-config";
import {
  getRendererCandidateConfig,
  resolveRendererCandidate,
} from "./renderer-candidate-config";

export const BUILD_TIME_PPTX_RENDERER_CANDIDATE = SELECTED_PPTX_RENDERER.id;
export const BUILD_TIME_PPTX_RENDERER_METADATA = SELECTED_PPTX_RENDERER;

export const getPptxRendererMetadata = getRendererCandidateConfig;
export const resolvePptxRendererCandidate = resolveRendererCandidate;

export type PptxRendererAdapterFactory = () => PptxRendererAdapter;

export interface CreatePptxRendererAdapterOptions {
  readonly candidate?: string;
  readonly factories?: Partial<
    Record<PptxRendererCandidate, PptxRendererAdapterFactory>
  >;
}

export function createPptxRendererAdapter(): PptxRendererAdapter {
  return new PreflightPptxRendererAdapter(
    createSelectedPptxRendererAdapter(),
  );
}

export function createPptxRendererAdapterForCandidate(
  options: CreatePptxRendererAdapterOptions = {},
): PptxRendererAdapter {
  const candidate = resolveRendererCandidate(
    options.candidate ?? BUILD_TIME_PPTX_RENDERER_CANDIDATE,
  );
  const factory =
    options.factories?.[candidate] ??
    (candidate === BUILD_TIME_PPTX_RENDERER_CANDIDATE
      ? createSelectedPptxRendererAdapter
      : undefined);
  if (!factory) {
    throw new Error(
      `PPTX renderer adapter for "${candidate}" is not registered`,
    );
  }
  return new PreflightPptxRendererAdapter(factory());
}
