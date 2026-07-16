import {
  DEFAULT_THUMBNAIL_RAIL_WIDTH,
  normalizeThumbnailRailWidth,
} from "./thumbnail-rail-sizing";

export interface FileFingerprint {
  readonly path: string;
  readonly size: number;
  readonly mtime: number;
}

export interface OfficeViewerSettings {
  readonly rememberReadingPosition: boolean;
  readonly diagnosticSummary: boolean;
  readonly thumbnailRailWidth: number;
}

export interface ReadingPositionEntry extends FileFingerprint {
  readonly slideIndex: number;
  readonly updatedAt: number;
}

export interface OfficeViewerData {
  readonly schemaVersion: 1;
  readonly settings: OfficeViewerSettings;
  readonly positions: Record<string, ReadingPositionEntry>;
}

export interface OfficeViewerDataAdapter {
  loadData(): Promise<unknown>;
  saveData(data: OfficeViewerData): Promise<void>;
}

const DEFAULT_SETTINGS: OfficeViewerSettings = {
  rememberReadingPosition: true,
  diagnosticSummary: false,
  thumbnailRailWidth: DEFAULT_THUMBNAIL_RAIL_WIDTH,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVaultRelativePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.startsWith("\\") &&
    !/^[A-Za-z]:[\\/]/.test(path) &&
    !path.replaceAll("\\", "/").split("/").includes("..")
  );
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidFingerprint(file: FileFingerprint): boolean {
  return (
    isVaultRelativePath(file.path) &&
    isNonNegativeFiniteNumber(file.size) &&
    isNonNegativeFiniteNumber(file.mtime)
  );
}

function isValidSlideIndex(slideIndex: number): boolean {
  return Number.isInteger(slideIndex) && slideIndex >= 0;
}

function normalizeEntry(
  key: string,
  value: unknown,
): ReadingPositionEntry | undefined {
  if (!isRecord(value) || value.path !== key || !isVaultRelativePath(value.path)) {
    return undefined;
  }
  if (
    !isNonNegativeFiniteNumber(value.size) ||
    !isNonNegativeFiniteNumber(value.mtime) ||
    !Number.isInteger(value.slideIndex) ||
    !isNonNegativeFiniteNumber(value.slideIndex) ||
    !isNonNegativeFiniteNumber(value.updatedAt)
  ) {
    return undefined;
  }

  return {
    path: value.path,
    size: value.size,
    mtime: value.mtime,
    slideIndex: value.slideIndex,
    updatedAt: value.updatedAt,
  };
}

function normalizeData(value: unknown): OfficeViewerData {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return {
      schemaVersion: 1,
      settings: DEFAULT_SETTINGS,
      positions: {},
    };
  }

  const rememberReadingPosition =
    isRecord(value.settings) &&
    typeof value.settings.rememberReadingPosition === "boolean"
      ? value.settings.rememberReadingPosition
      : true;
  const diagnosticSummary =
    isRecord(value.settings) &&
    typeof value.settings.diagnosticSummary === "boolean"
      ? value.settings.diagnosticSummary
      : false;
  const thumbnailRailWidth =
    isRecord(value.settings) && typeof value.settings.thumbnailRailWidth === "number"
      ? normalizeThumbnailRailWidth(value.settings.thumbnailRailWidth)
      : DEFAULT_THUMBNAIL_RAIL_WIDTH;
  const positions: Record<string, ReadingPositionEntry> = {};

  if (rememberReadingPosition && isRecord(value.positions)) {
    for (const [key, candidate] of Object.entries(value.positions)) {
      const entry = normalizeEntry(key, candidate);
      if (entry !== undefined) {
        Object.defineProperty(positions, key, {
          configurable: true,
          enumerable: true,
          value: entry,
          writable: true,
        });
      }
    }
  }

  return {
    schemaVersion: 1,
    settings: { rememberReadingPosition, diagnosticSummary, thumbnailRailWidth },
    positions,
  };
}

function snapshot(data: OfficeViewerData): OfficeViewerData {
  return {
    schemaVersion: 1,
    settings: {
      rememberReadingPosition: data.settings.rememberReadingPosition,
      diagnosticSummary: data.settings.diagnosticSummary,
      thumbnailRailWidth: data.settings.thumbnailRailWidth,
    },
    positions: Object.fromEntries(
      Object.entries(data.positions).map(([path, entry]) => [
        path,
        {
          path: entry.path,
          size: entry.size,
          mtime: entry.mtime,
          slideIndex: entry.slideIndex,
          updatedAt: entry.updatedAt,
        },
      ]),
    ),
  };
}

export class OfficeViewerDataStore {
  private data: OfficeViewerData = {
    schemaVersion: 1,
    settings: DEFAULT_SETTINGS,
    positions: {},
  };
  private disposed = false;
  private revision = 0;
  private persistedRevision = 0;
  private saveTimer: number | undefined;
  private saveTail: Promise<void> = Promise.resolve();
  private readonly thumbnailRailWidthListeners = new Set<
    (width: number) => void
  >();

  constructor(
    private readonly adapter: OfficeViewerDataAdapter,
    private readonly options: { readonly debounceMs?: number } = {},
  ) {}

  get settings(): OfficeViewerSettings {
    return { ...this.data.settings };
  }

