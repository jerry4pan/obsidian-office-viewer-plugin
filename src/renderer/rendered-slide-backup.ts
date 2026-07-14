export interface RenderedSlideBackup {
  restore(): void;
}

export interface AtomicSlideRenderOptions {
  readonly container: HTMLElement;
  readonly targetIndex: number;
  readonly previousIndex: number | null;
  readonly render: (index: number) => void | Promise<void>;
  readonly assertActive?: () => void;
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

export async function renderSlideAtomically({
  container,
  targetIndex,
  previousIndex,
  render,
  assertActive = () => {},
}: AtomicSlideRenderOptions): Promise<void> {
  assertActive();
  const backup = captureRenderedSlide(container);
  try {
    await render(targetIndex);
  } catch {
    assertActive();
    if (previousIndex !== null) {
      try {
        await render(previousIndex);
      } catch {
        assertActive();
        backup.restore();
      }
    } else {
      backup.restore();
    }
    assertActive();
    throw new Error(
      `The renderer could not display slide ${targetIndex + 1}`,
    );
  }
  assertActive();
}
