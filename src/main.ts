import { Plugin } from "obsidian";
import { PptxFileView, PPTX_VIEW_TYPE } from "./pptx-file-view";

export default class OfficeViewerPlugin extends Plugin {
  private readonly views = new Set<PptxFileView>();

  override onload(): void {
    this.registerView(PPTX_VIEW_TYPE, (leaf) => {
      let view: PptxFileView;
      view = new PptxFileView(leaf, () => this.views.delete(view));
      this.views.add(view);
      return view;
    });
    this.registerExtensions(["pptx"], PPTX_VIEW_TYPE);
  }

  override onunload(): void {
    for (const view of [...this.views]) view.dispose();
    this.views.clear();
  }
}
