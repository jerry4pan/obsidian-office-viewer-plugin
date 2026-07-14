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

function queuedThumbnailIndex(key: string): number {
  const match = /:(\d+):\d+$/.exec(key);
  return match === null ? Number.NaN : Number(match[1]);
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
      const index = queuedThumbnailIndex(task.key);
      return index < tasks.filter((candidate) => candidate.priority === 2)
        .map((candidate) => queuedThumbnailIndex(candidate.key))
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

  it("treats a renderer AbortError with an active signal as an item failure", async () => {
    const root = createRoot();
    let firstAttempt = true;
    const observedSignals: AbortSignal[] = [];
    const renderer = createRenderer((index, container, signal) => {
      if (index === 0 && firstAttempt) {
        firstAttempt = false;
        observedSignals.push(signal);
        return {
          ready: Promise.reject(new DOMException("renderer failed", "AbortError")),
          dispose: vi.fn(),
        };
      }
      container.textContent = `Recovered preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
    });
    rail.start(0);
    await queue.whenIdle();

    expect(observedSignals[0]?.aborted).toBe(false);
    expect(root.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Slide 1 preview unavailable");
    rail.refresh();
    await queue.whenIdle();
    expect(renderer.renderThumbnail.mock.calls.filter(([index]) => index === 0))
      .toHaveLength(1);

    root.scrollTop = 20_000;
    rail.refresh();
    root.scrollTop = 0;
    rail.refresh();
    await queue.whenIdle();
    expect(renderer.renderThumbnail.mock.calls.filter(([index]) => index === 0))
      .toHaveLength(2);
    expect(root.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Recovered preview 1");

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
    const firstDispose = vi.fn();
    let slideZeroAttempts = 0;
    const renderer = createRenderer((index, container) => {
      if (index === 0 && slideZeroAttempts++ === 0) {
        return { ready: new Promise<void>(() => undefined), dispose: firstDispose };
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
    await vi.waitFor(() => {
      expect(renderer.renderThumbnail.mock.calls.filter(([index]) => index === 0))
        .toHaveLength(2);
    });
    await queue.whenIdle();

    expect(root.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Fresh preview 1");
    expect(firstDispose).toHaveBeenCalledTimes(1);

    rail.dispose();
    queue.dispose();
    expect(firstDispose).toHaveBeenCalledTimes(1);
  });

  it("isolates cancellation when two rails share one queue", async () => {
    const firstRoot = createRoot(100);
    const secondRoot = createRoot(100);
    const firstRenderer = createRenderer((_index, _container) => ({
      ready: new Promise<void>(() => undefined),
      dispose: vi.fn(),
    }));
    const secondRenderer = createRenderer((index, container) => {
      container.textContent = `Second rail preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const firstRail = new ThumbnailRail(firstRoot, firstRenderer, queue, {
      onNavigate: vi.fn(),
    });
    const secondRail = new ThumbnailRail(secondRoot, secondRenderer, queue, {
      onNavigate: vi.fn(),
    });
    firstRail.start(0);
    secondRail.start(0);
    await Promise.resolve();

    firstRail.dispose();
    await vi.waitFor(() => {
      expect(secondRenderer.renderThumbnail).toHaveBeenCalled();
    });
    await queue.whenIdle();

    expect(secondRoot.querySelector('[data-slide-index="0"]')?.textContent)
      .toContain("Second rail preview 1");
    expect(secondRail.mountedCount).toBeGreaterThan(0);

    secondRail.dispose();
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
      .find((task) => queuedThumbnailIndex(task.key) === 1);
    expect(firstSlideOneTask?.priority).toBe(2);
    if (firstSlideOneTask === undefined) {
      throw new Error("Expected the first overscan task for slide 2");
    }

    root.scrollTop = 120;
    rail.refresh();

    const slideOneTasks = enqueue.mock.calls
      .map(([task]) => task)
      .filter((task) => queuedThumbnailIndex(task.key) === 1);
    expect(slideOneTasks).toHaveLength(2);
    expect(slideOneTasks[1]?.priority).toBe(1);
    expect(slideOneTasks[1]?.key).not.toBe(slideOneTasks[0]?.key);
    expect(cancel).toHaveBeenCalledWith(firstSlideOneTask.key);
    expect(blockerSignal?.aborted).toBe(false);

    rail.dispose();
    queue.dispose();
    await queue.whenIdle();
  });

  it("treats external cancellation before a mounted task runs as cancellation", async () => {
    const root = createRoot(100);
    const blocker = deferred<void>();
    const renderer = createRenderer((index, container) => {
      if (index === 0) {
        return { ready: blocker.promise, dispose: vi.fn() };
      }
      container.textContent = `Preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    });
    const queue = new RenderTaskQueue();
    const enqueue = vi.spyOn(queue, "enqueue");
    const rail = new ThumbnailRail(root, renderer, queue, {
      onNavigate: vi.fn(),
      overscanViewports: 1,
    });
    rail.start(0);
    await Promise.resolve();

    const pendingKey = enqueue.mock.calls
      .map(([task]) => task)
      .find((task) => queuedThumbnailIndex(task.key) === 1)?.key;
    if (pendingKey === undefined) {
      throw new Error("Expected a pending thumbnail task for slide 2");
    }
    queue.cancel(pendingKey);
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-slide-index="1"]')?.textContent)
      .not.toContain("preview unavailable");
    rail.refresh();
    expect(enqueue.mock.calls
      .map(([task]) => task)
      .filter((task) => queuedThumbnailIndex(task.key) === 1))
      .toHaveLength(2);

    blocker.resolve();
    await queue.whenIdle();
    expect(root.querySelector('[data-slide-index="1"]')?.textContent)
      .toContain("Preview 2");

    rail.dispose();
    queue.dispose();
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

  it("reports live mounted counts for start, resize, scroll, selection, and disposal", () => {
    const root = createRoot(100);
    const queue = new RenderTaskQueue();
    const onMountedCountChange = vi.fn();
    let resize!: ResizeObserverCallback;
    const rail = new ThumbnailRail(root, createRenderer(), queue, {
      createResizeObserver: (callback) => {
        resize = callback;
        return { disconnect: vi.fn(), observe: vi.fn() };
      },
      onMountedCountChange,
      onNavigate: vi.fn(),
    });

    rail.start(0);
    expect(onMountedCountChange).toHaveBeenLastCalledWith(rail.mountedCount);
    const startedCount = rail.mountedCount;

    Object.defineProperty(root, "clientHeight", { configurable: true, value: 600 });
    resize([], {} as ResizeObserver);
    expect(rail.mountedCount).toBeGreaterThan(startedCount);
    expect(onMountedCountChange).toHaveBeenLastCalledWith(rail.mountedCount);

    root.scrollTop = 20_000;
    root.dispatchEvent(new Event("scroll"));
    expect(onMountedCountChange).toHaveBeenLastCalledWith(rail.mountedCount);

    rail.setCurrentSlide(0);
    expect(onMountedCountChange).toHaveBeenLastCalledWith(rail.mountedCount);

    rail.dispose();
    expect(onMountedCountChange).toHaveBeenLastCalledWith(0);
    const callCount = onMountedCountChange.mock.calls.length;
    root.dispatchEvent(new Event("scroll"));
    resize([], {} as ResizeObserver);
    expect(onMountedCountChange).toHaveBeenCalledTimes(callCount);
    queue.dispose();
  });

  it("finishes full cleanup when one renderer resource disposer throws", async () => {
    const root = createRoot();
    const disconnect = vi.fn();
    const throwingDispose = vi.fn(() => {
      throw new Error("candidate cleanup failed");
    });
    const normalDispose = vi.fn();
    const renderer = createRenderer((index, container) => {
      container.textContent = `Preview ${index + 1}`;
      return {
        ready: Promise.resolve(),
        dispose: index === 0 ? throwingDispose : normalDispose,
      };
    });
    const queue = new RenderTaskQueue();
    const rail = new ThumbnailRail(root, renderer, queue, {
      createResizeObserver: () => ({ disconnect, observe: vi.fn() }),
      onNavigate: vi.fn(),
    });
    rail.start(0);
    await queue.whenIdle();

    expect(() => rail.dispose()).not.toThrow();

    expect(throwingDispose).toHaveBeenCalledTimes(1);
    expect(normalDispose).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(rail.mountedCount).toBe(0);
    expect(root.childElementCount).toBe(0);

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
