import { inspectPptxPackage } from "./pptx-package-preflight";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./pptx-renderer-adapter";

export class PreflightPptxRendererAdapter implements PptxRendererAdapter {
  constructor(private readonly renderer: PptxRendererAdapter) {}

  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession> {
    container.replaceChildren();
    try {
      await inspectPptxPackage(buffer, signal);
      signal.throwIfAborted();
      return await this.renderer.open(buffer, container, signal);
    } catch (error) {
      container.replaceChildren();
      throw error;
    }
  }
}
