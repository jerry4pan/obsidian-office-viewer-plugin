import {
  MarkdownRenderChild,
  TFile,
  type App,
  type MarkdownPostProcessorContext,
} from "obsidian";
import type { MessageKey, MessageTranslator } from "./i18n";
import {
  PptxOpenError,
  type PptxOpenErrorCategory,
} from "./pptx-open-error";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";
import {
  formatSlideReferenceFragment,
  parseSlideReferenceLink,
  type SlideReferenceTarget,
} from "./slide-reference";
import { SlideEmbedScheduler } from "./slide-embed-scheduler";

export interface PptxSlideEmbedOptions {
  readonly app: App;
  readonly renderer: PptxRendererAdapter;
  readonly scheduler: SlideEmbedScheduler;
  readonly messages: MessageTranslator;
  readonly showDiagnostics: () => boolean;
  readonly openExternally?: (file: TFile) => Promise<void>;
  readonly lifecycle?: {
    register(child: MarkdownRenderChild): void;
    unregister(child: MarkdownRenderChild): void;
  };
}

class StaticPptxSlideEmbedChild extends MarkdownRenderChild {
  private observer: MutationObserver | null = null;

  constructor(
    container: HTMLElement,
    private readonly nativeEmbed: HTMLElement | null,
    private readonly lifecycle?: PptxSlideEmbedOptions["lifecycle"],
  ) {
    super(container);
  }

  override onload(): void {
    this.hideNativeEmbed();
    if (this.containerEl.parentElement !== null && this.nativeEmbed !== null) {
      this.observer = new MutationObserver(() => this.hideNativeEmbed());
      this.observer.observe(this.containerEl.parentElement, { childList: true });
    }
  }

  override onunload(): void {
    this.observer?.disconnect();
    this.observer = null;
    const candidate = this.containerEl.previousElementSibling;
    if (candidate instanceof HTMLElement && candidate.matches(".internal-embed[src]")) {
      candidate.hidden = false;
      candidate.classList.remove("pptx-slide-embed__native");
    }
    this.lifecycle?.unregister(this);
    this.containerEl.remove();
  }

  private hideNativeEmbed(): void {
    const candidate = this.containerEl.previousElementSibling;
    if (candidate instanceof HTMLElement && candidate.matches(".internal-embed[src]")) {
      candidate.hidden = true;
      candidate.classList.add("pptx-slide-embed__native");
    }
  }
}

const errorMessageKeys: Record<PptxOpenErrorCategory, MessageKey> = {
  "unsupported-legacy": "error.unsupportedLegacy",
  malformed: "error.malformed",
  protected: "error.protected",
  incompatible: "error.incompatible",
  "resource-exhausted": "error.resourceExhausted",
  cancelled: "error.cancelled",
  unknown: "error.unknown",
};

function errorMessage(
  messages: MessageTranslator,
  error: unknown,
): string {
  if (error instanceof PptxOpenError) {
    return messages.text(errorMessageKeys[error.category]);
  }
  return messages.text("embed.renderFailure");
}

class PptxSlideEmbedChild extends MarkdownRenderChild {
  private readonly canvas: HTMLElement;
  private readonly status: HTMLElement;
  private readonly compatibility: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private nativeObserver: MutationObserver | null = null;
  private cancelScheduled: (() => void) | null = null;
  private rendererSession: PptxRendererSession | null = null;
  private generation = 0;

  constructor(
    container: HTMLElement,
    private readonly file: TFile,
    private readonly target: SlideReferenceTarget,
    private readonly sourcePath: string,
    private readonly options: PptxSlideEmbedOptions,
    private readonly nativeEmbed: HTMLElement | null = null,
  ) {
    super(container);
    container.replaceChildren();
    container.classList.add("pptx-slide-embed");
    container.dataset.state = "waiting";
    container.dataset.sourcePath = sourcePath;
    container.dataset.slideId = String(target.slideId);
    container.dataset.createdSlide = String(target.createdSlideNumber);
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", options.messages.text("embed.loading"));
    this.status = container.createDiv({
      cls: "pptx-slide-embed__status",
      text: options.messages.text("embed.loading"),
      attr: { role: "status", "aria-live": "polite" },
    });
    this.canvas = container.createDiv({ cls: "pptx-slide-embed__canvas" });
    this.compatibility = container.createDiv({
      cls: "pptx-slide-embed__compatibility",
      attr: { role: "note" },
    });
    const footer = container.createDiv({ cls: "pptx-slide-embed__footer" });
    const sourceLink = footer.createEl("a", {
      cls: "internal-link",
      text: options.messages.text("reference.openPresentation"),
      href: `${sourcePath}${formatSlideReferenceFragment(target)}`,
    });
    sourceLink.dataset.href = `${sourcePath}${formatSlideReferenceFragment(target)}`;
    if (options.openExternally !== undefined) {
      const externalButton = footer.createEl("button", {
        type: "button",
        text: options.messages.text("external.open"),
        attr: { "data-action": "open-externally" },
      });
      const externalStatus = footer.createSpan({
        cls: "pptx-slide-embed__external-status",
        attr: { role: "status", "aria-live": "polite" },
      });
      externalButton.addEventListener("click", () => {
        externalStatus.textContent = "";
        void options.openExternally!(file).catch(() => {
          externalStatus.textContent = options.messages.text("external.failure");
        });
      });
    }
  }

