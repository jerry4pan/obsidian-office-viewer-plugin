import { FileView, type App, type TFile, type WorkspaceLeaf } from "obsidian";
import { PptxViewSession } from "./pptx-view-session";
import { AidenPptxRendererAdapter } from "./renderer/aiden-pptx-renderer-adapter";
import { PreflightPptxRendererAdapter } from "./renderer/preflight-pptx-renderer-adapter";

export const PPTX_VIEW_TYPE = "pptx-viewer";

type DesktopVaultAdapter = {
  getFullPath(path: string): string;
};

function createExternalOpenAction(
  app: App,
): ((file: TFile) => Promise<void>) | undefined {
  const adapter = app.vault.adapter as Partial<DesktopVaultAdapter> | undefined;
  if (!adapter || typeof adapter.getFullPath !== "function") return undefined;
  return async (file) => {
    const { shell } = require("electron") as {
      shell: { openPath(path: string): Promise<string> };
    };
    const failure = await shell.openPath(adapter.getFullPath!(file.path));
    if (failure) throw new Error(failure);
  };
}

export class PptxFileView extends FileView {
  private readonly session: PptxViewSession<TFile>;
  private disposed = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly onDisposed: () => void = () => {},
  ) {
    super(leaf);
    this.contentEl.replaceChildren();
    const root = document.createElement("div");
    this.contentEl.append(root);
    this.session = new PptxViewSession(
      root,
      { readBinary: (file) => this.app.vault.readBinary(file) },
      new PreflightPptxRendererAdapter(new AidenPptxRendererAdapter()),
      { openExternally: createExternalOpenAction(this.app) },
    );
  }

  override getViewType(): string {
    return PPTX_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.basename ?? "PPTX viewer";
  }

  override async onLoadFile(file: TFile): Promise<void> {
    await this.session.open(file);
  }

  override async onClose(): Promise<void> {
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.session.dispose();
    this.contentEl.replaceChildren();
    this.onDisposed();
  }
}
