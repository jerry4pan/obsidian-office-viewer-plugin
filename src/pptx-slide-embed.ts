import {
  MarkdownRenderChild,
  TFile,
  type App,
  type MarkdownPostProcessorContext,
} from "obsidian";
import type { MessageTranslator } from "./i18n";
import type { PptxRendererAdapter } from "./renderer/pptx-renderer-adapter";
import {
  parseSlideReferenceLink,
  type SlideReferenceTarget,
} from "./slide-reference";
import {
  SlideEmbedController,
  type SlideEmbedCorePorts,
} from "./slide-embed-core";
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

function corePortsFromOptions(
  options: PptxSlideEmbedOptions,
): SlideEmbedCorePorts<TFile> {
  return {
    readBinary: (file) => options.app.vault.readBinary(file),
    renderer: options.renderer,
    scheduler: options.scheduler,
    messages: options.messages,
    showDiagnostics: options.showDiagnostics,
    openExternally: options.openExternally,
  };
}

/**
 * Reading View lifecycle adapter for a missing-source embed.
 * Owns native Obsidian embed hide/restore; chrome comes from the shared core.
 */
class StaticPptxSlideEmbedChild extends MarkdownRenderChild {
  private readonly controller: SlideEmbedController<TFile>;
  private observer: MutationObserver | null = null;

  constructor(
    container: HTMLElement,
    private readonly nativeEmbed: HTMLElement | null,
    options: PptxSlideEmbedOptions,
    sourcePath: string,
    target: SlideReferenceTarget,
    private readonly lifecycle?: PptxSlideEmbedOptions["lifecycle"],
  ) {
    super(container);
    this.controller = new SlideEmbedController(
      container,
      corePortsFromOptions(options),
    );
    this.controller.mount({ file: null, sourcePath, target });
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
    this.controller.dispose();
    const candidate = this.containerEl.previousElementSibling;
    if (candidate instanceof HTMLElement && candidate.matches(".internal-embed[src]")) {
      candidate.hidden = false;
      candidate.classList.remove("pptx-slide-embed__native");
      delete candidate.dataset.pptxSlideEmbedProcessed;
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

/**
 * Reading View lifecycle adapter for a source-backed slide embed.
 * Visibility and native-embed ownership stay here; rendering uses SlideEmbedController.
 */
class PptxSlideEmbedChild extends MarkdownRenderChild {
  private readonly controller: SlideEmbedController<TFile>;
  private observer: IntersectionObserver | null = null;
  private nativeObserver: MutationObserver | null = null;

  constructor(
    container: HTMLElement,
    file: TFile,
    target: SlideReferenceTarget,
    sourcePath: string,
    private readonly options: PptxSlideEmbedOptions,
    private readonly nativeEmbed: HTMLElement | null = null,
  ) {
    super(container);
    this.controller = new SlideEmbedController(
      container,
      corePortsFromOptions(options),
    );
    this.controller.mount({ file, sourcePath, target });
  }

  override onload(): void {
    this.hideNativeEmbed();
    if (this.containerEl.parentElement !== null && this.nativeEmbed !== null) {
      this.nativeObserver = new MutationObserver(() => this.hideNativeEmbed());
      this.nativeObserver.observe(this.containerEl.parentElement, {
        childList: true,
      });
    }
    if (typeof IntersectionObserver === "undefined") {
      this.controller.setVisible(true);
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      this.controller.setVisible(visible);
    }, { rootMargin: "600px 0px" });
    this.observer.observe(this.containerEl);
  }

  override onunload(): void {
    this.nativeObserver?.disconnect();
    this.nativeObserver = null;
    this.restoreNativeEmbed();
    this.observer?.disconnect();
    this.observer = null;
    this.controller.dispose();
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
      delete candidate.dataset.pptxSlideEmbedProcessed;
    }
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
    if (parsed === null || !parsed.sourcePath.toLowerCase().endsWith(".pptx")) {
      continue;
    }
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
      const child = new StaticPptxSlideEmbedChild(
        host,
        nativeEmbed,
        options,
        parsed.sourcePath,
        parsed.target,
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
