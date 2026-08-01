import { describe, expect, it, vi } from "vitest";

import {
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

  it("keeps shared toolbar primary actions on the left", () => {
    const toolbar = createOfficeViewerToolbar("office-viewer-docx-toolbar");
    const search = document.createElement("button");
    search.setAttribute("data-action", "open-docx-search");
    const external = document.createElement("button");
    external.setAttribute("data-action", "open-externally");
    toolbar.primary.append(search);
    toolbar.secondary.append(external);

    expect(toolbar.root.className).toContain("office-viewer-toolbar");
    expect(
      toolbar.root.querySelector(".office-viewer-toolbar__primary [data-action]"),
    ).toBe(search);
    expect(
      toolbar.root.querySelector(
        ".office-viewer-toolbar__secondary [data-action]",
      ),
    ).toBe(external);
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
