import type {
  PptxRendererResource,
  PptxRendererSession,
} from "../src/renderer/pptx-renderer-adapter";
import { RenderTaskQueue } from "../src/render-task-queue";
import { ThumbnailRail } from "../src/thumbnail-rail";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createRenderer(
  renderThumbnail?: (
    index: number,
    container: HTMLElement,
    signal: AbortSignal,
  ) => PptxRendererResource,
) {
  const renderSlide = vi.fn(async (_index: number): Promise<void> => undefined);
  const renderThumbnailMock = vi.fn(
    renderThumbnail ??
      ((index: number, container: HTMLElement) => {
        container.textContent = `Preview ${index + 1}`;
        return { ready: Promise.resolve(), dispose: vi.fn() };
      }),
  );
  return {
    capabilities: { thumbnails: true, prefetch: true, zoom: true },
    dispose: vi.fn(),
    renderSlide,
    renderThumbnail: renderThumbnailMock,
    slideCount: 200,
    slideHeight: 540,
    slideWidth: 960,
  } satisfies PptxRendererSession;
}

function createRoot(clientHeight = 550): HTMLElement {
  const root = document.createElement("div");
  Object.defineProperty(root, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  document.body.append(root);
  return root;
}

function mountedIndices(root: HTMLElement): number[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('[data-action="thumbnail-slide"]'),
    (item) => Number(item.dataset.slideIndex),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("ThumbnailRail", () => {
  it("mounts a bounded, accessible window for a 200-slide deck", () => {
    const root = createRoot();
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
      thumbnailWidth: 144,
      overscanViewports: 1,
    });

    rail.start(0);

    expect(root.getAttribute("role")).toBe("navigation");
    expect(root.getAttribute("aria-label")).toBe("Slide thumbnails");
    expect(root.querySelectorAll('[data-action="thumbnail-slide"]')).toHaveLength(
      rail.mountedCount,
    );
    expect(rail.mountedCount).toBeGreaterThan(0);
    expect(rail.mountedCount).toBeLessThan(200);
    expect(root.querySelector('[aria-current="page"]')?.getAttribute("aria-label"))
      .toBe("Slide 1");
    expect(root.querySelectorAll('[data-thumbnail-spacer="true"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-thumbnail-mounted-layer="true"]')).toHaveLength(1);
    expect(renderer.renderSlide).not.toHaveBeenCalled();

    rail.dispose();
    queue.dispose();
  });

  it("replaces the mounted window on scroll without mounting the whole deck", () => {
    const root = createRoot();
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
      thumbnailWidth: 144,
      overscanViewports: 1,
    });
    rail.start(0);
    const initial = mountedIndices(root);

    root.scrollTop = 14_000;
    root.dispatchEvent(new Event("scroll"));
    const afterScroll = mountedIndices(root);

    expect(afterScroll).not.toEqual(initial);
    expect(afterScroll.every((index) => index > 50)).toBe(true);
    expect(afterScroll.length).toBeLessThan(200);

    rail.dispose();
    queue.dispose();
  });

  it("routes thumbnail clicks through the zero-based navigation callback", () => {
    const root = createRoot();
    const queue = new RenderTaskQueue();
    const onNavigate = vi.fn();
    const rail = new ThumbnailRail(root, createRenderer(), queue, { onNavigate });
    rail.start(0);

    root.querySelector<HTMLButtonElement>('[data-slide-index="2"]')!.click();

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(2);

    rail.dispose();
    queue.dispose();
  });

  it("scrolls a newly selected slide into the mounted window and marks only it current", () => {
    const root = createRoot();
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, createRenderer(), queue, {
      onNavigate: vi.fn(),
    });
    rail.start(0);

    rail.setCurrentSlide(150);

    expect(root.scrollTop).toBeGreaterThan(0);
    expect(mountedIndices(root)).toContain(150);
    const current = root.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("aria-label")).toBe("Slide 151");

    rail.dispose();
    queue.dispose();
  });

  it("queues visible thumbnails ahead of overscan-only thumbnails", () => {
    const root = createRoot();
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const enqueue = vi.spyOn(queue, "enqueue");
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
      overscanViewports: 1,
    });

    rail.start(0);

    const tasks = enqueue.mock.calls.map(([task]) => ({
      key: task.key,
      priority: task.priority,
    }));
    expect(tasks.some((task) => task.priority === 1)).toBe(true);
    expect(tasks.some((task) => task.priority === 2)).toBe(true);
    expect(tasks.filter((task) => task.priority === 1).every((task) => {
      const index = Number(task.key.split(":")[1]);
      return index < tasks.filter((candidate) => candidate.priority === 2)
        .map((candidate) => Number(candidate.key.split(":")[1]))
        .reduce((minimum, index) => Math.min(minimum, index), Number.POSITIVE_INFINITY);
    })).toBe(true);

    rail.dispose();
    queue.dispose();
  });

  it("isolates one thumbnail failure and retries it after the item is remounted", async () => {
    const root = createRoot();
    let firstAttempt = true;
    const renderer = createRenderer((index, container) => {
      if (index === 0 && firstAttempt) {
        firstAttempt = false;
        return {
          ready: Promise.reject(new Error("broken preview")),
          dispose: vi.fn(),
        };
      }
      container.textContent = `Preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
    });
    rail.start(0);
    await queue.whenIdle();

    expect(root.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Slide 1 preview unavailable");
    expect(renderer.renderSlide).not.toHaveBeenCalled();

    root.scrollTop = 20_000;
    rail.refresh();
    root.scrollTop = 0;
    rail.refresh();
    await queue.whenIdle();

    expect(renderer.renderThumbnail.mock.calls.filter(([index]) => index === 0))
      .toHaveLength(2);
    expect(root.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Preview 1");

    rail.dispose();
    queue.dispose();
  });

  it("aborts pending work and disposes its acquired resource when an item unmounts", async () => {
    const root = createRoot();
    const pending = deferred<void>();
    const disposed = vi.fn();
    let capturedSignal: AbortSignal | undefined;
    const renderer = createRenderer((index, _container, signal) => {
      if (index === 0) {
        capturedSignal = signal;
        return { ready: pending.promise, dispose: disposed };
      }
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
    });
    rail.start(0);
    await Promise.resolve();

    root.scrollTop = 20_000;
    rail.refresh();

    expect(capturedSignal?.aborted).toBe(true);
    expect(disposed).toHaveBeenCalledTimes(1);
    pending.reject(new DOMException("aborted", "AbortError"));

    rail.dispose();
    queue.dispose();
    await queue.whenIdle();
  });

  it("starts a fresh render when an item remounts before its canceled attempt settles", async () => {
    const root = createRoot();
    const firstReady = deferred<void>();
    let slideZeroAttempts = 0;
    const renderer = createRenderer((index, container, signal) => {
      if (index === 0 && slideZeroAttempts++ === 0) {
        signal.addEventListener(
          "abort",
          () => firstReady.reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
        return { ready: firstReady.promise, dispose: vi.fn() };
      }
      container.textContent = `Fresh preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
    });
    rail.start(0);
    await Promise.resolve();

    root.scrollTop = 20_000;
    rail.refresh();
    root.scrollTop = 0;
    rail.refresh();
    await queue.whenIdle();

    expect(renderer.renderThumbnail.mock.calls.filter(([index]) => index === 0))
      .toHaveLength(2);
    expect(root.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Fresh preview 1");

    rail.dispose();
    queue.dispose();
  });

  it("requeues retained pending work when it moves from overscan into view", async () => {
    const root = createRoot(100);
    const blocker = deferred<void>();
    let blockerSignal: AbortSignal | undefined;
    const renderer = createRenderer((index, container, signal) => {
      if (index === 0) {
        blockerSignal = signal;
        signal.addEventListener(
          "abort",
          () => blocker.reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
        return { ready: blocker.promise, dispose: vi.fn() };
      }
      container.textContent = `Preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const enqueue = vi.spyOn(queue, "enqueue");
    const cancel = vi.spyOn(queue, "cancel");
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
      overscanViewports: 1,
    });
    rail.start(0);
    await Promise.resolve();

    const firstSlideOneTask = enqueue.mock.calls
      .map(([task]) => task)
      .find((task) => task.key.startsWith("thumbnail:1"));
    expect(firstSlideOneTask?.priority).toBe(2);
    if (firstSlideOneTask === undefined) {
      throw new Error("Expected the first overscan task for slide 2");
    }

    root.scrollTop = 120;
    rail.refresh();

    const slideOneTasks = enqueue.mock.calls
      .map(([task]) => task)
      .filter((task) => task.key.startsWith("thumbnail:1"));
    expect(slideOneTasks).toHaveLength(2);
    expect(slideOneTasks[1]?.priority).toBe(1);
    expect(slideOneTasks[1]?.key).not.toBe(slideOneTasks[0]?.key);
    expect(cancel).toHaveBeenCalledWith(firstSlideOneTask.key);
    expect(blockerSignal?.aborted).toBe(false);

    rail.dispose();
    queue.dispose();
    await queue.whenIdle();
  });

  it("disconnects observation, cancels work, and disposes mounted resources exactly once", async () => {
    const root = createRoot();
    const disconnect = vi.fn();
    const observe = vi.fn();
    const disposers: ReturnType<typeof vi.fn>[] = [];
    const renderer = createRenderer((index, container) => {
      container.textContent = `Preview ${index + 1}`;
      const dispose = vi.fn();
      disposers.push(dispose);
      return { ready: Promise.resolve(), dispose };
    });
    const queue = new RenderTaskQueue();
    const cancelMatching = vi.spyOn(queue, "cancelMatching");
    const rail = new ThumbnailRail(root, renderer, queue, {
      createResizeObserver: () => ({ disconnect, observe }),
      onNavigate: vi.fn(),
    });
    rail.start(0);
    await queue.whenIdle();

    rail.dispose();
    rail.dispose();

    expect(observe).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancelMatching).toHaveBeenCalledWith(expect.any(Function));
    expect(disposers.length).toBeGreaterThan(0);
    expect(disposers.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    expect(rail.mountedCount).toBe(0);
    expect(root.childElementCount).toBe(0);
    expect(renderer.dispose).not.toHaveBeenCalled();

    queue.dispose();
  });

  it("uses the 480px viewport fallback when layout measurement is zero", () => {
    const root = createRoot(0);
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, createRenderer(), queue, {
      onNavigate: vi.fn(),
    });

    rail.start(0);

    expect(rail.mountedCount).toBeGreaterThan(1);
    expect(rail.mountedCount).toBeLessThan(200);

    rail.dispose();
    queue.dispose();
  });

  it("applies the configured thumbnail width to mounted previews", () => {
    const root = createRoot();
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, createRenderer(), queue, {
      onNavigate: vi.fn(),
      thumbnailWidth: 120,
    });

    rail.start(0);

    expect(
      root.querySelector<HTMLElement>(".pptx-viewer__thumbnail-preview")?.style
        .width,
    ).toBe("120px");

    rail.dispose();
    queue.dispose();
  });
});
