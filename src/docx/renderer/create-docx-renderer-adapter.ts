import { BoundedDocxRendererAdapter } from "./bounded-docx-renderer-adapter";
import { DocxPreviewRendererAdapter } from "./docx-preview-renderer-adapter";

export interface CreateDocxRendererOptions {
  readonly unavailablePlaceholder?: string;
}

export function createDocxRendererAdapter(
  options: CreateDocxRendererOptions = {},
): BoundedDocxRendererAdapter {
  return new BoundedDocxRendererAdapter(
    new DocxPreviewRendererAdapter(),
    {
      largeParagraphThreshold: 1_000,
      windowSize: 240,
      unavailablePlaceholder: options.unavailablePlaceholder,
    },
  );
}
