import type { DocxMessageTranslator } from "./docx-messages";
import {
  searchDocxBody,
  type DocxSearchResult,
  type DocxSemanticModel,
} from "./docx-semantic-model";
import { decorateOfficeViewerIconButton } from "../office-viewer-chrome";

export const MAX_MOUNTED_DOCX_SEARCH_RESULTS = 50;
export const MAX_DOCX_SEARCH_QUERY_CHARACTERS = 200;
const MAX_SNIPPET_CONTEXT_CHARACTERS = 48;

export interface DocxSearchSnippet {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

export interface DocxSearchPanelOptions {
  readonly messages: DocxMessageTranslator;
  readonly getModel: () => DocxSemanticModel | null;
  readonly currentParagraphOrdinal: () => number | null;
  readonly onNavigate: (
    paragraphOrdinal: number,
    textHint?: string,
  ) => void;
  readonly onDismiss: () => void;
}

function snippetFor(text: string, query: string): DocxSearchSnippet {
  const display = text.replace(/\s+/g, " ").trim();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const haystack = display.toLocaleLowerCase();
  const matchStart = haystack.indexOf(normalizedQuery);
  if (matchStart < 0 || normalizedQuery.length === 0) {
    const clipped = display.slice(0, MAX_SNIPPET_CONTEXT_CHARACTERS * 2);
    return {
      before: clipped,
      match: "",
      after: display.length > clipped.length ? "…" : "",
    };
  }
  const matchEnd = matchStart + normalizedQuery.length;
  const boundedContext = MAX_SNIPPET_CONTEXT_CHARACTERS - 1;
  const beforeStart = Math.max(0, matchStart - boundedContext);
  const afterEnd = Math.min(display.length, matchEnd + boundedContext);
  return {
    before: `${beforeStart > 0 ? "…" : ""}${display.slice(beforeStart, matchStart)}`,
    match: display.slice(matchStart, matchEnd),
    after: `${display.slice(matchEnd, afterEnd)}${afterEnd < display.length ? "…" : ""}`,
  };
}

export class DocxSearchPanel {
  private readonly panel = document.createElement("div");
  private readonly input: HTMLInputElement;
  private readonly summary: HTMLElement;
  private readonly results: HTMLElement;
  private readonly pagination: HTMLElement;
  private readonly range: HTMLElement;
  private readonly previousResults: HTMLButtonElement;
  private readonly nextResults: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private matches: readonly DocxSearchResult[] = [];
  private resultPage = 0;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    mountParent: HTMLElement,
    private readonly options: DocxSearchPanelOptions,
  ) {
    const { messages } = options;
    this.panel.className = "office-viewer-docx-search office-viewer-search";
    this.panel.setAttribute("role", "search");
    this.panel.setAttribute("aria-label", messages.text("searchOpen"));

    const header = document.createElement("div");
    header.className = "office-viewer-search-header";
    this.closeButton = document.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.setAttribute("data-action", "close-docx-search");
    this.closeButton.title = messages.text("searchClose");
    this.closeButton.setAttribute("aria-label", messages.text("searchClose"));
    decorateOfficeViewerIconButton(this.closeButton, "lucide-x");
    this.closeButton.addEventListener("click", () => {
      if (!this.disposed) this.options.onDismiss();
    });
    header.append(this.closeButton);

    this.input = document.createElement("input");
    this.input.type = "search";
    this.input.className = "office-viewer-docx-search-input";
    this.input.setAttribute("aria-label", messages.text("searchLabel"));
    this.input.setAttribute("data-action", "docx-search-input");
    this.input.maxLength = MAX_DOCX_SEARCH_QUERY_CHARACTERS;
    this.input.placeholder = messages.text("searchPlaceholder");

    this.summary = document.createElement("div");
    this.summary.className = "office-viewer-docx-search-summary";
    this.summary.setAttribute("role", "status");
    this.summary.setAttribute("aria-live", "polite");

    this.results = document.createElement("div");
    this.results.className = "office-viewer-docx-search-results";
    this.results.setAttribute("role", "list");
    this.results.setAttribute("aria-label", messages.text("resultsLabel"));

    this.pagination = document.createElement("div");
    this.pagination.className = "office-viewer-docx-search-pagination";
    this.previousResults = document.createElement("button");
    this.previousResults.type = "button";
    this.previousResults.textContent = "←";
    this.previousResults.setAttribute(
      "aria-label",
      messages.text("previousResults"),
    );
    this.previousResults.setAttribute("data-action", "previous-search-results");
    this.range = document.createElement("span");
    this.range.className = "office-viewer-docx-search-range";
    this.range.setAttribute("aria-live", "polite");
    this.nextResults = document.createElement("button");
    this.nextResults.type = "button";
    this.nextResults.textContent = "→";
    this.nextResults.setAttribute("aria-label", messages.text("nextResults"));
    this.nextResults.setAttribute("data-action", "next-search-results");
    this.pagination.hidden = true;
    this.pagination.append(this.previousResults, this.range, this.nextResults);

    this.panel.append(
      header,
      this.input,
      this.summary,
      this.results,
      this.pagination,
    );
    this.input.addEventListener("input", this.onInput);
    this.input.addEventListener("keydown", this.onKeyDown);
    this.previousResults.addEventListener("click", this.onPreviousResults);
    this.nextResults.addEventListener("click", this.onNextResults);
    mountParent.append(this.panel);
  }

  get isOpen(): boolean {
    return this.root.dataset.searchOpen === "true";
  }

