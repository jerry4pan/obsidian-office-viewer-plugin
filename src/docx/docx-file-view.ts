import {
  FileView,
  Scope,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import {
  createOfficeViewerErrorSurface,
  createOfficeViewerToolbar,
  decorateOfficeViewerIconButton,
} from "../office-viewer-chrome";
import type {
  DocxMessageTranslator,
} from "./docx-messages";
import { DocxOpenError } from "./docx-open-error";
import { DocxSearchPanel } from "./docx-search-panel";
import {
  createSafeDocxRendererBuffer,
  inspectDocxPackage,
  type DocxSemanticModel,
  type DocxSemanticParagraph,
} from "./docx-semantic-model";
import type {
  DocxRendererAdapter,
  DocxRendererSession,
} from "./renderer/docx-renderer-adapter";

export const DOCX_VIEW_TYPE = "docx-viewer";

export interface DocxViewDependencies {
  readonly renderer: DocxRendererAdapter;
  readonly messages: DocxMessageTranslator;
  readonly openExternalUrl?: (url: string) => Promise<void>;
  readonly openInDefaultApplication?: (file: TFile) => Promise<void>;
}

export interface DocxViewPerformanceDiagnostics {
  readonly candidate: string | null;
  readonly sourceBytes: number | null;
  readonly paragraphCount: number | null;
  readonly firstReadableMs: number | null;
  readonly searchReadyMs: number | null;
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  return element;
}

function safeExternalProtocol(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return (
      protocol === "https:" ||
      protocol === "http:" ||
      protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

export class DocxFileView extends FileView {
  private readonly root = document.createElement("div");
  private readonly toolbar = createOfficeViewerToolbar(
    "office-viewer-docx-toolbar",
  );
  private readonly searchButton: HTMLButtonElement;
  private readonly externalButton: HTMLButtonElement;
  private readonly notices = document.createElement("div");
  private readonly actionStatus = document.createElement("div");
  private readonly main = document.createElement("div");
  private readonly searchRail = document.createElement("div");
  private readonly readingBody = document.createElement("div");
  private readonly searchPanel: DocxSearchPanel;
  private currentFile: TFile | null = null;
  private model: DocxSemanticModel | null = null;
  private rendererSession: DocxRendererSession | null = null;
  private activeParagraph: DocxSemanticParagraph | null = null;
  private openGeneration = 0;
  private abortController: AbortController | null = null;
  private disposed = false;
  private diagnostics: DocxViewPerformanceDiagnostics = {
    candidate: null,
    sourceBytes: null,
    paragraphCount: null,
    firstReadableMs: null,
    searchReadyMs: null,
  };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly dependencies: DocxViewDependencies,
    private readonly onDisposed: () => void = () => {},
  ) {
    super(leaf);
    this.root.className = "office-viewer-docx-shell";
    this.root.dataset.state = "idle";
    this.searchButton = button("");
    decorateOfficeViewerIconButton(this.searchButton, "lucide-search");
    this.searchButton.title = dependencies.messages.text("searchOpen");
    this.searchButton.setAttribute("data-action", "open-docx-search");
    this.searchButton.setAttribute(
      "aria-label",
      dependencies.messages.text("searchOpen"),
    );
    this.searchButton.setAttribute("aria-pressed", "false");
    this.externalButton = button(
      dependencies.messages.text("openDefault"),
    );
    this.externalButton.setAttribute("data-action", "open-externally");
    this.notices.className = "office-viewer-docx-notices";
    this.notices.setAttribute("role", "status");
    this.actionStatus.className = "office-viewer-docx-action-status";
    this.actionStatus.setAttribute("aria-live", "polite");
    this.main.className = "office-viewer-docx-main";
    this.searchRail.className = "office-viewer-docx-search-rail";
    this.readingBody.className = "office-viewer-docx-reading-body";
    this.readingBody.setAttribute("role", "document");

    this.searchPanel = new DocxSearchPanel(this.root, this.searchRail, {
      messages: dependencies.messages,
      getModel: () => this.model,
      currentParagraphOrdinal: () => this.activeParagraph?.ordinal ?? null,
      onNavigate: (paragraphOrdinal) => {
        this.activateOrdinal(paragraphOrdinal, true);
      },
      onDismiss: () => this.closeSearch(),
    });

    this.toolbar.primary.append(this.searchButton);
    this.toolbar.secondary.append(this.externalButton);
    this.main.append(this.searchRail, this.readingBody);
    this.root.append(
      this.toolbar.root,
      this.notices,
      this.actionStatus,
      this.main,
    );
    this.contentEl.replaceChildren(this.root);

    this.searchButton.addEventListener("click", () => this.toggleSearch());
    this.externalButton.addEventListener("click", () => {
      void this.openCurrentFileExternally();
    });
    this.readingBody.addEventListener("click", (event) => {
      void this.handleReadingBodyClick(event);
    });
    this.scope = new Scope(this.app.scope);
    this.scope.register(["Mod"], "f", () => {
      this.openSearch();
      return false;
    });
  }

  override getViewType(): string {
    return DOCX_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.basename ??
      this.dependencies.messages.text("fallbackTitle");
  }

  getPerformanceDiagnostics(): DocxViewPerformanceDiagnostics {
    return { ...this.diagnostics };
  }

  override async onLoadFile(file: TFile): Promise<void> {
    const generation = ++this.openGeneration;
    const startedAt = performance.now();
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    this.rendererSession?.dispose();
    this.rendererSession = null;
    this.currentFile = file;
    this.root.dataset.state = "loading";
    delete this.root.dataset.errorCategory;
    delete this.root.dataset.renderer;
    delete this.root.dataset.firstReadableMs;
    delete this.root.dataset.searchReadyMs;
    this.model = null;
    this.setActiveParagraph(null, false);
    this.searchPanel.close();
    this.updateSearchButton();
    this.restoreReadingShell();
    this.readingBody.replaceChildren();
    this.setNotice(this.dependencies.messages.text("loading"));
    this.actionStatus.textContent = "";
    this.searchButton.disabled = false;
    this.externalButton.disabled =
      this.dependencies.openInDefaultApplication === undefined;
    this.diagnostics = {
      candidate: null,
      sourceBytes: file.stat.size,
      paragraphCount: null,
      firstReadableMs: null,
      searchReadyMs: null,
    };

    try {
      const buffer = await this.app.vault.readBinary(file);
      controller.signal.throwIfAborted();
      const model = await inspectDocxPackage(buffer, controller.signal);
      const searchReadyMs = performance.now() - startedAt;
      const rendererBuffer = await createSafeDocxRendererBuffer(
        buffer,
        controller.signal,
      );
      const session = await this.dependencies.renderer.open(
        rendererBuffer,
        this.readingBody,
        model,
        controller.signal,
      );
      if (
        this.disposed ||
        generation !== this.openGeneration ||
        this.currentFile !== file
      ) {
        session.dispose();
        return;
      }
      this.model = model;
      this.rendererSession = session;
      if (session.managesUnavailableContent !== true) {
        this.installUnavailablePlaceholders(model, session);
      }
      const firstReadableMs = performance.now() - startedAt;
      this.diagnostics = {
        candidate: session.candidate,
        sourceBytes: buffer.byteLength,
        paragraphCount: model.paragraphs.length,
        firstReadableMs,
        searchReadyMs,
      };
      this.root.dataset.state = "ready";
      this.root.dataset.renderer = session.candidate;
      this.root.dataset.firstReadableMs = firstReadableMs.toFixed(1);
      this.root.dataset.searchReadyMs = searchReadyMs.toFixed(1);
      this.renderDocumentNotices(model, session);
    } catch (error) {
      if (
        this.disposed ||
        generation !== this.openGeneration ||
        controller.signal.aborted
      ) {
        return;
      }
      this.renderOpenError(error);
    }
  }

  override async onClose(): Promise<void> {
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.openGeneration += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.searchPanel.dispose();
    this.rendererSession?.dispose();
    this.rendererSession = null;
    this.model = null;
    this.currentFile = null;
    this.activeParagraph = null;
    this.contentEl.replaceChildren();
    this.onDisposed();
  }

  private openSearch(): void {
    if (this.searchPanel.isOpen) {
      this.searchPanel.open();
      return;
    }
    this.searchPanel.open();
    this.updateSearchButton();
  }

  private closeSearch(): void {
    const wasOpen = this.searchPanel.isOpen;
    this.searchPanel.close();
    this.updateSearchButton();
    if (wasOpen) this.searchButton.focus();
  }

  private toggleSearch(): void {
    if (this.searchPanel.isOpen) this.closeSearch();
    else this.openSearch();
  }

  private updateSearchButton(): void {
    const open = this.searchPanel.isOpen;
    this.searchButton.setAttribute("aria-pressed", String(open));
    const key = open ? "searchClose" : "searchOpen";
    this.searchButton.title = this.dependencies.messages.text(key);
    this.searchButton.setAttribute(
      "aria-label",
      this.dependencies.messages.text(key),
    );
  }

  private renderDocumentNotices(
    model: DocxSemanticModel,
    session: DocxRendererSession,
  ): void {
    const notices: string[] = [];
    if (session.warnings.includes("large-document-simplified-rendering")) {
      notices.push(this.dependencies.messages.text("largeDocumentSimplified"));
    }
    if (
      session.warnings.includes("preview-unavailable-simplified-rendering")
    ) {
      notices.push(
        this.dependencies.messages.text("previewUnavailableSimplified"),
      );
    }
    if (session.warnings.includes("preview-paragraph-mapping-degraded")) {
      notices.push(this.dependencies.messages.text("mappingDegraded"));
    }
    if (model.hasUnavailableBodyContent) {
      notices.push(this.dependencies.messages.text("unavailableContent"));
    }
    this.setNotice(notices.join(" "));
  }

  private setNotice(message: string): void {
    this.notices.textContent = message;
    this.notices.hidden = message.length === 0;
  }

  private installUnavailablePlaceholders(
    model: DocxSemanticModel,
    session: DocxRendererSession,
  ): void {
    const placeholderText =
      this.dependencies.messages.text("unavailablePlaceholder");
    for (const paragraph of model.paragraphs) {
      if (paragraph.unavailableContent.length === 0) continue;
      const element = session.paragraphElements.get(paragraph.ordinal);
      if (element === undefined) continue;
      const placeholder = document.createElement("span");
      placeholder.className = "office-viewer-docx-unavailable-content";
      placeholder.setAttribute("role", "note");
      placeholder.dataset.docxUnavailableKinds =
        paragraph.unavailableContent.join(",");
      placeholder.textContent = placeholderText;
      element.append(placeholder);
    }
    for (const block of model.unavailableBodyBlocks) {
      const placeholder = document.createElement("div");
      placeholder.className = "office-viewer-docx-unavailable-content";
      placeholder.setAttribute("role", "note");
      placeholder.dataset.docxUnavailableKinds = block.kinds.join(",");
      placeholder.textContent = placeholderText;
      const preceding =
        session.paragraphElements.get(block.afterParagraphOrdinal);
      if (preceding === undefined) {
        this.readingBody.prepend(placeholder);
      } else {
        preceding.after(placeholder);
      }
    }
  }

  private setActiveParagraph(
    paragraph: DocxSemanticParagraph | null,
    reveal: boolean,
  ): void {
    for (const element of this.readingBody.querySelectorAll(
      ".is-active-docx-paragraph",
    )) {
      element.classList.remove("is-active-docx-paragraph");
      element.removeAttribute("aria-current");
    }
    this.activeParagraph = paragraph;
    if (paragraph === null) {
      this.searchPanel.syncCurrentResult();
      return;
    }
    const element = reveal
      ? this.rendererSession?.revealParagraph(paragraph.ordinal)
      : this.rendererSession?.paragraphElements.get(paragraph.ordinal);
    if (element == null) return;
    element.classList.add("is-active-docx-paragraph");
    element.setAttribute("aria-current", "true");
    if (reveal) {
      element.scrollIntoView({ block: "center", behavior: "auto" });
    }
    this.searchPanel.syncCurrentResult();
  }

  private activateOrdinal(ordinal: number, reveal: boolean): boolean {
    const paragraph = this.model?.paragraphs[ordinal - 1];
    if (paragraph === undefined || paragraph.ordinal !== ordinal) return false;
    this.setActiveParagraph(paragraph, reveal);
    return true;
  }

  private async handleReadingBodyClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const external = target.closest<HTMLAnchorElement>(
      "a[data-docx-external-link]",
    );
    if (external !== null) {
      event.preventDefault();
      const url = external.getAttribute("href") ?? "";
      if (
        !safeExternalProtocol(url) ||
        this.dependencies.openExternalUrl === undefined
      ) {
        this.actionStatus.textContent =
          this.dependencies.messages.text("blockedLink");
        return;
      }
      try {
        await this.dependencies.openExternalUrl(url);
      } catch {
        this.actionStatus.textContent =
          this.dependencies.messages.text("blockedLink");
      }
      return;
    }
    const bookmark = target.closest<HTMLElement>("[data-docx-bookmark]");
    if (bookmark !== null) {
      event.preventDefault();
      const name = bookmark.dataset.docxBookmark ?? "";
      const targets =
        this.model?.bookmarkTargets.filter(
          (candidate) => candidate.bookmark === name,
        ) ?? [];
      if (
        targets.length !== 1 ||
        !this.activateOrdinal(
          targets[0]?.paragraphOrdinal ?? Number.NaN,
          true,
        )
      ) {
        this.actionStatus.textContent =
          this.dependencies.messages.text("bookmarkUnavailable");
      }
      return;
    }
    const paragraphElement = target.closest<HTMLElement>(
      "[data-docx-paragraph-ordinal]",
    );
    const ordinal = Number(
      paragraphElement?.dataset.docxParagraphOrdinal ?? Number.NaN,
    );
    if (Number.isSafeInteger(ordinal)) {
      this.activateOrdinal(ordinal, false);
    }
  }

  private async openCurrentFileExternally(): Promise<void> {
    const file = this.currentFile;
    const open = this.dependencies.openInDefaultApplication;
    if (file === null || open === undefined) return;
    try {
      await open(file);
    } catch {
      this.actionStatus.textContent =
        this.dependencies.messages.text("openDefaultFailure");
    }
  }

  private renderOpenError(error: unknown): void {
    this.readingBody.replaceChildren();
    this.model = null;
    this.rendererSession = null;
    this.searchPanel.close();
    this.updateSearchButton();
    this.setNotice("");
    this.actionStatus.textContent = "";
    const key =
      error instanceof DocxOpenError
        ? error.category === "resource-exhausted"
          ? "resourceExhausted"
          : error.category
        : "unknown";
    this.root.dataset.state = "error";
    this.root.dataset.errorCategory = key;
    this.searchButton.disabled = true;
    const file = this.currentFile;
    const { panel } = createOfficeViewerErrorSurface({
      title: this.dependencies.messages.text(key),
      safetyNote: this.dependencies.messages.text("sourceUnmodified"),
      retry: {
        label: this.dependencies.messages.text("retry"),
        action: "retry",
        onClick: () => {
          if (file !== null) void this.onLoadFile(file);
        },
      },
      openExternal:
        file !== null &&
        this.dependencies.openInDefaultApplication !== undefined
          ? {
              label: this.dependencies.messages.text("openDefault"),
              action: "open-externally",
              onClick: () => {
                void this.openCurrentFileExternally();
              },
            }
          : undefined,
      classNames: {
        root: "office-viewer-docx-error",
      },
    });
    this.main.replaceChildren(panel);
  }

  private restoreReadingShell(): void {
    if (this.main.contains(this.readingBody)) return;
    this.main.replaceChildren(this.searchRail, this.readingBody);
  }
}
