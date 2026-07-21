import type {
  CompanionNoteRelationship,
  OfficeViewerDataStore,
} from "./office-viewer-data-store";
import {
  canonicalCompanionNotePath,
  formatCompanionNoteMarkdown,
  isCompanionNotePathConflict,
  isNormalizedMarkdownPath,
  isNormalizedPptxPath,
  normalizeVaultRelativePath,
} from "./presentation-companion-note";

export type CompanionVaultEntryKind = "missing" | "markdown" | "file" | "folder";

export interface CompanionNoteVault {
  kind(path: string): CompanionVaultEntryKind;
  hasMarkdown(path: string): boolean;
  hasPptx(path: string): boolean;
  create(path: string, content: string): Promise<void>;
  rename(fromPath: string, toPath: string): Promise<void>;
}

export type CompanionNoteEnsureResult =
  | {
      readonly status: "created" | "adopted" | "opened" | "migrated";
      readonly notePath: string;
      readonly conflict: boolean;
    }
  | {
      readonly status: "target-occupied";
      readonly notePath: string;
    }
  | {
      readonly status: "failure";
      readonly reason: "invalid-source" | "vault-write" | "missing-note";
    };

/**
 * Plugin-level business entry point for Presentation companion notes.
 * Workspace leaf ownership stays in the PPTX file view.
 */
export class PresentationCompanionNoteService {
  private readonly sourceQueues = new Map<string, Promise<unknown>>();
  private vaultQueue: Promise<unknown> = Promise.resolve();
  private readonly pluginNoteMigrations = new Set<string>();
  private readonly pendingNoteRenames = new Map<string, string | undefined>();

  constructor(
    private readonly store: OfficeViewerDataStore,
    private readonly vault: CompanionNoteVault,
  ) {}

  reconcile(): void {
    for (const relationship of this.store.listCompanionNotes()) {
      if (
        !this.vault.hasPptx(relationship.sourcePath) ||
        !this.vault.hasMarkdown(relationship.notePath)
      ) {
        this.store.deleteCompanionNote(relationship.sourcePath);
      }
    }
  }

  isPathConflict(sourcePath: string): boolean {
    const relationship = this.store.getCompanionNote(sourcePath);
    if (relationship === undefined) {
      return false;
    }
    return isCompanionNotePathConflict(
      relationship.sourcePath,
      relationship.notePath,
    );
  }

  getRelationship(sourcePath: string): CompanionNoteRelationship | undefined {
    return this.store.getCompanionNote(sourcePath);
  }

  ensureCompanionNote(sourcePath: string): Promise<CompanionNoteEnsureResult> {
    const normalized = normalizeVaultRelativePath(sourcePath);
    if (normalized === undefined || !isNormalizedPptxPath(normalized)) {
      return Promise.resolve({ status: "failure", reason: "invalid-source" });
    }
    return this.enqueue(normalized, () => this.ensureCompanionNoteLocked(normalized));
  }

  handleSourceRename(oldPath: string, newPath: string): Promise<void> {
    return this.enqueueVaultEvent(() =>
      this.handleSourceRenameLocked(oldPath, newPath),
    );
  }

  handleNoteRename(oldPath: string, newPath: string): Promise<void> {
    const normalizedOld = normalizeVaultRelativePath(oldPath);
    const normalizedNew = normalizeVaultRelativePath(newPath);
    if (normalizedOld === undefined) {
      return Promise.resolve();
    }
    this.pendingNoteRenames.set(normalizedOld, normalizedNew);
    window.setTimeout(() => {
      void this.enqueueVaultEvent(() =>
        this.resolvePendingNoteRename(normalizedOld),
      );
    }, 0);
    return Promise.resolve();
  }

  handleDelete(path: string): Promise<void> {
    return this.enqueueVaultEvent(async () => {
      const normalized = normalizeVaultRelativePath(path);
      if (normalized === undefined) {
        return;
      }

      if (isNormalizedPptxPath(normalized)) {
        this.store.deleteCompanionNote(normalized);
        return;
      }

      if (isNormalizedMarkdownPath(normalized)) {
        const relationship = this.store.findCompanionNoteByNotePath(normalized);
        if (relationship !== undefined) {
          this.store.deleteCompanionNote(relationship.sourcePath);
        }
      }
    });
  }

  private async handleSourceRenameLocked(
    oldPath: string,
    newPath: string,
  ): Promise<void> {
    const normalizedOld = normalizeVaultRelativePath(oldPath);
    const normalizedNew = normalizeVaultRelativePath(newPath);
    if (
      normalizedOld === undefined ||
      normalizedNew === undefined ||
      !isNormalizedPptxPath(normalizedNew)
    ) {
      return;
    }

    const relationship = this.store.getCompanionNote(normalizedOld);
    if (relationship === undefined) {
      return;
    }

    const canonical = canonicalCompanionNotePath(normalizedNew);
    if (canonical === undefined) {
      return;
    }

    this.store.deleteCompanionNote(normalizedOld);

    if (this.vault.hasMarkdown(canonical)) {
      if (
        relationship.notePath === canonical ||
        !this.vault.hasMarkdown(relationship.notePath)
      ) {
        // Already healthy, or folder co-move moved the claimed note to canonical.
        this.pendingNoteRenames.delete(relationship.notePath);
        this.store.setCompanionNote({
          sourcePath: normalizedNew,
          notePath: canonical,
        });
        return;
      }
      // Canonical is occupied by a different Markdown file: path conflict.
      this.store.setCompanionNote({
        sourcePath: normalizedNew,
        notePath: relationship.notePath,
      });
      return;
    }

    this.store.setCompanionNote({
      sourcePath: normalizedNew,
      notePath: relationship.notePath,
    });

    if (
      relationship.notePath !== canonical &&
      this.vault.kind(canonical) === "missing"
    ) {
      this.scheduleNoteMigration(
        normalizedNew,
        relationship.notePath,
        canonical,
      );
    }
  }

