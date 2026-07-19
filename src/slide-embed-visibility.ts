export type SlideEmbedVisibilityDisposer = () => void;

/**
 * Bind slide rendering to the element's own window and viewport.
 *
 * Obsidian can move leaves into pop-out windows, so constructors from the main
 * window must not own observers for DOM nodes in another document.
 */
export function observeSlideEmbedVisibility(
  host: HTMLElement,
  onVisibilityChange: (visible: boolean) => void,
): SlideEmbedVisibilityDisposer {
  const Observer = host.ownerDocument.defaultView?.IntersectionObserver;
  if (Observer === undefined) {
    onVisibilityChange(true);
    return () => undefined;
  }
  const observer = new Observer((entries) => {
    onVisibilityChange(entries.some((entry) => entry.isIntersecting));
  }, { rootMargin: "600px 0px" });
  observer.observe(host);
  return () => observer.disconnect();
}
