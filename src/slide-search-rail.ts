import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import type { PptxSlideContent } from "./renderer/pptx-renderer-adapter";
import { searchSlideContent } from "./slide-content-search";

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
  private readonly messages: MessageTranslator;
  private matches = searchSlideContent([], "");
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
    this.input.addEventListener("input", this.onInput);
    this.input.addEventListener("keydown", this.onKeyDown);
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
    delete this.root.dataset.searchOpen;
    this.panel.remove();
  }

  private readonly onInput = (): void => this.render();

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
    const query = this.input.value;
    const matches = searchSlideContent(this.slides, query);
    this.matches = matches;
    this.results.replaceChildren();
    if (!query.trim()) {
      this.summary.textContent = "";
      return;
    }
    this.summary.textContent = matches.length === 0
      ? this.messages.text("search.noResults")
      : this.messages.text("search.resultCount", { count: matches.length });
    for (const result of matches) {
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
    this.setCurrentSlide(this.options.currentSlideIndex());
  }
}