  get currentQuery(): string {
    return this.input.value;
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

  /** Keep search-result current semantics in sync with the active paragraph. */
  syncCurrentResult(): void {
    if (this.disposed || !this.isOpen || this.matches.length === 0) return;
    const current = this.options.currentParagraphOrdinal();
    const resultIndex = current === null
      ? -1
      : this.matches.findIndex(
        ({ paragraphOrdinal }) => paragraphOrdinal === current,
      );
    if (resultIndex >= 0) {
      const resultPage = Math.floor(
        resultIndex / MAX_MOUNTED_DOCX_SEARCH_RESULTS,
      );
      if (resultPage !== this.resultPage) {
        this.resultPage = resultPage;
        this.renderResultPage();
        return;
      }
    }
    this.applyCurrentResult(current);
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
      Math.ceil(this.matches.length / MAX_MOUNTED_DOCX_SEARCH_RESULTS) - 1,
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
    const current = this.options.currentParagraphOrdinal();
    const target = event.shiftKey
      ? [...this.matches]
          .reverse()
          .find(({ paragraphOrdinal }) =>
            current === null ? true : paragraphOrdinal < current,
          ) ?? this.matches.at(-1)
      : this.matches.find(({ paragraphOrdinal }) =>
          current === null ? true : paragraphOrdinal > current,
        ) ?? this.matches[0];
    if (target !== undefined) {
      this.options.onNavigate(target.paragraphOrdinal, this.input.value);
      this.syncCurrentResult();
    }
  };

  private render(): void {
    const startedAt = performance.now();
    const hadActiveQuery = this.root.dataset.searchHasQuery === "true";
    const query = this.input.value.slice(0, MAX_DOCX_SEARCH_QUERY_CHARACTERS);
    if (query !== this.input.value) this.input.value = query;
    const model = this.options.getModel();
    this.matches = model === null ? [] : searchDocxBody(model, query);
    if (!query.trim()) {
      delete this.root.dataset.searchHasQuery;
      this.summary.textContent = "";
      this.results.replaceChildren();
      this.range.textContent = "";
      this.pagination.hidden = true;
      delete this.root.dataset.lastSearchMs;
      this.root.dataset.mountedSearchResultCount = "0";
      if (hadActiveQuery && this.isOpen) this.options.onDismiss();
      return;
    }
    this.root.dataset.searchHasQuery = "true";
    this.summary.textContent =
      this.matches.length === 0
        ? this.options.messages.text("noResults")
        : this.options.messages.text("resultCount", {
            count: this.matches.length,
          });
    this.renderResultPage(query);
    this.root.dataset.lastSearchMs = (performance.now() - startedAt).toFixed(3);
  }

  private renderResultPage(query = this.input.value): void {
    this.results.replaceChildren();
    const start = this.resultPage * MAX_MOUNTED_DOCX_SEARCH_RESULTS;
    const end = Math.min(
      start + MAX_MOUNTED_DOCX_SEARCH_RESULTS,
      this.matches.length,
    );
    const current = this.options.currentParagraphOrdinal();
    for (const result of this.matches.slice(start, end)) {
      const item = document.createElement("div");
      item.setAttribute("role", "listitem");
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "office-viewer-docx-search-result office-viewer-search-result";
      button.setAttribute("data-action", "docx-search-result");
      button.dataset.paragraphOrdinal = String(result.paragraphOrdinal);
      button.setAttribute(
        "aria-label",
        this.options.messages.text("resultLabel", {
          paragraph: result.paragraphOrdinal,
          matches: result.matchCount,
        }),
      );
      if (current === result.paragraphOrdinal) {
        button.setAttribute("aria-current", "location");
      }

      const title = document.createElement("span");
      title.className = "office-viewer-docx-search-result-title";
      title.textContent = this.options.messages.text("paragraph", {
        paragraph: result.paragraphOrdinal,
      });

      const snippet = document.createElement("span");
      snippet.className = "office-viewer-docx-search-snippet";
      const parts = snippetFor(result.text, query);
      snippet.append(document.createTextNode(parts.before));
      if (parts.match.length > 0) {
        const mark = document.createElement("mark");
        mark.textContent = parts.match;
        snippet.append(mark);
      }
      snippet.append(document.createTextNode(parts.after));

      const matchCount = document.createElement("span");
      matchCount.className = "office-viewer-docx-search-match-count";
      matchCount.textContent = this.options.messages.text("matchCount", {
        count: result.matchCount,
      });

      button.append(title, snippet, matchCount);
      button.addEventListener("click", () => {
        if (!this.disposed) {
          this.options.onNavigate(result.paragraphOrdinal, query);
          this.syncCurrentResult();
        }
      });
      item.append(button);
      this.results.append(item);
    }

    const hasMultiplePages =
      this.matches.length > MAX_MOUNTED_DOCX_SEARCH_RESULTS;
    this.range.textContent = hasMultiplePages
      ? this.options.messages.text("resultRange", {
          start: start + 1,
          end,
          count: this.matches.length,
        })
      : "";
    this.pagination.hidden = !hasMultiplePages;
    this.previousResults.disabled = start === 0;
    this.nextResults.disabled = end >= this.matches.length;
    this.root.dataset.mountedSearchResultCount = String(end - start);
  }

  private applyCurrentResult(current: number | null): void {
    for (const button of this.results.querySelectorAll<HTMLElement>(
      "[data-paragraph-ordinal]",
    )) {
      if (Number(button.dataset.paragraphOrdinal) === current) {
        button.setAttribute("aria-current", "location");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }
}
