import { AidenPptxRendererAdapter } from "./aiden-pptx-renderer-adapter";
import type { PptxRendererAdapter } from "./pptx-renderer-adapter";
import type { RendererCandidateConfig } from "./renderer-candidate-config";

export const SELECTED_PPTX_RENDERER: RendererCandidateConfig = {
  id: "aiden",
  packageName: "@aiden0z/pptx-renderer",
  version: "1.2.4",
  label: "@aiden0z/pptx-renderer@1.2.4",
  evidenceId: "aiden-pptx-renderer-1.2.4",
};

export function createSelectedPptxRendererAdapter(): PptxRendererAdapter {
  return new AidenPptxRendererAdapter();
}
