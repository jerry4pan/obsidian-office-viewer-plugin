import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

const REPRESENTATIVE = "performance/representative-12-slides.pptx";
const STRESS = "performance/stress-200-slides.pptx";
type RootElement = ReturnType<typeof browser.$>;

async function closePptxLeaves(): Promise<void> {
  await browser.executeObsidian(({ app }) => {
    for (const leaf of app.workspace.getLeavesOfType("pptx-viewer")) leaf.detach();
  });
  await browser.waitUntil(
    async () => browser.execute(() => document.querySelectorAll(".pptx-viewer").length === 0),
    { timeout: 10_000, timeoutMsg: "PPTX leaves did not close between tests" },
  );
}

async function installFirstReadyCapture(): Promise<void> {
  await browser.execute(() => {
    type CaptureWindow = typeof window & {
      __pptxFirstReadyPage?: string | null;
      __pptxFirstReadyObserver?: MutationObserver;
    };
    const captureWindow = window as CaptureWindow;
    captureWindow.__pptxFirstReadyObserver?.disconnect();
    captureWindow.__pptxFirstReadyPage = null;
    const capture = () => {
      if (captureWindow.__pptxFirstReadyPage !== null) return;
      const root = document.querySelector<HTMLElement>(
        '.pptx-viewer[data-state="ready"]',
      );
      const counter = root?.querySelector<HTMLElement>(".pptx-viewer__page-counter");
      if (counter?.textContent) {
        captureWindow.__pptxFirstReadyPage = counter.textContent.trim();
        captureWindow.__pptxFirstReadyObserver?.disconnect();
      }
    };
    captureWindow.__pptxFirstReadyObserver = new MutationObserver(capture);
    captureWindow.__pptxFirstReadyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-state"],
      childList: true,
      subtree: true,
    });
    capture();
  });
}

async function firstReadyPage(): Promise<string | null> {
  return browser.execute(() =>
    (window as typeof window & { __pptxFirstReadyPage?: string | null })
      .__pptxFirstReadyPage ?? null
  );
}

async function vaultSha256(path: string): Promise<string> {
  return browser.executeObsidian(
    async ({ app, obsidian, require }, vaultPath) => {
      const file = app.vault.getAbstractFileByPath(vaultPath);
      if (!(file instanceof obsidian.TFile)) throw new Error(`Missing ${vaultPath}`);
      const buffer = await app.vault.readBinary(file);
      const { createHash } = require("node:crypto") as typeof import("node:crypto");
      return createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
    },
    path,
  );
}

async function activeReadyRoot() {
  const root = await browser.$(
    '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
  );
  await root.waitForExist({ timeout: 30_000 });
  return root;
}

async function waitForPage(root: RootElement, page: number, total = 12) {
  await browser.waitUntil(
    async () => (await root.getText()).includes(`${page} / ${total}`),
    { timeout: 15_000, timeoutMsg: `PPTX viewer did not reach ${page} / ${total}` },
  );
}

async function jumpTo(root: RootElement, page: number) {
  await root.$('[data-action="page-number"]').setValue(String(page));
  await root.$('[data-action="jump-to-slide"]').click();
  await waitForPage(root, page);
}

async function installedStoreAction(
  action: "clear-and-enable" | "disable-and-clear",
): Promise<{ rememberReadingPosition: boolean; positions: number }> {
  return browser.executeObsidian(async ({ app }, requestedAction) => {
    const plugin = (app as unknown as {
      plugins: { plugins: Record<string, unknown> };
    }).plugins.plugins["office-viewer"] as {
      store?: {
        setRememberReadingPosition(enabled: boolean): Promise<void>;
        flush(): Promise<void>;
      };
      loadData(): Promise<unknown>;
    };
    if (!plugin?.store) throw new Error("Installed office-viewer store unavailable");
    if (requestedAction === "clear-and-enable") {
      await plugin.store.setRememberReadingPosition(false);
      await plugin.store.setRememberReadingPosition(true);
    } else {
      await plugin.store.setRememberReadingPosition(false);
    }
    await plugin.store.flush();
    const data = await plugin.loadData() as {
      settings?: { rememberReadingPosition?: boolean };
      positions?: Record<string, unknown>;
    };
    return {
      rememberReadingPosition: data.settings?.rememberReadingPosition === true,
      positions: Object.keys(data.positions ?? {}).length,
    };
  }, action);
}