  async initialize(): Promise<void> {
    if (this.disposed) {
      return;
    }
    const loaded = await this.adapter.loadData();
    if (this.disposed) {
      return;
    }
    this.data = normalizeData(loaded);
  }

  resolve(file: FileFingerprint, slideCount: number): number {
    if (!this.data.settings.rememberReadingPosition) {
      return 0;
    }

    const entry = Object.hasOwn(this.data.positions, file.path)
      ? this.data.positions[file.path]
      : undefined;
    if (entry === undefined) {
      return 0;
    }

    const valid =
      entry.path === file.path &&
      entry.size === file.size &&
      entry.mtime === file.mtime &&
      Number.isInteger(entry.slideIndex) &&
      entry.slideIndex >= 0 &&
      Number.isInteger(slideCount) &&
      entry.slideIndex < slideCount;
    if (valid) {
      return entry.slideIndex;
    }

    this.remove(file.path);
    return 0;
  }

  record(file: FileFingerprint, slideIndex: number): void {
    if (
      this.disposed ||
      !this.data.settings.rememberReadingPosition ||
      !isValidFingerprint(file) ||
      !isValidSlideIndex(slideIndex)
    ) {
      return;
    }

    this.setPosition(file.path, {
      path: file.path,
      size: file.size,
      mtime: file.mtime,
      slideIndex,
      updatedAt: Date.now(),
    });
    this.markChanged();
  }

  rename(oldPath: string, file: FileFingerprint): void {
    if (
      this.disposed ||
      !this.data.settings.rememberReadingPosition ||
      !isValidFingerprint(file)
    ) {
      return;
    }

    const entry = Object.hasOwn(this.data.positions, oldPath)
      ? this.data.positions[oldPath]
      : undefined;
    if (entry === undefined) {
      return;
    }

    delete this.data.positions[oldPath];
    this.setPosition(file.path, {
      path: file.path,
      size: entry.size,
      mtime: entry.mtime,
      slideIndex: entry.slideIndex,
      updatedAt: entry.updatedAt,
    });
    this.markChanged();
  }

  delete(path: string): void {
    if (this.disposed || !this.data.settings.rememberReadingPosition) {
      return;
    }
    this.remove(path);
  }

  async setRememberReadingPosition(enabled: boolean): Promise<void> {
    if (this.disposed || enabled === this.data.settings.rememberReadingPosition) {
      return;
    }

    this.clearTimer();
    this.data = {
      schemaVersion: 1,
      settings: {
        rememberReadingPosition: enabled,
        diagnosticSummary: this.data.settings.diagnosticSummary,
        thumbnailRailWidth: this.data.settings.thumbnailRailWidth,
      },
      positions: {},
    };
    this.revision += 1;
    await this.flush();
  }

  async setDiagnosticSummary(enabled: boolean): Promise<void> {
    if (this.disposed || enabled === this.data.settings.diagnosticSummary) {
      return;
    }

    this.clearTimer();
    this.data = {
      ...this.data,
      settings: {
        ...this.data.settings,
        diagnosticSummary: enabled,
      },
    };
    this.revision += 1;
    await this.flush();
  }

  setThumbnailRailWidth(width: number): void {
    if (this.disposed) return;
    const thumbnailRailWidth = normalizeThumbnailRailWidth(width);
    if (thumbnailRailWidth === this.data.settings.thumbnailRailWidth) return;
    this.data = {
      ...this.data,
      settings: {
        ...this.data.settings,
        thumbnailRailWidth,
      },
    };
    this.markChanged();
    for (const listener of this.thumbnailRailWidthListeners) {
      try {
        listener(thumbnailRailWidth);
      } catch {
        // A detached viewer must not block preference persistence.
      }
    }
  }

  subscribeThumbnailRailWidth(listener: (width: number) => void): () => void {
    if (this.disposed) return () => {};
    this.thumbnailRailWidthListeners.add(listener);
    return () => this.thumbnailRailWidthListeners.delete(listener);
  }

  async flush(): Promise<void> {
    this.clearTimer();
    if (this.revision > this.persistedRevision) {
      const revision = this.revision;
      await this.enqueueSave(snapshot(this.data));
      this.persistedRevision = Math.max(this.persistedRevision, revision);
      return;
    }
    await this.saveTail;
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    await this.flush();
    this.thumbnailRailWidthListeners.clear();
  }

  private remove(path: string): void {
    if (!Object.hasOwn(this.data.positions, path)) {
      return;
    }
    delete this.data.positions[path];
    this.markChanged();
  }

  private setPosition(path: string, entry: ReadingPositionEntry): void {
    Object.defineProperty(this.data.positions, path, {
      configurable: true,
      enumerable: true,
      value: entry,
      writable: true,
    });
  }

  private markChanged(): void {
    this.revision += 1;
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== undefined) {
      return;
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = undefined;
      void this.flush().catch(() => undefined);
    }, this.options.debounceMs ?? 250);
  }

  private clearTimer(): void {
    if (this.saveTimer !== undefined) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
  }

  private enqueueSave(data: OfficeViewerData): Promise<void> {
    const operation = this.saveTail.then(() => this.adapter.saveData(data));
    this.saveTail = operation.catch(() => undefined);
    return operation;
  }
}
