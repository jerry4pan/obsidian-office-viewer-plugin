import type { App, TFile } from "obsidian";

type DesktopVaultAdapter = {
  getFullPath(path: string): string;
};

export function createExternalOpenAction(
  app: App,
): ((file: TFile) => Promise<void>) | undefined {
  const adapter = app.vault.adapter as Partial<DesktopVaultAdapter> | undefined;
  if (!adapter || typeof adapter.getFullPath !== "function") return undefined;
  return async (file) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Electron shell is only available at desktop runtime
    const { shell } = require("electron") as {
      shell: { openPath(path: string): Promise<string> };
    };
    const failure = await shell.openPath(adapter.getFullPath!(file.path));
    if (failure) throw new Error(failure);
  };
}
