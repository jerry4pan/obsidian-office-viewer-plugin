import type { PptxRendererAdapter } from "./pptx-renderer-adapter";
import { PptxPreviewRendererAdapter } from "./pptx-preview-renderer-adapter";
import type { RendererCandidateConfig } from "./renderer-candidate-config";

export const SELECTED_PPTX_RENDERER: RendererCandidateConfig = {
  id: "pptx-preview",
  packageName: "pptx-preview",
  version: "1.0.7",
  label: "pptx-preview@1.0.7",
  evidenceId: "pptx-preview-1.0.7",
};

export function createSelectedPptxRendererAdapter(): PptxRendererAdapter {
  return new PptxPreviewRendererAdapter();
}
