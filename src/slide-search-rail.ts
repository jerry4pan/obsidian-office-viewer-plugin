import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import type { PptxSlideContent } from "./renderer/pptx-renderer-adapter";
import { searchSlideContent } from "./slide-content-search";

export const MAX_MOUNTED_SEARCH_RESULTS = 50;

export interface SlideSearchRailOptions {
  readonly messages?: MessageTranslator;
  readonly currentSlideIndex: () => number;
  readonly onNavigate: (slideId: number) => void;
  readonly onDismiss: () => void;
}

export class SlideSearchRail {
  private readonly panel = createDiv();
  private readonly input: HTMLInputElement;
  private readonly summary: HTMLElement;
  private readonly results: HTMLElement;
  private readonly range: HTMLElement;
  private readonly previousResults: HTMLButtonElement;
  private readonly nextResults: HTMLButtonElement;
  private readonly messages: MessageTranslator;
  private matches = searchSlideContent([], "");
  private resultPage = 0;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly slides: readonly PptxSlideContent[],
    private readonly options: SlideSearchRailOptions,
  ) {
    this.messages = options.messages ?? ENGLISH_MESSAGE_TRANSLATOR;
    this.panel.className = "pptx-viewer__slide-search";
    this.panel.setAttribute("role", "search");
    this.panel.setAttribute("aria-label", this.messages.text("search.open"));
    this.input = this.panel.createEl("input", {
      type: "search",
      attr: {
        "aria-label": this.messages.text("search.inputLabel"),
        "data-action": "slide-search-input",
        placeholder: this.messages.text("search.placeholder"),
      },
    });
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

  open(): void {
    if (this.disposed) return;
    this.root.dataset.searchOpen = "true";
    this.input.focus();
  }

  close(): void {
    if (this.disposed) return;
    delete this.root.dataset.searchOpen;
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
      '[data-action="slide-search-result"]',
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
    delete this.root.dataset.lastSearchMs;
    delete this.root.dataset.mountedSearchResultCount;
    this.panel.remove();
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
    if (target) this.options.onNavigate(target.slideId);
  };

  private render(): void {
    const startedAt = performance.now();
    const query = this.input.value;
    const matches = searchSlideContent(this.slides, query);
    this.matches = matches;
    if (!query.trim()) {
      this.summary.textContent = "";
      this.results.replaceChildren();
      this.range.textContent = "";
      this.previousResults.hidden = true;
      this.nextResults.hidden = true;
      delete this.root.dataset.lastSearchMs;
      this.root.dataset.mountedSearchResultCount = "0";
      return;
    }
    this.summary.textContent = matches.length === 0
      ? this.messages.text("search.noResults")
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
      const snippet = button.createSpan({
        cls: "pptx-viewer__slide-search-snippet",
      });
      snippet.append(document.createTextNode(result.snippet.before));
      snippet.createEl("mark", { text: result.snippet.match });
      snippet.append(document.createTextNode(result.snippet.after));
      button.createSpan({
        cls: "pptx-viewer__slide-search-match-count",
        text: this.messages.text("search.matchCount", {
          count: result.matchCount,
        }),
      });
      button.addEventListener("click", () => {
        if (!this.disposed) this.options.onNavigate(result.slideId);
      });
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
      '[data-action="slide-search-result"]',
    )) {
      if (Number(button.dataset.slideIndex) === this.options.currentSlideIndex()) {
        button.setAttribute("aria-current", "page");
      }
    }
  }
}
