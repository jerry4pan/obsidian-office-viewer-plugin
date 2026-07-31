import { browser } from "@wdio/globals";

export const DIAGNOSTIC_SUMMARY_LABELS = {
  en: "Diagnostic summary",
  zh: "诊断摘要",
  "zh-TW": "診斷摘要",
} as const;

export type DiagnosticSummaryHostLanguage = keyof typeof DIAGNOSTIC_SUMMARY_LABELS;

let settingsParentWindow: string | null = null;
let settingsPopoutWindow: string | null = null;

function diagnosticToggleSelector(toggleLabel: string): string {
  return `.vertical-tab-content input[type="checkbox"][aria-label="${toggleLabel}"]`;
}

async function waitForSettingsModal(): Promise<void> {
  await browser.$(".modal.mod-settings").waitForExist({
    timeout: 15_000,
    timeoutMsg: "Obsidian settings modal did not open",
  });
}

export async function openSettings(): Promise<void> {
  const parentWindow = await browser.getWindowHandle();
  const existingWindows = new Set(await browser.getWindowHandles());
  const opened = await browser.execute(() =>
    (window as unknown as {
      app: { commands: { executeCommandById(id: string): boolean } };
    }).app.commands.executeCommandById("app:open-settings")
  );
  if (!opened) throw new Error("Obsidian rejected the open-settings command");
  await browser.waitUntil(async () => {
    if (await browser.$(".modal.mod-settings").isExisting()) return true;
    const popoutWindow = (await browser.getWindowHandles()).find(
      (handle) => !existingWindows.has(handle),
    );
    if (popoutWindow === undefined) return false;
    settingsParentWindow = parentWindow;
    settingsPopoutWindow = popoutWindow;
    await browser.switchToWindow(popoutWindow);
    return browser.$(".modal.mod-settings").isExisting();
  }, {
    timeout: 15_000,
    timeoutMsg: "Obsidian settings window did not open",
  });
  await waitForSettingsModal();
}

export async function openOfficeViewerSettingsTab(): Promise<void> {
  await openSettings();
  const officeViewerTab = browser.$(
    '.modal.mod-settings .vertical-tab-nav-item[data-setting-id="office-viewer"]',
  );
  await officeViewerTab.waitForClickable({
    timeout: 10_000,
    timeoutMsg: "Office Viewer settings navigation item was not available",
  });
  const title = officeViewerTab.$(".vertical-tab-nav-item-title");
  if ((await title.getText()).trim() !== "Office Viewer") {
    throw new Error("Office Viewer settings navigation item was not discoverable");
  }
  await officeViewerTab.click();

  await browser.$(".vertical-tab-content .setting-item").waitForExist({
    timeout: 10_000,
    timeoutMsg: "Office Viewer settings tab did not open",
  });
}

export async function readDiagnosticSummaryEnabled(
  toggleLabel: string,
): Promise<boolean> {
  await openOfficeViewerSettingsTab();
  const toggle = browser.$(diagnosticToggleSelector(toggleLabel));
  await toggle.waitForExist({
    timeout: 10_000,
    timeoutMsg: `Diagnostic summary toggle was not accessible as ${toggleLabel}`,
  });
  return toggle.isSelected();
}

export async function setDiagnosticSummaryEnabled(
  enabled: boolean,
  toggleLabel: string,
): Promise<void> {
  await openOfficeViewerSettingsTab();
  const toggle = browser.$(diagnosticToggleSelector(toggleLabel));
  await toggle.waitForExist({
    timeout: 10_000,
    timeoutMsg: `Diagnostic summary toggle was not accessible as ${toggleLabel}`,
  });
  const control = await toggle.parentElement();
  await control.waitForClickable({
    timeout: 10_000,
    timeoutMsg: `Diagnostic summary control was not clickable as ${toggleLabel}`,
  });
  if ((await toggle.isSelected()) !== enabled) await control.click();

  await browser.waitUntil(
    async () => (await toggle.isSelected()) === enabled,
    {
      timeout: 10_000,
      timeoutMsg: `Diagnostic summary toggle did not reach ${enabled}`,
    },
  );
}

export async function closeSettings(): Promise<void> {
  if (settingsPopoutWindow !== null && settingsParentWindow !== null) {
    const popoutWindow = settingsPopoutWindow;
    const parentWindow = settingsParentWindow;
    await browser.switchToWindow(popoutWindow);
    await browser.closeWindow();
    await browser.waitUntil(
      async () => !(await browser.getWindowHandles()).includes(popoutWindow),
      {
        timeout: 10_000,
        timeoutMsg: "Obsidian settings window did not close",
      },
    );
    await browser.switchToWindow(parentWindow);
    settingsParentWindow = null;
    settingsPopoutWindow = null;
    return;
  }
  const closeButton = browser.$(".modal.mod-settings .modal-close-button");
  await closeButton.waitForClickable({
    timeout: 10_000,
    timeoutMsg: "Obsidian settings close button was not available",
  });
  await closeButton.click();
  await browser.$(".modal.mod-settings").waitForExist({
    reverse: true,
    timeout: 10_000,
    timeoutMsg: "Obsidian settings modal did not close",
  });
}