  override onload(): void {
    this.hideNativeEmbed();
    if (this.containerEl.parentElement !== null && this.nativeEmbed !== null) {
      this.nativeObserver = new MutationObserver(() => this.hideNativeEmbed());
      this.nativeObserver.observe(this.containerEl.parentElement, { childList: true });
    }
    if (typeof IntersectionObserver === "undefined") {
      this.startRendering();
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible) this.startRendering();
      else this.releaseRenderingWindow();
    }, { rootMargin: "600px 0px" });
    this.observer.observe(this.containerEl);
  }

  override onunload(): void {
    this.nativeObserver?.disconnect();
    this.nativeObserver = null;
    this.restoreNativeEmbed();
    this.observer?.disconnect();
    this.observer = null;
    this.releaseRenderingWindow();
    this.options.lifecycle?.unregister(this);
    this.containerEl.remove();
  }

  private hideNativeEmbed(): void {
    const candidate = this.containerEl.previousElementSibling;
    if (candidate instanceof HTMLElement && candidate.matches(".internal-embed[src]")) {
      candidate.hidden = true;
      candidate.classList.add("pptx-slide-embed__native");
    }
  }

  private restoreNativeEmbed(): void {
    const candidate = this.containerEl.previousElementSibling;
    if (candidate instanceof HTMLElement && candidate.matches(".internal-embed[src]")) {
      candidate.hidden = false;
      candidate.classList.remove("pptx-slide-embed__native");
    }
  }

  private startRendering(): void {
    if (this.cancelScheduled !== null || this.rendererSession !== null) return;
    const generation = ++this.generation;
    this.containerEl.dataset.state = "queued";
    this.status.textContent = this.options.messages.text("embed.loading");
    this.cancelScheduled = this.options.scheduler.schedule(async (signal) => {
      if (generation !== this.generation) return;
      this.containerEl.dataset.state = "loading";
      const startedAt = performance.now();
      try {
        const buffer = await this.options.app.vault.readBinary(this.file);
        signal.throwIfAborted();
        const session = await this.options.renderer.open(buffer, this.canvas, signal);
        if (signal.aborted || generation !== this.generation) {
          session.dispose();
          return;
        }
        this.rendererSession = session;
        const slideIndex = session.slideIdentities?.indexOf(this.target.slideId) ?? -1;
        if (slideIndex < 0) {
          session.dispose();
          this.rendererSession = null;
          this.canvas.replaceChildren();
          this.containerEl.dataset.state = "stale-reference";
          this.status.textContent = this.options.messages.text("reference.missing");
          this.containerEl.setAttribute(
            "aria-label",
            this.options.messages.text("reference.missing"),
          );
          return;
        }
        await session.renderSlide(slideIndex);
        signal.throwIfAborted();
        if (generation !== this.generation) return;
        const currentSlide = slideIndex + 1;
        this.containerEl.dataset.currentSlide = String(currentSlide);
        this.containerEl.dataset.firstReadableMs = (
          performance.now() - startedAt
        ).toFixed(3);
        this.canvas.style.aspectRatio = `${session.slideWidth} / ${session.slideHeight}`;
        this.status.textContent = this.options.messages.text("embed.currentSlide", {
          name: this.file.basename,
          slide: currentSlide,
        });
        this.containerEl.setAttribute(
          "aria-label",
          this.options.messages.text("embed.currentSlide", {
            name: this.file.basename,
            slide: currentSlide,
          }),
        );
        if (currentSlide !== this.target.createdSlideNumber) {
          this.status.append(
            document.createTextNode(` — ${this.options.messages.text("reference.moved", {
              created: this.target.createdSlideNumber,
              current: currentSlide,
            })}`),
          );
        }
        this.showCompatibilityWarnings(session);
        this.containerEl.dataset.state = "ready";
      } catch (error) {
        if (signal.aborted || generation !== this.generation) return;
        this.disposeRendererSession();
        this.containerEl.dataset.state = "error";
        this.status.textContent = errorMessage(this.options.messages, error);
        this.containerEl.setAttribute(
          "aria-label",
          errorMessage(this.options.messages, error),
        );
      } finally {
        if (generation === this.generation) this.cancelScheduled = null;
      }
    });
  }

  private showCompatibilityWarnings(session: PptxRendererSession): void {
    this.compatibility.replaceChildren();
    if (!this.options.showDiagnostics()) return;
    const categories = session.detectCompatibilityWarnings?.() ??
      session.compatibilityWarnings ?? [];
    for (const category of categories) {
      this.compatibility.createDiv({
        text: this.options.messages.text(
          category === "font-substitution"
            ? "compatibility.fontSubstitution"
            : "compatibility.unsupportedContent",
        ),
      });
    }
  }

  private releaseRenderingWindow(): void {
    ++this.generation;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    this.disposeRendererSession();
    this.canvas.replaceChildren();
    delete this.containerEl.dataset.currentSlide;
    delete this.containerEl.dataset.firstReadableMs;
    this.compatibility.replaceChildren();
    this.containerEl.dataset.state = "waiting";
    this.status.textContent = this.options.messages.text("embed.loading");
    this.containerEl.setAttribute(
      "aria-label",
      this.options.messages.text("embed.loading"),
    );
  }

  private disposeRendererSession(): void {
    this.rendererSession?.dispose();
    this.rendererSession = null;
  }
}

