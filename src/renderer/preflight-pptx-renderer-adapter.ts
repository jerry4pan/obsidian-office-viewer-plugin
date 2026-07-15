import { inspectPptxPackage } from "./pptx-package-preflight";
import type {
  PptxCompatibilityWarningCategory,
  PptxRendererAdapter,
  PptxRendererSession,
} from "./pptx-renderer-adapter";

function withCompatibilityWarnings(
  session: PptxRendererSession,
  compatibilityWarnings: readonly PptxCompatibilityWarningCategory[],
  detectCompatibilityWarnings: () => readonly PptxCompatibilityWarningCategory[],
): PptxRendererSession {
  const inspected: PptxRendererSession = {
    slideCount: session.slideCount,
    slideWidth: session.slideWidth,
    slideHeight: session.slideHeight,
    capabilities: session.capabilities,
    compatibilityWarnings,
    detectCompatibilityWarnings,
    renderSlide: (index) => session.renderSlide(index),
    dispose: () => session.dispose(),
  };
  if (session.renderThumbnail) {
    inspected.renderThumbnail = (index, container, signal, width) =>
      session.renderThumbnail!(index, container, signal, width);
  }
  if (session.prefetchSlide) {
    inspected.prefetchSlide = (index, signal) =>
      session.prefetchSlide!(index, signal);
  }
  return inspected;
}

const fontAvailability = new Map<string, boolean>();

function measureFontAvailability(font: string): boolean | null {
  if (!document.body) return null;
  const sample = "mmmmmmmmmwwwwwiiiii0123456789";
  const family = font.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const probe = document.createElement("span");
  probe.textContent = sample;
  probe.style.cssText =
    "font-size:72px;position:absolute;visibility:hidden;white-space:nowrap;";
  document.body.append(probe);
  try {
    const fallbacks = ["monospace", "sans-serif", "serif"];
    const baseWidths = fallbacks.map((fallback) => {
      probe.style.fontFamily = fallback;
      return probe.offsetWidth;
    });
    if (baseWidths.every((width) => width === 0)) return null;
    return fallbacks.some((fallback, index) => {
      probe.style.fontFamily = `"${family}", ${fallback}`;
      return probe.offsetWidth !== baseWidths[index];
    });
  } finally {
    probe.remove();
  }
}

function missingDeclaredFont(declaredFonts: readonly string[]): boolean {
  return declaredFonts.some((font) => {
    const cached = fontAvailability.get(font);
    if (cached !== undefined) return !cached;
    const available = measureFontAvailability(font);
    if (available === null) return false;
    fontAvailability.set(font, available);
    return !available;
  });
}

export class PreflightPptxRendererAdapter implements PptxRendererAdapter {
  constructor(private readonly renderer: PptxRendererAdapter) {}

  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession> {
    container.replaceChildren();
    try {
      const inspection = await inspectPptxPackage(buffer, signal);
      signal.throwIfAborted();
      const session = await this.renderer.open(buffer, container, signal);
      return withCompatibilityWarnings(
        session,
        inspection.warningCategories,
        () => {
          const warnings = new Set(inspection.warningCategories);
          if (missingDeclaredFont(inspection.declaredFonts)) {
            warnings.add("font-substitution");
          }
          return [...warnings].sort();
        },
      );
    } catch (error) {
      container.replaceChildren();
      throw error;
    }
  }
}
