export interface RenderedSlideBackup {
  restore(): void;
}

export function captureRenderedSlide(
  container: HTMLElement,
): RenderedSlideBackup {
  const snapshot = container.cloneNode(true) as HTMLElement;
  const sourceCanvases = container.querySelectorAll("canvas");
  const snapshotCanvases = snapshot.querySelectorAll("canvas");

  sourceCanvases.forEach((source, index) => {
    const target = snapshotCanvases.item(index);
    if (!target) {
      throw new Error("The rendered slide canvas could not be captured");
    }
    target.width = source.width;
    target.height = source.height;
    try {
      const context = target.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D context is unavailable");
      }
      context.drawImage(source, 0, 0);
    } catch (error) {
      throw new Error("The rendered slide canvas could not be captured", {
        cause: error,
      });
    }
  });

  return {
    restore(): void {
      container.replaceChildren(...Array.from(snapshot.childNodes));
    },
  };
}
