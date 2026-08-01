import { describe, expect, it, vi } from "vitest";

import {
  OFFICE_VIEWER_MARK_DATA_URL,
  OFFICE_VIEWER_PRODUCT_NAME,
  createOfficeViewerErrorSurface,
  createOfficeViewerToolbar,
  decorateOfficeViewerIconButton,
} from "../src/office-viewer-chrome";

describe("office viewer chrome", () => {
  it("builds a recovery card with retry before optional external open", () => {
    const retry = vi.fn();
    const openExternal = vi.fn();
    const { panel, actionStatus } = createOfficeViewerErrorSurface({
      title: "Broken document",
      safetyNote: "Source unchanged.",
      retry: {
        label: "Retry",
        action: "retry",
        onClick: retry,
      },
      openExternal: {
        label: "Open externally",
        action: "open-externally",
        onClick: openExternal,
      },
    });

    expect(panel.classList.contains("office-viewer-error")).toBe(true);
    expect(panel.textContent).toContain("Broken document");
    expect(panel.textContent).toContain("Source unchanged.");
    expect(actionStatus.getAttribute("aria-live")).toBe("polite");

    const actions = [
      ...panel.querySelectorAll<HTMLButtonElement>("[data-action]"),
    ].map((button) => button.dataset.action);
    expect(actions).toEqual(["retry", "open-externally"]);

    panel.querySelector<HTMLButtonElement>('[data-action="retry"]')!.click();
    panel
      .querySelector<HTMLButtonElement>('[data-action="open-externally"]')!
      .click();
    expect(retry).toHaveBeenCalledOnce();
    expect(openExternal).toHaveBeenCalledOnce();
  });

  it("renders one shared identity before the primary action slot", () => {
    const docx = createOfficeViewerToolbar({
      format: "DOCX",
      extraClassName: "office-viewer-docx-toolbar",
    });
    const pptx = createOfficeViewerToolbar({ format: "PPTX" });
    const search = document.createElement("button");
    search.setAttribute("data-action", "open-docx-search");
    const external = document.createElement("button");
    external.setAttribute("data-action", "open-externally");
    docx.primary.append(search);
    docx.secondary.append(external);

    for (const toolbar of [docx, pptx]) {
      const brand = toolbar.root.querySelectorAll("[data-office-viewer-brand]");
      expect(brand).toHaveLength(1);
      expect(toolbar.root.firstElementChild).toBe(brand[0]!);
      expect(brand[0]!.nextElementSibling).toBe(toolbar.primary);
      expect(
        brand[0]!.querySelector(".office-viewer-brand__product")?.textContent,
      ).toBe(OFFICE_VIEWER_PRODUCT_NAME);
      expect(
        brand[0]!.querySelector(".office-viewer-brand__creator"),
      ).toBeNull();
      expect(
        brand[0]!.querySelector(".office-viewer-brand__separator"),
      ).toBeNull();
      const mark = brand[0]!.querySelector<HTMLImageElement>(
        ".office-viewer-brand__mark",
      )!;
      expect(mark.getAttribute("aria-hidden")).toBe("true");
      expect(mark.alt).toBe("");
      expect(mark.getAttribute("tabindex")).toBeNull();
      expect(mark.closest("a,button")).toBeNull();
      expect(mark.getAttribute("src")).toBe(OFFICE_VIEWER_MARK_DATA_URL);
      expect(OFFICE_VIEWER_MARK_DATA_URL.startsWith("data:image/svg+xml")).toBe(
        true,
      );
    }

    expect(
      docx.root.querySelector(".office-viewer-brand__format")?.textContent,
    ).toBe("DOCX");
    expect(
      pptx.root.querySelector(".office-viewer-brand__format")?.textContent,
    ).toBe("PPTX");
    expect(
      docx.root.querySelector(".office-viewer-toolbar__primary [data-action]"),
    ).toBe(search);
    expect(
      [...docx.primary.querySelectorAll("button, a, input")][0],
    ).toBe(search);
  });

  it("does not expose arbitrary brand configuration on the toolbar interface", () => {
    expect(createOfficeViewerToolbar.length).toBe(1);
    const toolbar = createOfficeViewerToolbar({ format: "DOCX" });
    expect(Object.keys(toolbar).sort()).toEqual([
      "primary",
      "root",
      "secondary",
    ]);
  });

  it("decorates icon buttons with Obsidian icons and hit targets", () => {
    const button = document.createElement("button");
    button.textContent = "⌕";
    decorateOfficeViewerIconButton(button, "lucide-search");
    expect(button.classList.contains("office-viewer-icon-button")).toBe(true);
    expect(button.dataset.icon).toBe("lucide-search");
    expect(button.textContent).toBe("");
  });
});
