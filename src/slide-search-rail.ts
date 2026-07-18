import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import type {
  PptxSourceAuthoredSlideText,
  PptxSpeakerNoteContent,
} from "./renderer/pptx-renderer-adapter";
import {
  createPresentationContentSearchIndex,
  createSlideContentSearchIndex,
  mergePresentationSearchSlides,
  type PresentationContentSearchIndex,
  type PresentationSearchScope,
  type SlideContentSearchIndex,
  type SlideSearchResult,
  type SlideSearchSnippet,
} from "./slide-content-search";

export const MAX_MOUNTED_SEARCH_RESULTS = 50;
export const MAX_SEARCH_QUERY_CHARACTERS = 200;

export type SlideSearchNavigateSurface = "slide-text" | "speaker-notes";

export interface SlideSearchNavigateIntent {
  readonly surface: SlideSearchNavigateSurface;
  readonly highlight?: SlideSearchSnippet;
}

export interface SlideSearchRailOptions {
  readonly messages?: MessageTranslator;
  readonly currentSlideIndex: () => number;
  readonly onNavigate: (
    slideId: number,
    intent?: SlideSearchNavigateIntent,
  ) => void;
  readonly onDismiss: () => void;
  readonly speakerNoteContent?: readonly PptxSpeakerNoteContent[];
}