  private async resolvePendingNoteRename(oldPath: string): Promise<void> {
    if (!this.pendingNoteRenames.has(oldPath)) {
      return;
    }
    const normalizedNew = this.pendingNoteRenames.get(oldPath);
    this.pendingNoteRenames.delete(oldPath);

    if (
      this.pluginNoteMigrations.has(oldPath) ||
      (normalizedNew !== undefined && this.pluginNoteMigrations.has(normalizedNew))
    ) {
      return;
    }

    const relationship = this.store.findCompanionNoteByNotePath(oldPath);
    if (relationship === undefined) {
      return;
    }

    if (
      normalizedNew !== undefined &&
      canonicalCompanionNotePath(relationship.sourcePath) === normalizedNew
    ) {
      this.store.setCompanionNote({
        sourcePath: relationship.sourcePath,
        notePath: normalizedNew,
      });
      return;
    }

    this.store.deleteCompanionNote(relationship.sourcePath);
  }

  private scheduleNoteMigration(
    sourcePath: string,
    fromNotePath: string,
    toNotePath: string,
  ): void {
    window.setTimeout(() => {
      void this.enqueueVaultEvent(async () => {
        const relationship = this.store.getCompanionNote(sourcePath);
        if (
          relationship === undefined ||
          relationship.notePath !== fromNotePath ||
          this.vault.kind(toNotePath) !== "missing" ||
          !this.vault.hasMarkdown(fromNotePath)
        ) {
          return;
        }
        this.markPluginMigration(fromNotePath, toNotePath);
        try {
          await this.vault.rename(fromNotePath, toNotePath);
          this.store.setCompanionNote({
            sourcePath,
            notePath: toNotePath,
          });
        } catch {
          // Leave the path-conflict pair in place for an explicit repair.
        } finally {
          this.deferClearPluginMigration(fromNotePath, toNotePath);
        }
      });
    }, 0);
  }

  private async ensureCompanionNoteLocked(
    sourcePath: string,
  ): Promise<CompanionNoteEnsureResult> {
    const canonical = canonicalCompanionNotePath(sourcePath);
    if (canonical === undefined) {
      return { status: "failure", reason: "invalid-source" };
    }

    const existing = this.store.getCompanionNote(sourcePath);
    if (existing !== undefined) {
      if (isCompanionNotePathConflict(existing.sourcePath, existing.notePath)) {
        if (this.vault.kind(canonical) === "missing") {
          if (!this.vault.hasMarkdown(existing.notePath)) {
            this.store.deleteCompanionNote(sourcePath);
          } else {
            this.markPluginMigration(existing.notePath, canonical);
            try {
              await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 0);
              });
              await this.vault.rename(existing.notePath, canonical);
              this.deferClearPluginMigration(existing.notePath, canonical);
              this.store.setCompanionNote({
                sourcePath,
                notePath: canonical,
              });
              return {
                status: "migrated",
                notePath: canonical,
                conflict: false,
              };
            } catch {
              this.deferClearPluginMigration(existing.notePath, canonical);
              return {
                status: "opened",
                notePath: existing.notePath,
                conflict: true,
              };
            }
          }
        } else if (this.vault.hasMarkdown(existing.notePath)) {
          return {
            status: "opened",
            notePath: existing.notePath,
            conflict: true,
          };
        } else {
          this.store.deleteCompanionNote(sourcePath);
        }
      } else if (this.vault.hasMarkdown(existing.notePath)) {
        return {
          status: "opened",
          notePath: existing.notePath,
          conflict: false,
        };
      } else {
        this.store.deleteCompanionNote(sourcePath);
      }
    }

    const kind = this.vault.kind(canonical);
    if (kind === "markdown") {
      this.store.setCompanionNote({
        sourcePath,
        notePath: canonical,
      });
      return {
        status: "adopted",
        notePath: canonical,
        conflict: false,
      };
    }

    if (kind === "file" || kind === "folder") {
      return {
        status: "target-occupied",
        notePath: canonical,
      };
    }

    try {
      await this.vault.create(canonical, formatCompanionNoteMarkdown(sourcePath));
    } catch {
      // Recheck: a concurrent create may have won.
      if (this.vault.kind(canonical) === "markdown") {
        this.store.setCompanionNote({
          sourcePath,
          notePath: canonical,
        });
        return {
          status: "created",
          notePath: canonical,
          conflict: false,
        };
      }
      return { status: "failure", reason: "vault-write" };
    }

    this.store.setCompanionNote({
      sourcePath,
      notePath: canonical,
    });
    return {
      status: "created",
      notePath: canonical,
      conflict: false,
    };
  }

  private markPluginMigration(fromPath: string, toPath: string): void {
    this.pluginNoteMigrations.add(fromPath);
    this.pluginNoteMigrations.add(toPath);
  }

  private deferClearPluginMigration(fromPath: string, toPath: string): void {
    // Vault rename handlers may run synchronously or as a microtask during
    // rename; keep the mark until after those listeners have observed it.
    queueMicrotask(() => {
      this.pluginNoteMigrations.delete(fromPath);
      this.pluginNoteMigrations.delete(toPath);
    });
  }

  private enqueueVaultEvent<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.vaultQueue.then(operation, operation);
    this.vaultQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private enqueue<T>(sourcePath: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.sourceQueues.get(sourcePath) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    this.sourceQueues.set(
      sourcePath,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }
}
