import { FileView, type TFile, type WorkspaceLeaf } from "obsidian";
import { PptxViewSession } from "./pptx-view-session";
import type { PptxViewSessionDiagnostics } from "./pptx-view-session";
import { AidenPptxRendererAdapter } from "./renderer/aiden-pptx-renderer-adapter";

export const PPTX_VIEW_TYPE = "pptx-viewer";

export class PptxFileView extends FileView {
  private readonly session: PptxViewSession<TFile>;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.contentEl.replaceChildren();
    const root = document.createElement("div");
    this.contentEl.append(root);
    this.session = new PptxViewSession(
      root,
      { readBinary: (file) => this.app.vault.readBinary(file) },
      new AidenPptxRendererAdapter(),
    );
  }

  override getViewType(): string {
    return PPTX_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.basename ?? "PPTX viewer";
  }

  getPerformanceDiagnostics(): PptxViewSessionDiagnostics {
    return this.session.getPerformanceDiagnostics();
  }

  override async onLoadFile(file: TFile): Promise<void> {
    await this.session.open(file);
  }

  override async onClose(): Promise<void> {
    this.session.dispose();
    this.contentEl.replaceChildren();
  }
}