export class SlideSearchRail {
  private readonly panel = createDiv();
  private readonly input: HTMLInputElement;
  private readonly summary: HTMLElement;
  private readonly scopeGroup: HTMLElement | null;
  private readonly results: HTMLElement;
  private readonly range: HTMLElement;
  private readonly previousResults: HTMLButtonElement;
  private readonly nextResults: HTMLButtonElement;
  private readonly messages: MessageTranslator;
  private readonly slideOnlyIndex: SlideContentSearchIndex | null;
  private readonly presentationIndex: PresentationContentSearchIndex | null;
  private readonly presentationSearch: boolean;
  private scope: PresentationSearchScope = "all";
  private matches: readonly SlideSearchResult[] = [];
  private resultPage = 0;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    slides: readonly PptxSourceAuthoredSlideText[],
    private readonly options: SlideSearchRailOptions,
  ) {
    this.messages = options.messages ?? ENGLISH_MESSAGE_TRANSLATOR;
    const merged = mergePresentationSearchSlides(
      slides,
      options.speakerNoteContent,
    );
    this.presentationSearch = merged !== undefined;
    if (merged !== undefined) {
      this.presentationIndex = createPresentationContentSearchIndex(merged);
      this.slideOnlyIndex = null;
    } else {
      this.presentationIndex = null;
      this.slideOnlyIndex = createSlideContentSearchIndex(slides);
    }
    this.panel.className = "pptx-viewer__slide-search";
    this.panel.setAttribute("role", "search");
    this.panel.setAttribute(
      "aria-label",
      this.messages.text(
        this.presentationSearch ? "search.openPresentation" : "search.open",
      ),
    );
    this.input = this.panel.createEl("input", {
      type: "search",
      attr: {
        "aria-label": this.messages.text(
          this.presentationSearch
            ? "search.inputLabelPresentation"
            : "search.inputLabel",
        ),
        "data-action": "slide-search-input",
        maxlength: String(MAX_SEARCH_QUERY_CHARACTERS),
        placeholder: this.messages.text(
          this.presentationSearch
            ? "search.placeholderPresentation"
            : "search.placeholder",
        ),
      },
    });
    this.scopeGroup = this.presentationSearch
      ? this.createScopeControls()
      : null;
    this.summary = this.panel.createDiv({
      cls: "pptx-viewer__slide-search-summary",
      attr: { role: "status", "aria-live": "polite" },
    });
    this.results = this.panel.createDiv({
      cls: "pptx-viewer__slide-search-results",
      attr: {
        role: "list",
        "aria-label": this.messages.text("search.resultsLabel"),
      },
    });
    const pagination = this.panel.createDiv({
      cls: "pptx-viewer__slide-search-pagination",
    });
    this.previousResults = pagination.createEl("button", {
      type: "button",
      text: "←",
      attr: {
        "aria-label": this.messages.text("search.previousResults"),
        "data-action": "previous-search-results",
      },
    });
    this.range = pagination.createSpan({
      cls: "pptx-viewer__slide-search-range",
      attr: { "aria-live": "polite" },
    });
    this.nextResults = pagination.createEl("button", {
      type: "button",
      text: "→",
      attr: {
        "aria-label": this.messages.text("search.nextResults"),
        "data-action": "next-search-results",
      },
    });
    this.previousResults.hidden = true;
    this.nextResults.hidden = true;
    this.input.addEventListener("input", this.onInput);
    this.input.addEventListener("keydown", this.onKeyDown);
    this.previousResults.addEventListener("click", this.onPreviousResults);
    this.nextResults.addEventListener("click", this.onNextResults);
    root.append(this.panel);
  }

  get isOpen(): boolean {
    return this.root.dataset.searchOpen === "true";
  }

  get currentScope(): PresentationSearchScope {
    return this.presentationSearch ? this.scope : "slides";
  }

  open(): void {
    if (this.disposed) return;
    this.root.dataset.searchOpen = "true";
    this.input.focus();
  }

  close(): void {
    if (this.disposed) return;
    delete this.root.dataset.searchOpen;
    delete this.root.dataset.searchHasQuery;
    this.input.value = "";
    this.render();
  }

  setCurrentSlide(index: number): void {
    const resultIndex = this.matches.findIndex(
      ({ slideIndex }) => slideIndex === index,
    );
    const resultPage = resultIndex < 0
      ? this.resultPage
      : Math.floor(resultIndex / MAX_MOUNTED_SEARCH_RESULTS);
    if (resultPage !== this.resultPage) {
      this.resultPage = resultPage;
      this.renderResultPage();
      return;
    }
    for (const button of this.results.querySelectorAll<HTMLElement>(
      "[data-slide-index]",
    )) {
      if (Number(button.dataset.slideIndex) === index) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.input.removeEventListener("input", this.onInput);
    this.input.removeEventListener("keydown", this.onKeyDown);
    this.previousResults.removeEventListener("click", this.onPreviousResults);
    this.nextResults.removeEventListener("click", this.onNextResults);
    delete this.root.dataset.searchOpen;
    delete this.root.dataset.searchHasQuery;
    delete this.root.dataset.lastSearchMs;
    delete this.root.dataset.mountedSearchResultCount;
    delete this.root.dataset.searchScope;
    this.panel.remove();
  }

  private createScopeControls(): HTMLElement {
    const group = this.panel.createDiv({
      cls: "pptx-viewer__slide-search-scopes",
      attr: {
        role: "group",
        "aria-label": this.messages.text("search.scopeLabel"),
      },
    });
    for (const scope of ["all", "slides", "notes"] as const) {
      const button = group.createEl("button", {
        type: "button",
        text: this.messages.text(
          scope === "all"
            ? "search.scopeAll"
            : scope === "slides"
              ? "search.scopeSlides"
              : "search.scopeNotes",
        ),
        attr: {
          "data-action": "search-scope",
          "data-search-scope": scope,
          "aria-pressed": String(scope === this.scope),
        },
      });
      button.addEventListener("click", () => {
        if (this.disposed || this.scope === scope) return;
        this.scope = scope;
        this.root.dataset.searchScope = scope;
        for (const control of group.querySelectorAll<HTMLButtonElement>(
          '[data-action="search-scope"]',
        )) {
          control.setAttribute(
            "aria-pressed",
            String(control.dataset.searchScope === scope),
          );
        }
        this.resultPage = 0;
        this.render();
      });
    }
    this.root.dataset.searchScope = this.scope;
    return group;
  }

  private readonly onInput = (): void => {
    this.resultPage = 0;
    this.render();
  };

  private readonly onPreviousResults = (): void => {
    if (this.resultPage <= 0) return;
    this.resultPage -= 1;
    this.renderResultPage();
  };

  private readonly onNextResults = (): void => {
    const lastPage = Math.max(
      0,
      Math.ceil(this.matches.length / MAX_MOUNTED_SEARCH_RESULTS) - 1,
    );
    if (this.resultPage >= lastPage) return;
    this.resultPage += 1;
    this.renderResultPage();
  };

  private navigateToResult(result: SlideSearchResult): void {
    const notesOnly = result.speakerNotes !== undefined &&
      result.slideText === undefined;
    if (notesOnly || (this.scope === "notes" && result.speakerNotes)) {
      this.options.onNavigate(result.slideId, {
        surface: "speaker-notes",
        highlight: result.speakerNotes?.snippet,
      });
      return;
    }
    this.options.onNavigate(result.slideId, {
      surface: "slide-text",
      highlight: result.slideText?.snippet,
    });
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.options.onDismiss();
      return;
    }
    if (event.key !== "Enter" || this.matches.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const current = this.options.currentSlideIndex();
    const target = event.shiftKey
      ? [...this.matches].reverse().find(({ slideIndex }) => slideIndex < current) ??
        this.matches.at(-1)
      : this.matches.find(({ slideIndex }) => slideIndex > current) ??
        this.matches[0];
    if (target) this.navigateToResult(target);
  };

  private noResultsMessage(): string {
    if (!this.presentationSearch) {
      return this.messages.text("search.noResults");
    }
    if (this.scope === "slides") {
      return this.messages.text("search.noResultsSlides");
    }
    if (this.scope === "notes") {
      return this.messages.text("search.noResultsNotes");
    }
    return this.messages.text("search.noResultsPresentation");
  }

  private render(): void {
    const startedAt = performance.now();
    const hadActiveQuery = this.root.dataset.searchHasQuery === "true";
    const query = this.input.value.slice(0, MAX_SEARCH_QUERY_CHARACTERS);
    if (query !== this.input.value) this.input.value = query;
    const matches = this.presentationIndex
      ? this.presentationIndex.search(query, this.scope)
      : this.slideOnlyIndex!.search(query);
    this.matches = matches;
    if (!query.trim()) {
      delete this.root.dataset.searchHasQuery;
      this.summary.textContent = "";
      this.results.replaceChildren();
      this.range.textContent = "";
      this.previousResults.hidden = true;
      this.nextResults.hidden = true;
      delete this.root.dataset.lastSearchMs;
      this.root.dataset.mountedSearchResultCount = "0";
      if (hadActiveQuery && this.isOpen) this.options.onDismiss();
      return;
    }
    this.root.dataset.searchHasQuery = "true";
    this.summary.textContent = matches.length === 0
      ? this.noResultsMessage()
      : this.messages.text("search.resultCount", { count: matches.length });
    this.renderResultPage();
    this.root.dataset.lastSearchMs = (performance.now() - startedAt).toFixed(3);
  }

  private renderResultPage(): void {
    this.results.replaceChildren();
    const start = this.resultPage * MAX_MOUNTED_SEARCH_RESULTS;
    const end = Math.min(start + MAX_MOUNTED_SEARCH_RESULTS, this.matches.length);
    for (const result of this.matches.slice(start, end)) {
      const item = this.results.createDiv({ attr: { role: "listitem" } });
      if (
        this.presentationSearch &&
        (result.slideText !== undefined || result.speakerNotes !== undefined)
      ) {
        this.renderPresentationResult(item, result);
      } else {
        this.renderLegacyResult(item, result);
      }
    }
    const hasMultiplePages = this.matches.length > MAX_MOUNTED_SEARCH_RESULTS;
    this.range.textContent = hasMultiplePages
      ? this.messages.text("search.resultRange", {
          start: start + 1,
          end,
          count: this.matches.length,
        })
      : "";
    this.previousResults.hidden = !hasMultiplePages;
    this.nextResults.hidden = !hasMultiplePages;
    this.previousResults.disabled = start === 0;
    this.nextResults.disabled = end >= this.matches.length;
    this.root.dataset.mountedSearchResultCount = String(end - start);
    for (const button of this.results.querySelectorAll<HTMLElement>(
      "[data-slide-index]",
    )) {
      if (Number(button.dataset.slideIndex) === this.options.currentSlideIndex()) {
        button.setAttribute("aria-current", "page");
      }
    }
  }

  private renderLegacyResult(
    item: HTMLElement,
    result: SlideSearchResult,
  ): void {
    const button = item.createEl("button", {
      type: "button",
      cls: "pptx-viewer__slide-search-result",
      attr: {
        "data-action": "slide-search-result",
        "data-slide-id": String(result.slideId),
        "data-slide-index": String(result.slideIndex),
        "aria-label": this.messages.text("search.resultLabel", {
          slide: result.slideIndex + 1,
          matches: result.matchCount,
        }),
      },
    });
    button.createSpan({
      cls: "pptx-viewer__slide-search-result-title",
      text: this.messages.text("search.slide", {
        slide: result.slideIndex + 1,
      }),
    });
    this.appendSnippet(button, result.snippet);
    button.createSpan({
      cls: "pptx-viewer__slide-search-match-count",
      text: this.messages.text("search.matchCount", {
        count: result.matchCount,
      }),
    });
    button.addEventListener("click", () => {
      if (!this.disposed) this.navigateToResult(result);
    });
  }

  private renderPresentationResult(
    item: HTMLElement,
    result: SlideSearchResult,
  ): void {
    const card = item.createDiv({
      cls: "pptx-viewer__slide-search-result pptx-viewer__slide-search-result--presentation",
    });
    const title = card.createEl("button", {
      type: "button",
      cls: "pptx-viewer__slide-search-result-title-button",
      attr: {
        "data-action": "slide-search-result",
        "data-slide-id": String(result.slideId),
        "data-slide-index": String(result.slideIndex),
        "aria-label": this.messages.text("search.resultLabel", {
          slide: result.slideIndex + 1,
          matches: result.matchCount,
        }),
      },
    });
    title.createSpan({
      cls: "pptx-viewer__slide-search-result-title",
      text: this.messages.text("search.slide", {
        slide: result.slideIndex + 1,
      }),
    });
    title.addEventListener("click", () => {
      if (!this.disposed) this.navigateToResult(result);
    });
    if (result.slideText) {
      this.renderSurfaceSection(card, result, "slide-text", result.slideText);
    }
    if (result.speakerNotes) {
      this.renderSurfaceSection(
        card,
        result,
        "speaker-notes",
        result.speakerNotes,
      );
    }
  }

  private renderSurfaceSection(
    card: HTMLElement,
    result: SlideSearchResult,
    surface: SlideSearchNavigateSurface,
    match: { readonly matchCount: number; readonly snippet: SlideSearchSnippet },
  ): void {
    const button = card.createEl("button", {
      type: "button",
      cls: "pptx-viewer__slide-search-surface",
      attr: {
        "data-action": surface === "speaker-notes"
          ? "slide-search-notes-match"
          : "slide-search-slide-match",
        "data-slide-id": String(result.slideId),
        "data-slide-index": String(result.slideIndex),
        "aria-label": this.messages.text(
          surface === "speaker-notes"
            ? "search.notesMatchLabel"
            : "search.slideMatchLabel",
          {
            slide: result.slideIndex + 1,
            matches: match.matchCount,
          },
        ),
      },
    });
    button.createSpan({
      cls: "pptx-viewer__slide-search-provenance",
      text: this.messages.text(
        surface === "speaker-notes"
          ? "search.provenanceNotes"
          : "search.provenanceSlideText",
      ),
    });
    this.appendSnippet(button, match.snippet);
    button.createSpan({
      cls: "pptx-viewer__slide-search-match-count",
      text: this.messages.text("search.matchCount", {
        count: match.matchCount,
      }),
    });
    button.addEventListener("click", () => {
      if (this.disposed) return;
      this.options.onNavigate(result.slideId, {
        surface,
        highlight: match.snippet,
      });
    });
  }

  private appendSnippet(
    parent: HTMLElement,
    snippet: SlideSearchSnippet,
  ): void {
    const node = parent.createSpan({
      cls: "pptx-viewer__slide-search-snippet",
    });
    node.append(document.createTextNode(snippet.before));
    node.createEl("mark", { text: snippet.match });
    node.append(document.createTextNode(snippet.after));
  }
}
