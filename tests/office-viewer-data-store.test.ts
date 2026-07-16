import {
  type OfficeViewerData,
  type OfficeViewerDataAdapter,
  OfficeViewerDataStore,
} from "../src/office-viewer-data-store";

function clone(data: OfficeViewerData): OfficeViewerData {
  return structuredClone(data);
}

function makeDataAdapter(loaded?: unknown): OfficeViewerDataAdapter & {
  loadCalls: number;
  saved: OfficeViewerData[];
} {
  return {
    loadCalls: 0,
    saved: [],
    async loadData() {
      this.loadCalls += 1;
      return loaded;
    },
    async saveData(data) {
      this.saved.push(clone(data));
    },
  };
}

const deck = { path: "deck.pptx", size: 42, mtime: 10 };

describe("OfficeViewerDataStore", () => {
  it("defaults safely, restores an exact fingerprint, and persists no document content", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(store.settings).toEqual({
      rememberReadingPosition: true,
      diagnosticSummary: false,
      thumbnailRailWidth: 168,
    });
    store.record(deck, 7);
    await store.flush();

    expect(store.resolve(deck, 12)).toBe(7);
    expect(store.resolve({ ...deck, size: 43 }, 12)).toBe(0);
    expect(JSON.stringify(adapter.saved.at(-1))).not.toMatch(
      /filename|text|image|author/i,
    );
  });

  it("loads and persists the Vault-wide thumbnail rail width", async () => {
    const adapter = makeDataAdapter({
      schemaVersion: 1,
      settings: {
        rememberReadingPosition: true,
        thumbnailRailWidth: 300,
      },
      positions: {},
    });
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(store.settings.thumbnailRailWidth).toBe(300);

    store.setThumbnailRailWidth(360);
    await store.flush();

    expect(adapter.saved.at(-1)?.settings.thumbnailRailWidth).toBe(360);
  });

  it("notifies open viewers when the Vault-wide rail width changes", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();
    const listener = vi.fn();
    const unsubscribe = store.subscribeThumbnailRailWidth(listener);

    store.setThumbnailRailWidth(320);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(320);

    unsubscribe();
    store.setThumbnailRailWidth(360);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("copies only approved fields from record and rename inputs", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();
    const decoratedDeck = {
      ...deck,
      text: "private slide text",
      author: "private author",
      imagePreview: "data:image/png;base64,private",
    };
    store.record(decoratedDeck, 3);
    const decoratedRename = {
      ...decoratedDeck,
      path: "renamed.pptx",
      hiddenText: "also private",
    };
    store.rename(deck.path, decoratedRename);

    await store.flush();

    expect(adapter.saved.at(-1)?.positions["renamed.pptx"]).toEqual({
      path: "renamed.pptx",
      size: 42,
      mtime: 10,
      slideIndex: 3,
      updatedAt: expect.any(Number),
    });
    expect(JSON.stringify(adapter.saved.at(-1))).not.toMatch(/text|author|image/i);
  });

  it("normalizes untrusted data and removes invalid entries", async () => {
    const adapter = makeDataAdapter({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true, diagnostic: true },
      positions: {
        "fraction.pptx": {
          path: "fraction.pptx",
          size: 1,
          mtime: 2,
          slideIndex: 1.5,
          updatedAt: 4,
        },
        "invalid.pptx": { path: "invalid.pptx", slideIndex: 1 },
      },
    });
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(
      store.resolve({ path: "fraction.pptx", size: 1, mtime: 2 }, 10),
    ).toBe(0);
    expect(
      store.resolve({ path: "invalid.pptx", size: 1, mtime: 2 }, 10),
    ).toBe(0);
    expect(store.settings).toEqual({
      rememberReadingPosition: true,
      diagnosticSummary: false,
      thumbnailRailWidth: 168,
    });
  });

  it("removes an entry whose index is beyond the current slide count", async () => {
    const adapter = makeDataAdapter({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true },
      positions: {
        "deck.pptx": { ...deck, slideIndex: 12, updatedAt: 3 },
      },
    });
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(store.resolve(deck, 12)).toBe(0);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions).toEqual({});
  });

  it("migrates a saved position on rename", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();
    store.record(deck, 4);

    const renamed = { path: "folder/renamed.pptx", size: 99, mtime: 77 };
    store.rename(deck.path, renamed);
    expect(store.resolve(deck, 10)).toBe(0);
    const renamedWithOriginalFingerprint = {
      path: renamed.path,
      size: deck.size,
      mtime: deck.mtime,
    };
    expect(store.resolve(renamedWithOriginalFingerprint, 10)).toBe(4);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions[renamed.path]).toMatchObject({
      ...renamedWithOriginalFingerprint,
      slideIndex: 4,
    });
    expect(store.resolve(renamed, 10)).toBe(0);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions).toEqual({});
  });

  it("removes a saved position on deletion", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();
    store.record(deck, 4);

    store.delete(deck.path);
    expect(store.resolve(deck, 10)).toBe(0);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions).toEqual({});
  });

  it("uses the last navigation event as the future resume position", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    store.record(deck, 2);
    store.record(deck, 8);
    store.record(deck, 5);
    await store.flush();

    expect(store.resolve(deck, 10)).toBe(5);
    expect(adapter.saved).toHaveLength(1);
    expect(adapter.saved[0]?.positions[deck.path]?.slideIndex).toBe(5);
  });

  it("does not restore or save positions while remembering is disabled", async () => {
    const adapter = makeDataAdapter({
      schemaVersion: 1,
      settings: { rememberReadingPosition: false },
      positions: {
        "deck.pptx": { ...deck, slideIndex: 6, updatedAt: 1 },
      },
    });
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(adapter.loadCalls).toBe(1);
    expect(store.settings).toEqual({
      rememberReadingPosition: false,
      diagnosticSummary: false,
      thumbnailRailWidth: 168,
    });
    expect(store.resolve(deck, 10)).toBe(0);
    store.record(deck, 3);
    store.rename(deck.path, { ...deck, path: "renamed.pptx" });
    store.delete("renamed.pptx");
    await store.flush();

    expect(adapter.saved).toEqual([]);
  });

  it("rejects invalid runtime fingerprints, indices, and path traversal", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    await store.initialize();

    store.record({ ...deck, size: Number.NaN }, 1);
    store.record({ ...deck, mtime: -1 }, 1);
    store.record(deck, -1);
    store.record(deck, 1.5);
    store.record({ ...deck, path: "../outside.pptx" }, 1);
    store.record({ ...deck, path: "folder/../outside.pptx" }, 1);
    await store.flush();

    expect(adapter.saved).toEqual([]);
  });

  it("does not replace a valid entry when rename receives invalid runtime data", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 60_000 });
    await store.initialize();
    store.record(deck, 4);

    store.rename(deck.path, { ...deck, path: "../outside.pptx" });
    store.rename(deck.path, { ...deck, path: "renamed.pptx", size: -1 });

    expect(store.resolve(deck, 10)).toBe(4);
    expect(store.resolve({ ...deck, path: "renamed.pptx" }, 10)).toBe(0);
    await store.dispose();
  });

  it("immediately saves an empty position set when disabled and starts clean when re-enabled", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 60_000 });
    await store.initialize();
    store.record(deck, 7);

    await store.setRememberReadingPosition(false);
    expect(adapter.saved.at(-1)).toEqual({
      schemaVersion: 1,
      settings: {
        rememberReadingPosition: false,
        diagnosticSummary: false,
        thumbnailRailWidth: 168,
      },
      positions: {},
    });
    expect(store.resolve(deck, 10)).toBe(0);

    await store.setRememberReadingPosition(true);
    expect(store.settings).toEqual({
      rememberReadingPosition: true,
      diagnosticSummary: false,
      thumbnailRailWidth: 168,
    });
    expect(store.resolve(deck, 10)).toBe(0);
    expect(adapter.saved.at(-1)?.positions).toEqual({});
  });

  it("persists diagnostic summary independently of reading-position memory", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 60_000 });
    await store.initialize();
    store.record(deck, 7);

    await store.setDiagnosticSummary(true);
    expect(adapter.saved.at(-1)).toEqual({
      schemaVersion: 1,
      settings: {
        rememberReadingPosition: true,
        diagnosticSummary: true,
        thumbnailRailWidth: 168,
      },
      positions: {
        [deck.path]: expect.objectContaining({
          path: deck.path,
          slideIndex: 7,
        }),
      },
    });
    expect(store.settings.diagnosticSummary).toBe(true);

    await store.setDiagnosticSummary(false);
    expect(store.settings.diagnosticSummary).toBe(false);
    expect(adapter.saved.at(-1)?.positions[deck.path]?.slideIndex).toBe(7);
  });

  it("serializes concurrent saves so an earlier slow write cannot overwrite a later state", async () => {
    const releases: Array<() => void> = [];
    const started: OfficeViewerData[] = [];
    const adapter: OfficeViewerDataAdapter = {
      async loadData() {
        return undefined;
      },
      async saveData(data) {
        started.push(clone(data));
        await new Promise<void>((resolve) => releases.push(resolve));
      },
    };
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 60_000 });
    await store.initialize();

    store.record(deck, 1);
    const firstFlush = store.flush();
    await Promise.resolve();
    expect(started.map((data) => data.positions[deck.path]?.slideIndex)).toEqual([1]);

    store.record(deck, 9);
    const secondFlush = store.flush();
    await Promise.resolve();
    expect(started).toHaveLength(1);

    releases.shift()?.();
    await firstFlush;
    await Promise.resolve();
    expect(started.map((data) => data.positions[deck.path]?.slideIndex)).toEqual([
      1,
      9,
    ]);
    releases.shift()?.();
    await secondFlush;
  });

  it("retries the latest state on flush after a debounced save fails", async () => {
    vi.useFakeTimers();
    try {
      const saved: OfficeViewerData[] = [];
      let attempts = 0;
      const adapter: OfficeViewerDataAdapter = {
        async loadData() {
          return undefined;
        },
        async saveData(data) {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("disk temporarily unavailable");
          }
          saved.push(clone(data));
        },
      };
      const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
      await store.initialize();
      store.record(deck, 3);
      await vi.runAllTimersAsync();

      await store.flush();

      expect(attempts).toBe(2);
      expect(saved[0]?.positions[deck.path]?.slideIndex).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries the latest state on dispose after a debounced save fails", async () => {
    vi.useFakeTimers();
    try {
      const saved: OfficeViewerData[] = [];
      let attempts = 0;
      const adapter: OfficeViewerDataAdapter = {
        async loadData() {
          return undefined;
        },
        async saveData(data) {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("disk temporarily unavailable");
          }
          saved.push(clone(data));
        },
      };
      const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
      await store.initialize();
      store.record(deck, 9);
      await vi.runAllTimersAsync();

      await store.dispose();

      expect(attempts).toBe(2);
      expect(saved[0]?.positions[deck.path]?.slideIndex).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes the latest entry when disposed", async () => {
    const adapter = makeDataAdapter();
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 60_000 });
    await store.initialize();
    store.record(deck, 2);
    store.record(deck, 6);

    await store.dispose();

    expect(adapter.saved).toHaveLength(1);
    expect(adapter.saved[0]?.positions[deck.path]?.slideIndex).toBe(6);
  });

  it("does not mutate state when a delayed initialize resolves after disposal", async () => {
    let releaseLoad: ((value: unknown) => void) | undefined;
    const adapter: OfficeViewerDataAdapter = {
      loadData() {
        return new Promise<unknown>((resolve) => {
          releaseLoad = resolve;
        });
      },
      async saveData() {},
    };
    const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
    const initializing = store.initialize();

    await store.dispose();
    releaseLoad?.({
      schemaVersion: 1,
      settings: { rememberReadingPosition: false },
      positions: {},
    });
    await initializing;

    expect(store.settings).toEqual({
      rememberReadingPosition: true,
      diagnosticSummary: false,
      thumbnailRailWidth: 168,
    });
  });
});
