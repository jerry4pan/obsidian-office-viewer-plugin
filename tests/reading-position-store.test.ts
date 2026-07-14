import {
  type OfficeViewerData,
  type OfficeViewerDataAdapter,
  ReadingPositionStore,
} from "../src/reading-position-store";

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

describe("ReadingPositionStore", () => {
  it("defaults safely, restores an exact fingerprint, and persists no document content", async () => {
    const adapter = makeDataAdapter();
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(store.settings).toEqual({ rememberReadingPosition: true });
    store.record(deck, 7);
    await store.flush();

    expect(store.resolve(deck, 12)).toBe(7);
    expect(store.resolve({ ...deck, size: 43 }, 12)).toBe(0);
    expect(JSON.stringify(adapter.saved.at(-1))).not.toMatch(
      /filename|text|image|author/i,
    );
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
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(
      store.resolve({ path: "fraction.pptx", size: 1, mtime: 2 }, 10),
    ).toBe(0);
    expect(
      store.resolve({ path: "invalid.pptx", size: 1, mtime: 2 }, 10),
    ).toBe(0);
    expect(store.settings).toEqual({ rememberReadingPosition: true });
  });

  it("removes an entry whose index is beyond the current slide count", async () => {
    const adapter = makeDataAdapter({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true },
      positions: {
        "deck.pptx": { ...deck, slideIndex: 12, updatedAt: 3 },
      },
    });
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(store.resolve(deck, 12)).toBe(0);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions).toEqual({});
  });

  it("migrates a saved position on rename", async () => {
    const adapter = makeDataAdapter();
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
    await store.initialize();
    store.record(deck, 4);

    const renamed = { path: "folder/renamed.pptx", size: 42, mtime: 10 };
    store.rename(deck.path, renamed);
    expect(store.resolve(deck, 10)).toBe(0);
    expect(store.resolve(renamed, 10)).toBe(4);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions[renamed.path]).toMatchObject({
      ...renamed,
      slideIndex: 4,
    });
  });

  it("removes a saved position on deletion", async () => {
    const adapter = makeDataAdapter();
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
    await store.initialize();
    store.record(deck, 4);

    store.delete(deck.path);
    expect(store.resolve(deck, 10)).toBe(0);
    await store.flush();
    expect(adapter.saved.at(-1)?.positions).toEqual({});
  });

  it("uses the last navigation event as the future resume position", async () => {
    const adapter = makeDataAdapter();
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
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
    const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
    await store.initialize();

    expect(adapter.loadCalls).toBe(1);
    expect(store.settings).toEqual({ rememberReadingPosition: false });
    expect(store.resolve(deck, 10)).toBe(0);
    store.record(deck, 3);
    store.rename(deck.path, { ...deck, path: "renamed.pptx" });
    store.delete("renamed.pptx");
    await store.flush();

    expect(adapter.saved).toEqual([]);
  });

  it("immediately saves an empty position set when disabled and starts clean when re-enabled", async () => {
    const adapter = makeDataAdapter();
    const store = new ReadingPositionStore(adapter, { debounceMs: 60_000 });
    await store.initialize();
    store.record(deck, 7);

    await store.setRememberReadingPosition(false);
    expect(adapter.saved.at(-1)).toEqual({
      schemaVersion: 1,
      settings: { rememberReadingPosition: false },
      positions: {},
    });
    expect(store.resolve(deck, 10)).toBe(0);

    await store.setRememberReadingPosition(true);
    expect(store.settings).toEqual({ rememberReadingPosition: true });
    expect(store.resolve(deck, 10)).toBe(0);
    expect(adapter.saved.at(-1)?.positions).toEqual({});
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
    const store = new ReadingPositionStore(adapter, { debounceMs: 60_000 });
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

  it("flushes the latest entry when disposed", async () => {
    const adapter = makeDataAdapter();
    const store = new ReadingPositionStore(adapter, { debounceMs: 60_000 });
    await store.initialize();
    store.record(deck, 2);
    store.record(deck, 6);

    await store.dispose();

    expect(adapter.saved).toHaveLength(1);
    expect(adapter.saved[0]?.positions[deck.path]?.slideIndex).toBe(6);
  });
});
