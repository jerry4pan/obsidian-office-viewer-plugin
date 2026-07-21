import {
  OfficeViewerDataStore,
  type OfficeViewerDataAdapter,
  type OfficeViewerData,
} from "../src/office-viewer-data-store";
import {
  PresentationCompanionNoteService,
  type CompanionNoteVault,
  type CompanionVaultEntryKind,
} from "../src/presentation-companion-note-service";

function clone(data: OfficeViewerData): OfficeViewerData {
  return structuredClone(data);
}

function makeDataAdapter(loaded?: unknown): OfficeViewerDataAdapter & {
  saved: OfficeViewerData[];
} {
  return {
    saved: [],
    async loadData() {
      return loaded;
    },
    async saveData(data) {
      this.saved.push(clone(data));
    },
  };
}

class MemoryCompanionVault implements CompanionNoteVault {
  readonly files = new Map<string, { kind: "markdown" | "file"; content: string }>();
  readonly folders = new Set<string>();
  renameCalls: Array<{ from: string; to: string }> = [];
  createFailures = new Set<string>();
  renameFailures = new Set<string>();

  kind(path: string): CompanionVaultEntryKind {
    if (this.folders.has(path)) return "folder";
    const file = this.files.get(path);
    if (file === undefined) return "missing";
    return file.kind;
  }

  hasMarkdown(path: string): boolean {
    return this.files.get(path)?.kind === "markdown";
  }

  hasPptx(path: string): boolean {
    return this.files.get(path)?.kind === "file" && path.endsWith(".pptx");
  }

  async create(path: string, content: string): Promise<void> {
    if (this.createFailures.has(path)) {
      throw new Error(`create failed: ${path}`);
    }
    if (this.kind(path) !== "missing") {
      throw new Error(`path occupied: ${path}`);
    }
    this.files.set(path, { kind: "markdown", content });
  }

  async rename(fromPath: string, toPath: string): Promise<void> {
    this.renameCalls.push({ from: fromPath, to: toPath });
    if (this.renameFailures.has(fromPath)) {
      throw new Error(`rename failed: ${fromPath}`);
    }
    if (this.kind(toPath) !== "missing") {
      throw new Error(`target occupied: ${toPath}`);
    }
    const file = this.files.get(fromPath);
    if (file === undefined) {
      throw new Error(`missing: ${fromPath}`);
    }
    this.files.delete(fromPath);
    this.files.set(toPath, file);
  }

  putMarkdown(path: string, content: string): void {
    this.files.set(path, { kind: "markdown", content });
  }

  putFile(path: string): void {
    this.files.set(path, { kind: "file", content: "" });
  }

  putFolder(path: string): void {
    this.folders.add(path);
  }
}

async function makeService(options?: {
  loaded?: unknown;
  vault?: MemoryCompanionVault;
}): Promise<{
  service: PresentationCompanionNoteService;
  store: OfficeViewerDataStore;
  vault: MemoryCompanionVault;
  adapter: ReturnType<typeof makeDataAdapter>;
}> {
  const adapter = makeDataAdapter(options?.loaded);
  const store = new OfficeViewerDataStore(adapter, { debounceMs: 0 });
  await store.initialize();
  const vault = options?.vault ?? new MemoryCompanionVault();
  const service = new PresentationCompanionNoteService(store, vault);
  return { service, store, vault, adapter };
}

