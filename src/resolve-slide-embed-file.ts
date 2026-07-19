import { TFile, type App } from "obsidian";

/** Resolve a slide embed relative to its Markdown note through one host-neutral path. */
export function resolveSlideEmbedFile(
  app: App,
  sourcePath: string,
  notePath: string,
): TFile | null {
  const file = app.metadataCache.getFirstLinkpathDest(sourcePath, notePath);
  return file instanceof TFile ? file : null;
}
