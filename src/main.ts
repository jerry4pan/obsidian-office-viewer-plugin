import { Plugin } from "obsidian";
import { PptxFileView, PPTX_VIEW_TYPE } from "./pptx-file-view";

export default class OfficeViewerPlugin extends Plugin {
  override onload(): void {
    this.registerView(PPTX_VIEW_TYPE, (leaf) => new PptxFileView(leaf));
    this.registerExtensions(["pptx"], PPTX_VIEW_TYPE);
  }
}