describe("PresentationCompanionNoteService", () => {
  it("creates a minimal companion note and claims the relationship", async () => {
    const { service, store, vault, adapter } = await makeService();
    vault.putFile("Talks/deck.pptx");

    const result = await service.ensureCompanionNote("Talks/deck.pptx");

    expect(result).toEqual({
      status: "created",
      notePath: "Talks/deck.md",
      conflict: false,
    });
    expect(vault.files.get("Talks/deck.md")?.content).toBe(
      "# deck\n\n[[Talks/deck.pptx]]\n",
    );
    expect(store.getCompanionNote("Talks/deck.pptx")).toEqual({
      sourcePath: "Talks/deck.pptx",
      notePath: "Talks/deck.md",
    });
    await store.flush();
    expect(JSON.stringify(adapter.saved.at(-1))).not.toMatch(/# deck\n/);
    expect(adapter.saved.at(-1)?.companionNotes["Talks/deck.pptx"]).toEqual({
      sourcePath: "Talks/deck.pptx",
      notePath: "Talks/deck.md",
    });
  });

  it("adopts an existing Markdown file without changing its bytes", async () => {
    const { service, vault } = await makeService();
    vault.putFile("deck.pptx");
    const existing = "# existing note\n\nkeep me\n";
    vault.putMarkdown("deck.md", existing);

    const result = await service.ensureCompanionNote("deck.pptx");

    expect(result).toEqual({
      status: "adopted",
      notePath: "deck.md",
      conflict: false,
    });
    expect(vault.files.get("deck.md")?.content).toBe(existing);
  });

  it("refuses to create when the canonical path is a non-Markdown file or folder", async () => {
    const { service, vault, store } = await makeService();
    vault.putFile("deck.pptx");
    vault.putFile("deck.md"); // non-markdown file occupying .md path name — wait, putFile stores as file kind

    const occupiedFile = await service.ensureCompanionNote("deck.pptx");
    expect(occupiedFile.status).toBe("target-occupied");
    expect(store.getCompanionNote("deck.pptx")).toBeUndefined();

    const vault2 = new MemoryCompanionVault();
    vault2.putFile("talk.pptx");
    vault2.putFolder("talk.md");
    const { service: service2, store: store2 } = await makeService({ vault: vault2 });
    const occupiedFolder = await service2.ensureCompanionNote("talk.pptx");
    expect(occupiedFolder.status).toBe("target-occupied");
    expect(store2.getCompanionNote("talk.pptx")).toBeUndefined();
  });

  it("coalesces concurrent ensure requests into one note and one relationship", async () => {
    const { service, vault, store } = await makeService();
    vault.putFile("race.pptx");

    const [first, second] = await Promise.all([
      service.ensureCompanionNote("race.pptx"),
      service.ensureCompanionNote("race.pptx"),
    ]);

    expect("notePath" in first && first.notePath).toBe("race.md");
    expect("notePath" in second && second.notePath).toBe("race.md");
    expect([...vault.files.keys()].filter((path) => path.endsWith(".md"))).toEqual([
      "race.md",
    ]);
    expect(store.listCompanionNotes()).toEqual([
      { sourcePath: "race.pptx", notePath: "race.md" },
    ]);
  });

  it("migrates the claimed note when the PPTX is renamed to a free target", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("old.pptx");
    vault.putMarkdown("old.md", "# old\n");
    store.setCompanionNote({ sourcePath: "old.pptx", notePath: "old.md" });

    await service.handleSourceRename("old.pptx", "folder/new.pptx");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(vault.renameCalls).toEqual([{ from: "old.md", to: "folder/new.md" }]);
    expect(store.getCompanionNote("folder/new.pptx")).toEqual({
      sourcePath: "folder/new.pptx",
      notePath: "folder/new.md",
    });
    expect(store.getCompanionNote("old.pptx")).toBeUndefined();
  });

  it("records a path conflict when the migration target is occupied", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("a.pptx");
    vault.putMarkdown("a.md", "# claimed\n");
    vault.putMarkdown("b.md", "# occupant\n");
    store.setCompanionNote({ sourcePath: "a.pptx", notePath: "a.md" });

    await service.handleSourceRename("a.pptx", "b.pptx");

    expect(vault.renameCalls).toEqual([]);
    expect(vault.files.get("a.md")?.content).toBe("# claimed\n");
    expect(vault.files.get("b.md")?.content).toBe("# occupant\n");
    expect(store.getCompanionNote("b.pptx")).toEqual({
      sourcePath: "b.pptx",
      notePath: "a.md",
    });
    expect(service.isPathConflict("b.pptx")).toBe(true);

    const opened = await service.ensureCompanionNote("b.pptx");
    expect(opened).toEqual({
      status: "opened",
      notePath: "a.md",
      conflict: true,
    });
  });

  it("repairs a conflict on the next explicit open after the target is freed", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("b.pptx");
    vault.putMarkdown("a.md", "# claimed\n");
    store.setCompanionNote({ sourcePath: "b.pptx", notePath: "a.md" });

    const repaired = await service.ensureCompanionNote("b.pptx");

    expect(repaired).toEqual({
      status: "migrated",
      notePath: "b.md",
      conflict: false,
    });
    expect(vault.files.get("b.md")?.content).toBe("# claimed\n");
    expect(store.getCompanionNote("b.pptx")).toEqual({
      sourcePath: "b.pptx",
      notePath: "b.md",
    });
  });

  it("does not detach when a plugin-initiated note migration rename is observed", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("deck.pptx");
    vault.putMarkdown("deck.md", "# note\n");
    store.setCompanionNote({ sourcePath: "deck.pptx", notePath: "deck.md" });

    await service.handleSourceRename("deck.pptx", "renamed.pptx");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await service.handleNoteRename("deck.md", "renamed.md");

    expect(store.getCompanionNote("renamed.pptx")).toEqual({
      sourcePath: "renamed.pptx",
      notePath: "renamed.md",
    });
  });

  it("detaches when the claimed note is independently renamed", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("deck.pptx");
    vault.putMarkdown("elsewhere.md", "# note\n");
    store.setCompanionNote({ sourcePath: "deck.pptx", notePath: "deck.md" });

    await service.handleNoteRename("deck.md", "elsewhere.md");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(store.getCompanionNote("deck.pptx")).toBeUndefined();
    expect(vault.files.has("deck.pptx")).toBe(true);
  });

  it("keeps the relationship when a folder co-move renames both endpoints", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("Archive/a.pptx");
    vault.putMarkdown("Archive/a.md", "# note\n");
    store.setCompanionNote({ sourcePath: "Talks/a.pptx", notePath: "Talks/a.md" });

    await service.handleNoteRename("Talks/a.md", "Archive/a.md");
    await service.handleSourceRename("Talks/a.pptx", "Archive/a.pptx");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(store.getCompanionNote("Archive/a.pptx")).toEqual({
      sourcePath: "Archive/a.pptx",
      notePath: "Archive/a.md",
    });
  });

  it("converges chained source renames onto the final path", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("c.pptx");
    vault.putMarkdown("a.md", "# note\n");
    store.setCompanionNote({ sourcePath: "a.pptx", notePath: "a.md" });

    const first = service.handleSourceRename("a.pptx", "b.pptx");
    const second = service.handleSourceRename("b.pptx", "c.pptx");
    await Promise.all([first, second]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(store.getCompanionNote("a.pptx")).toBeUndefined();
    expect(store.getCompanionNote("b.pptx")).toBeUndefined();
    expect(store.getCompanionNote("c.pptx")).toEqual({
      sourcePath: "c.pptx",
      notePath: "c.md",
    });
    expect(vault.files.get("c.md")?.content).toBe("# note\n");
  });

  it("detaches on source or note deletion without cascading", async () => {
    const { service, store, vault } = await makeService();
    vault.putFile("deck.pptx");
    vault.putMarkdown("deck.md", "# note\n");
    store.setCompanionNote({ sourcePath: "deck.pptx", notePath: "deck.md" });

    await service.handleDelete("deck.pptx");
    expect(store.getCompanionNote("deck.pptx")).toBeUndefined();
    expect(vault.files.get("deck.md")?.content).toBe("# note\n");

    store.setCompanionNote({ sourcePath: "deck.pptx", notePath: "deck.md" });
    await service.handleDelete("deck.md");
    expect(store.getCompanionNote("deck.pptx")).toBeUndefined();
    expect(vault.files.has("deck.pptx")).toBe(true);
  });

  it("reconciles by detaching pairs whose endpoints are missing", async () => {
    const vault = new MemoryCompanionVault();
    vault.putFile("good.pptx");
    vault.putMarkdown("good.md", "# ok\n");
    const { service, store } = await makeService({
      vault,
      loaded: {
        schemaVersion: 2,
        settings: {
          rememberReadingPosition: true,
          diagnosticSummary: false,
          thumbnailRailWidth: 168,
        },
        positions: {},
        companionNotes: {
          "good.pptx": { sourcePath: "good.pptx", notePath: "good.md" },
          "missing-source.pptx": {
            sourcePath: "missing-source.pptx",
            notePath: "missing-source.md",
          },
          "missing-note.pptx": {
            sourcePath: "missing-note.pptx",
            notePath: "missing-note.md",
          },
        },
      },
    });
    vault.putFile("missing-note.pptx");

    service.reconcile();

    expect(store.listCompanionNotes()).toEqual([
      { sourcePath: "good.pptx", notePath: "good.md" },
    ]);
  });
});
