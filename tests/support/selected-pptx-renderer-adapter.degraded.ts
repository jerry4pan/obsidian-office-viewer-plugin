import { AidenPptxRendererAdapter } from "../../src/renderer/aiden-pptx-renderer-adapter";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "../../src/renderer/pptx-renderer-adapter";
import { SELECTED_PPTX_RENDERER } from "../../src/renderer/selected-pptx-renderer-adapter.aiden";

export { SELECTED_PPTX_RENDERER };

class DegradedNavigationTestAdapter implements PptxRendererAdapter {
  private readonly delegate = new AidenPptxRendererAdapter();

  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession> {
    const session = await this.delegate.open(buffer, container, signal);
    return {
      get slideCount() {
        return session.slideCount;
      },
      get slideWidth() {
        return session.slideWidth;
      },
      get slideHeight() {
        return session.slideHeight;
      },
      get capabilities() {
        return session.capabilities;
      },
      renderSlide(index: number): Promise<void> {
        if (index === 1) {
          return Promise.reject(
            new Error("Injected installed-test slide failure"),
          );
        }
        return session.renderSlide(index);
      },
      renderThumbnail(index, thumbnailContainer, thumbnailSignal, width) {
        return session.renderThumbnail!(
          index,
          thumbnailContainer,
          thumbnailSignal,
          width,
        );
      },
      prefetchSlide(index, prefetchSignal): Promise<void> {
        return session.prefetchSlide!(index, prefetchSignal);
      },
      dispose(): void {
        session.dispose();
      },
    };
  }
}

export function createSelectedPptxRendererAdapter(): PptxRendererAdapter {
  return new DegradedNavigationTestAdapter();
}