describe("M2 installed PPTX reading experience", () => {
  beforeEach(async () => {
    await installNetworkGuard();
    await closePptxLeaves();
    await installedStoreAction("clear-and-enable");
  });

  afterEach(async () => {
    try {
      await assertNoNetworkRequests();
    } finally {
      await closePptxLeaves();
    }
  });

  it("uses keyboard navigation, virtualized thumbnails, zoom, and real full screen without mutation", async () => {
    const before = await vaultSha256(REPRESENTATIVE);
    await obsidianPage.openFile(REPRESENTATIVE);
    const root = await activeReadyRoot();
    await waitForPage(root, 1);

    await root.click();
    await browser.keys(["ArrowRight"]);
    await waitForPage(root, 2);
    await browser.keys(["PageDown"]);
    await waitForPage(root, 3);
    await browser.keys(["PageUp"]);
    await waitForPage(root, 2);

    const thumbnail = root.$('[data-slide-index="5"]');
    await thumbnail.waitForExist({ timeout: 10_000 });
    await thumbnail.click();
    await waitForPage(root, 6);
    await expect(thumbnail).toHaveAttribute("aria-current", "page");

    await root.$('[data-action="zoom-in"]').click();
    await expect(root).toHaveAttribute("data-zoom-mode", "manual");
    await expect(root).toHaveAttribute("data-zoom-percent", "125");
    await root.$('[data-action="zoom-out"]').click();
    await expect(root).toHaveAttribute("data-zoom-percent", "100");
    await root.$('[data-action="fit-slide"]').click();
    await expect(root).toHaveAttribute("data-zoom-mode", "fit");

    const fullscreen = root.$('[data-action="toggle-fullscreen"]');
    await fullscreen.click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-fullscreen")) === "true",
      { timeout: 10_000, timeoutMsg: "viewer did not enter the real Fullscreen API" },
    );
    await fullscreen.click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-fullscreen")) === "false",
      { timeout: 10_000, timeoutMsg: "viewer did not exit the real Fullscreen API" },
    );

    expect(await vaultSha256(REPRESENTATIVE)).toBe(before);

    const stressBefore = await vaultSha256(STRESS);
    await obsidianPage.openFile(STRESS);
    const stressRoot = await activeReadyRoot();
    await waitForPage(stressRoot, 1, 200);
    const mounted = Number(await stressRoot.getAttribute("data-mounted-thumbnail-count"));
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(200);
    expect(await vaultSha256(STRESS)).toBe(stressBefore);
  });

  it("keeps current page and zoom independent across two real workspace leaves", async () => {
    await obsidianPage.openFile(REPRESENTATIVE);
    const first = await activeReadyRoot();
    await browser.execute(() => {
      document.querySelector('.workspace-leaf.mod-active .pptx-viewer')
        ?.setAttribute("data-e2e-leaf", "first");
    });

    await browser.executeObsidian(async ({ app, obsidian }, path) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof obsidian.TFile)) throw new Error(`Missing ${path}`);
      const leaf = app.workspace.getLeaf("split");
      await leaf.openFile(file);
      app.workspace.setActiveLeaf(leaf, { focus: true });
    }, REPRESENTATIVE);
    const second = await activeReadyRoot();
    await browser.execute(() => {
      document.querySelector('.workspace-leaf.mod-active .pptx-viewer')
        ?.setAttribute("data-e2e-leaf", "second");
    });

    const firstTagged = await browser.$('[data-e2e-leaf="first"]');
    const secondTagged = await browser.$('[data-e2e-leaf="second"]');
    await jumpTo(firstTagged, 4);
    await firstTagged.$('[data-action="zoom-in"]').click();
    await jumpTo(secondTagged, 8);
    await secondTagged.$('[data-action="zoom-out"]').click();

    await waitForPage(firstTagged, 4);
    await expect(firstTagged).toHaveAttribute("data-zoom-percent", "125");
    await waitForPage(secondTagged, 8);
    await expect(secondTagged).toHaveAttribute("data-zoom-percent", "75");
  });

  it("restores a page after restart, then disable-and-clear resets to page 1", async () => {
    await obsidianPage.openFile(REPRESENTATIVE);
    let root = await activeReadyRoot();
    await jumpTo(root, 9);
    await browser.pause(350);

    await closePptxLeaves();
    await assertNoNetworkRequests({ keepGuard: true });
    await browser.reloadObsidian({ plugins: ["office-viewer"] });
    await installNetworkGuard();
    await closePptxLeaves();
    await installFirstReadyCapture();
    await obsidianPage.openFile(REPRESENTATIVE);
    root = await activeReadyRoot();
    expect(await firstReadyPage()).toBe("9 / 12");
    await waitForPage(root, 9);

    expect(await installedStoreAction("disable-and-clear")).toEqual({
      rememberReadingPosition: false,
      positions: 0,
    });
    await closePptxLeaves();
    await assertNoNetworkRequests({ keepGuard: true });
    await browser.reloadObsidian({ plugins: ["office-viewer"] });
    await installNetworkGuard();
    await closePptxLeaves();
    await installFirstReadyCapture();
    await obsidianPage.openFile(REPRESENTATIVE);
    root = await activeReadyRoot();
    expect(await firstReadyPage()).toBe("1 / 12");
    await waitForPage(root, 1);
    const stored = await browser.executeObsidian(async ({ app }) => {
      const plugin = (app as unknown as {
        plugins: { plugins: Record<string, unknown> };
      }).plugins.plugins["office-viewer"] as { loadData(): Promise<unknown> };
      return plugin.loadData() as Promise<{
        settings: { rememberReadingPosition: boolean };
        positions: Record<string, unknown>;
      }>;
    });
    expect(stored.settings.rememberReadingPosition).toBe(false);
    expect(stored.positions).toEqual({});
  });

  it("resolves theme variables and exposes names and visible keyboard focus", async () => {
    await obsidianPage.setTheme("default");
    await obsidianPage.openFile(REPRESENTATIVE);
    const root = await activeReadyRoot();

    for (const theme of ["theme-light", "theme-dark"]) {
      const result = await browser.execute((themeClass) => {
        type Rgb = { r: number; g: number; b: number; a: number };
        const parseColor = (color: string): Rgb | null => {
          const match = color.match(/^rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\)$/);
          if (!match) return null;
          return {
            r: Number(match[1]),
            g: Number(match[2]),
            b: Number(match[3]),
            a: match[4] === undefined ? 1 : Number(match[4]),
          };
        };
        const blend = (foreground: Rgb, background: Rgb): Rgb => ({
          r: foreground.r * foreground.a + background.r * (1 - foreground.a),
          g: foreground.g * foreground.a + background.g * (1 - foreground.a),
          b: foreground.b * foreground.a + background.b * (1 - foreground.a),
          a: 1,
        });
        const effectiveBackground = (element: HTMLElement): Rgb => {
          const layers: Rgb[] = [];
          for (let current: HTMLElement | null = element; current; current = current.parentElement) {
            const color = parseColor(getComputedStyle(current).backgroundColor);
            if (color && color.a > 0) layers.push(color);
          }
          let result: Rgb = { r: 255, g: 255, b: 255, a: 1 };
          for (const layer of layers.reverse()) result = blend(layer, result);
          return result;
        };
        const luminance = (color: Rgb) => {
          const channel = (value: number) => {
            const normalized = value / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) +
            0.0722 * channel(color.b);
        };
        const contrast = (first: Rgb, second: Rgb) => {
          const firstLuminance = luminance(first);
          const secondLuminance = luminance(second);
          const lighter = Math.max(firstLuminance, secondLuminance);
          const darker = Math.min(firstLuminance, secondLuminance);
          return (lighter + 0.05) / (darker + 0.05);
        };
        const accessibleName = (control: HTMLElement) => {
          const ariaLabel = control.getAttribute("aria-label")?.trim();
          if (ariaLabel) return ariaLabel;
          const labelledBy = control.getAttribute("aria-labelledby");
          if (labelledBy) {
            const text = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
            if (text) return text;
          }
          if (control instanceof HTMLInputElement && control.labels) {
            const text = Array.from(control.labels, (label) => label.textContent ?? "").join(" ").trim();
            if (text) return text;
          }
          if (control instanceof HTMLButtonElement) return control.textContent?.trim() ?? "";
          return "";
        };
        document.body.classList.remove("theme-light", "theme-dark");
        document.body.classList.add(themeClass);
        const viewer = document.querySelector<HTMLElement>(
          '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
        )!;
        const style = getComputedStyle(viewer);
        const variables = [
          style.getPropertyValue("--background-primary").trim(),
          style.getPropertyValue("--text-normal").trim(),
          style.getPropertyValue("--interactive-accent").trim(),
        ];
        const controls = Array.from(
          viewer.querySelectorAll<HTMLElement>("button:not([hidden]), input:not([hidden])"),
        ).filter((control) => control.getClientRects().length > 0).map((control) => {
          const style = getComputedStyle(control);
          const background = effectiveBackground(control);
          const foreground = parseColor(style.color);
          const border = parseColor(style.borderTopColor);
          return {
            action: control.dataset.action ?? control.tagName,
            name: accessibleName(control),
            disabled: control.matches(":disabled"),
            opacity: Number(style.opacity),
            foregroundContrast: foreground ? contrast(blend(foreground, background), background) : 0,
            borderContrast: border ? contrast(blend(border, background), background) : 0,
            background: [background.r, background.g, background.b, background.a],
            computedBackground: style.backgroundColor,
            border: style.borderTopColor,
          };
        });
        return { variables, controls };
      }, theme);
      expect(result.variables.every(Boolean)).toBe(true);
      expect(new Set(result.variables).size).toBeGreaterThan(1);
      expect(result.controls.length).toBeGreaterThan(0);
      for (const control of result.controls) {
        expect(control.name).not.toBe("");
        expect(control.computedBackground).not.toBe("");
        expect(control.background[3]).toBe(1);
        expect(control.border).not.toBe("");
        if (control.disabled) {
          expect(
            control.opacity < 1 || control.foregroundContrast >= 2,
          ).toBe(true);
        } else {
          expect(
            control.foregroundContrast,
          ).toBeGreaterThanOrEqual(3);
        }
        expect(
          Math.max(control.foregroundContrast, control.borderContrast),
        ).toBeGreaterThanOrEqual(3);
      }

      await root.click();
      await browser.keys(["Tab"]);
      const focus = await browser.execute(() => {
        const parse = (color: string) => {
          const match = color.match(/^rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\)$/);
          return match
            ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) }
            : null;
        };
        const luminance = (color: { r: number; g: number; b: number }) => {
          const channel = (value: number) => {
            const normalized = value / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
        };
        const active = document.activeElement as HTMLElement | null;
        if (!active) return { action: null, width: 0, style: "none", color: "", contrast: 0 };
        const computed = getComputedStyle(active);
        const outline = parse(computed.outlineColor);
        let current: HTMLElement | null = active;
        let background = null as ReturnType<typeof parse>;
        while (current && (!background || background.a === 0)) {
          background = parse(getComputedStyle(current).backgroundColor);
          current = current.parentElement;
        }
        let ratio = 0;
        if (outline && background) {
          const first = luminance(outline);
          const second = luminance(background);
          ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
        }
        return {
          action: active.dataset.action ?? null,
          width: Number.parseFloat(computed.outlineWidth) || 0,
          style: computed.outlineStyle,
          color: computed.outlineColor,
          contrast: ratio,
        };
      });
      expect(focus.action).not.toBeNull();
      expect(focus.width).toBeGreaterThan(0);
      expect(focus.style).not.toBe("none");
      expect(focus.color).not.toBe("transparent");
      expect(focus.contrast).toBeGreaterThanOrEqual(3);
    }
  });

  it("cancels bounded background work and releases mounted thumbnails on detach", async () => {
    const before = await vaultSha256(STRESS);
    await obsidianPage.openFile(STRESS);
    const root = await activeReadyRoot();
    await waitForPage(root, 1, 200);
    await browser.execute(() => {
      document.querySelector('.workspace-leaf.mod-active .pptx-viewer')
        ?.setAttribute("data-e2e-detach", "target");
    });
    const beforeDetach = await browser.executeObsidian(({ app }) => {
      const leaf = app.workspace.activeLeaf;
      const view = leaf?.view as unknown as {
        getViewType(): string;
        getPerformanceDiagnostics(): {
          backgroundPending: number;
          backgroundRunning: number;
          mountedThumbnails: number;
        };
      };
      if (!leaf || view.getViewType() !== "pptx-viewer") {
        throw new Error("Active installed PPTX view unavailable");
      }
      (window as typeof window & { __pptxDetachedView?: unknown }).__pptxDetachedView = view;
      return view.getPerformanceDiagnostics();
    });
    expect(beforeDetach.mountedThumbnails).toBeGreaterThan(0);
    expect(beforeDetach.mountedThumbnails).toBeLessThan(200);
    expect(beforeDetach.backgroundRunning).toBeLessThanOrEqual(1);

    await browser.executeObsidian(({ app }) => app.workspace.activeLeaf?.detach());
    await browser.waitUntil(async () => {
      const diagnostics = await browser.execute(() => {
        const view = (window as typeof window & {
          __pptxDetachedView?: { getPerformanceDiagnostics(): unknown };
        }).__pptxDetachedView;
        return view?.getPerformanceDiagnostics() as {
          backgroundPending: number;
          backgroundRunning: number;
          mountedThumbnails: number;
        } | undefined;
      });
      return diagnostics?.backgroundPending === 0 &&
        diagnostics.backgroundRunning === 0 &&
        diagnostics.mountedThumbnails === 0;
    }, { timeout: 10_000, timeoutMsg: "detached view retained M2 background resources" });

    await expect(browser.$('[data-e2e-detach="target"]')).not.toExist();
    expect(await vaultSha256(STRESS)).toBe(before);
  });
});
