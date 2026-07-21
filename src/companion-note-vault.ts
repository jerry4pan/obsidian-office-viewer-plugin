import { TFile, TFolder, type App } from "obsidian";
import type { CompanionNoteVault, CompanionVaultEntryKind } from "./presentation-companion-note-service";

export function createCompanionNoteVault(app: App): CompanionNoteVault {
  return {
    kind(path: string): CompanionVaultEntryKind {
      const abstract = app.vault.getAbstractFileByPath(path);
      if (abstract === null) return "missing";
      if (abstract instanceof TFolder) return "folder";
      if (abstract instanceof TFile) {
        return abstract.extension === "md" ? "markdown" : "file";
      }
      return "file";
    },
    hasMarkdown(path: string): boolean {
      const abstract = app.vault.getAbstractFileByPath(path);
      return abstract instanceof TFile && abstract.extension === "md";
    },
    hasPptx(path: string): boolean {
      const abstract = app.vault.getAbstractFileByPath(path);
      return abstract instanceof TFile && abstract.extension.toLowerCase() === "pptx";
    },
    async create(path: string, content: string): Promise<void> {
      await app.vault.create(path, content);
    },
    async rename(fromPath: string, toPath: string): Promise<void> {
      const abstract = app.vault.getAbstractFileByPath(fromPath);
      if (!(abstract instanceof TFile)) {
        throw new Error(`Companion note missing: ${fromPath}`);
      }
      // Use vault.rename (not fileManager.renameFile) so we are not nested in
      // Obsidian's link-rewrite path while handling a source rename event.
      await app.vault.rename(abstract, toPath);
    },
  };
}