function embedCandidates(root: HTMLElement): HTMLElement[] {
  const candidates = [...root.querySelectorAll<HTMLElement>(".internal-embed[src]")];
  if (root.matches(".internal-embed[src]")) candidates.unshift(root);
  return candidates;
}

export function processPptxSlideEmbeds(
  root: HTMLElement,
  context: MarkdownPostProcessorContext,
  options: PptxSlideEmbedOptions,
): void {
  for (const element of embedCandidates(root)) {
    if (element.dataset.pptxSlideEmbedProcessed === "true") continue;
    const parsed = parseSlideReferenceLink(element.getAttribute("src") ?? "");
    if (parsed === null || !parsed.sourcePath.toLowerCase().endsWith(".pptx")) continue;
    element.dataset.pptxSlideEmbedProcessed = "true";
    const nativeEmbed = element.parentNode === null ? null : element;
    const host = nativeEmbed === null ? element : document.createElement("div");
    if (host !== element) {
      host.dataset.pptxSlideEmbedProcessed = "true";
      element.after(host);
      element.hidden = true;
      element.classList.add("pptx-slide-embed__native");
    }
    const file = options.app.metadataCache.getFirstLinkpathDest(
      parsed.sourcePath,
      context.sourcePath,
    );
    if (!(file instanceof TFile)) {
      host.replaceChildren();
      host.classList.add("pptx-slide-embed");
      host.dataset.state = "missing-source";
      host.dataset.sourcePath = parsed.sourcePath;
      host.dataset.slideId = String(parsed.target.slideId);
      host.dataset.createdSlide = String(parsed.target.createdSlideNumber);
      host.setAttribute("role", "group");
      host.setAttribute(
        "aria-label",
        options.messages.text("embed.sourceMissing"),
      );
      host.createDiv({
        cls: "pptx-slide-embed__status",
        text: options.messages.text("embed.sourceMissing"),
        attr: { role: "status", "aria-live": "polite" },
      });
      const footer = host.createDiv({ cls: "pptx-slide-embed__footer" });
      const sourceLink = footer.createEl("a", {
        cls: "internal-link",
        text: options.messages.text("reference.openPresentation"),
        href: `${parsed.sourcePath}${formatSlideReferenceFragment(parsed.target)}`,
      });
      sourceLink.dataset.href =
        `${parsed.sourcePath}${formatSlideReferenceFragment(parsed.target)}`;
      const child = new StaticPptxSlideEmbedChild(
        host,
        nativeEmbed,
        options.lifecycle,
      );
      options.lifecycle?.register(child);
      context.addChild(child);
      continue;
    }
    const child = new PptxSlideEmbedChild(
      host,
      file,
      parsed.target,
      parsed.sourcePath,
      options,
      nativeEmbed,
    );
    options.lifecycle?.register(child);
    context.addChild(child);
  }
}
