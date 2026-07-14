import { PptxViewerController } from "../src/pptx-viewer-controller";
import { RenderTaskQueue } from "../src/render-task-queue";
import type { PptxRendererSession } from "../src/renderer/pptx-renderer-adapter";

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
  overrides: Partial<PptxRendererSession> = {},
): PptxRendererSession {
  return {
    capabilities: { prefetch: true, thumbnails: true, zoom: true },
    dispose: vi.fn(),
    prefetchSlide: vi.fn().mockResolvedValue(undefined),
    renderSlide: vi.fn().mockResolvedValue(undefined),
    setZoomPercent: vi.fn().mockResolvedValue(undefined),
    slideCount: 10,
    slideHeight: 540,
    slideWidth: 960,
    ...overrides,
  };
}

function createSink() {
  return {
    commitSlide: vi.fn(),
    commitZoom: vi.fn(),
    reportActionFailure: vi.fn(),
    reportNavigationFailure: vi.fn(),
    setNavigationPending: vi.fn(),
  };
}

describe("PptxViewerController", () => {
  it("renders and commits the restored slide before scheduling adjacent prefetch", async () => {
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const enqueue = vi.spyOn(queue, "enqueue");
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 7,
    });

    await controller.start();

    expect(renderer.renderSlide).toHaveBeenCalledTimes(1);
    expect(renderer.renderSlide).toHaveBeenCalledWith(7);
    expect(sink.commitSlide).toHaveBeenCalledWith(7);
    expect(controller.state).toEqual({
      currentSlideIndex: 7,
      disposed: false,
      navigationPending: false,
      zoomMode: "fit",
      zoomPercent: 100,
    });
    expect(enqueue.mock.calls.map(([task]) => task.key)).toEqual([
      "prefetch:6",
      "prefetch:8",
    ]);
    expect(enqueue.mock.calls.map(([task]) => task.priority)).toEqual([0, 0]);
    expect(
      sink.commitSlide.mock.invocationCallOrder[0],
    ).toBeLessThan(enqueue.mock.invocationCallOrder[0] ?? Infinity);
    await queue.whenIdle();
  });

  it("makes start idempotent and clamps an invalid restored index", async () => {
    const renderer = createRenderer({ slideCount: 3 });
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 99,
    });

    await Promise.all([controller.start(), controller.start()]);

    expect(renderer.renderSlide).toHaveBeenCalledTimes(1);
    expect(renderer.renderSlide).toHaveBeenCalledWith(2);
    expect(sink.commitSlide).toHaveBeenCalledWith(2);
    await queue.whenIdle();
  });

  it("serializes navigation requested while the initial restored render is pending", async () => {
    const initial = deferred<void>();
    const navigation = deferred<void>();
    const renderer = createRenderer();
    vi.mocked(renderer.renderSlide)
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => navigation.promise);
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 1,
    });

    const starting = controller.start();
    const moving = controller.navigate(2);
    await Promise.resolve();

    expect(renderer.renderSlide).toHaveBeenCalledTimes(1);
    expect(renderer.renderSlide).toHaveBeenCalledWith(1);
    expect(controller.state.navigationPending).toBe(true);

    initial.resolve();
    await starting;
    await Promise.resolve();
    expect(renderer.renderSlide).toHaveBeenCalledTimes(2);
    expect(renderer.renderSlide).toHaveBeenLastCalledWith(2);
    expect(controller.state.navigationPending).toBe(true);

    navigation.resolve();
    await moving;
    expect(sink.commitSlide.mock.calls).toEqual([[1], [2]]);
    expect(controller.state.navigationPending).toBe(false);
    await queue.whenIdle();
  });

  it("serializes navigation, commits atomically, and keeps pending true until queued work settles", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const renderer = createRenderer();
    vi.mocked(renderer.renderSlide)
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 0,
    });
    await controller.start();
    sink.commitSlide.mockClear();
    sink.setNavigationPending.mockClear();

    const toOne = controller.navigate(1);
    const toTwo = controller.navigate(2);
    await Promise.resolve();

    expect(renderer.renderSlide).toHaveBeenCalledTimes(2);
    expect(sink.commitSlide).not.toHaveBeenCalled();
    expect(controller.state.navigationPending).toBe(true);
    expect(sink.setNavigationPending.mock.calls).toEqual([[true]]);

    first.resolve();
    await toOne;
    expect(sink.commitSlide).toHaveBeenLastCalledWith(1);
    expect(renderer.renderSlide).toHaveBeenCalledTimes(3);
    expect(controller.state.navigationPending).toBe(true);

    second.resolve();
    await toTwo;
    expect(sink.commitSlide.mock.calls).toEqual([[1], [2]]);
    expect(controller.state).toMatchObject({
      currentSlideIndex: 2,
      navigationPending: false,
    });
    expect(sink.setNavigationPending.mock.calls).toEqual([[true], [false]]);
    await queue.whenIdle();
  });

  it("does not render for boundaries, non-integers, or the current slide", async () => {
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 0,
    });
    await controller.start();
    vi.mocked(renderer.renderSlide).mockClear();
    sink.setNavigationPending.mockClear();

    await controller.navigate(-1);
    await controller.navigate(10);
    await controller.navigate(0.5);
    await controller.navigate(Number.NaN);
    await controller.navigate(0);

    expect(renderer.renderSlide).not.toHaveBeenCalled();
    expect(sink.setNavigationPending).not.toHaveBeenCalled();
    await queue.whenIdle();
  });

  it("reports navigation failure, retains the readable slide, and allows later navigation", async () => {
    const renderer = createRenderer();
    vi.mocked(renderer.renderSlide)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("broken slide"))
      .mockResolvedValueOnce(undefined);
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 4,
    });
    await controller.start();
    sink.commitSlide.mockClear();

    await expect(controller.navigate(5)).resolves.toBeUndefined();

    expect(sink.reportNavigationFailure).toHaveBeenCalledWith(5);
    expect(sink.commitSlide).not.toHaveBeenCalled();
    expect(controller.state.currentSlideIndex).toBe(4);

    await controller.navigate(6);
    expect(sink.commitSlide).toHaveBeenCalledWith(6);
    expect(controller.state.currentSlideIndex).toBe(6);
    await queue.whenIdle();
  });

  it("cancels only obsolete prefetch work and schedules new neighbors nearest-first", async () => {
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const cancelMatching = vi.spyOn(queue, "cancelMatching");
    const enqueue = vi.spyOn(queue, "enqueue");
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 7,
    });
    await controller.start();
    enqueue.mockClear();
    cancelMatching.mockClear();

    await controller.navigate(8);

    expect(cancelMatching).toHaveBeenCalledTimes(1);
    const predicate = cancelMatching.mock.calls[0]?.[0];
    expect(predicate?.("prefetch:6")).toBe(true);
    expect(predicate?.("thumbnail:6")).toBe(false);
    expect(enqueue.mock.calls.map(([task]) => task.key)).toEqual([
      "prefetch:7",
      "prefetch:9",
    ]);
    expect(enqueue.mock.calls.map(([task]) => task.priority)).toEqual([0, 0]);
    await queue.whenIdle();
  });

  it("contains prefetch rejections without reporting or rejecting navigation", async () => {
    const renderer = createRenderer({
      prefetchSlide: vi.fn().mockRejectedValue(new Error("prefetch failed")),
    });
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 0,
    });

    await expect(controller.start()).resolves.toBeUndefined();
    await queue.whenIdle();

    expect(sink.reportNavigationFailure).not.toHaveBeenCalled();
    expect(sink.reportActionFailure).not.toHaveBeenCalled();
  });

  it("supports manual zoom in 25-point steps, clamps it, and resets to fit", async () => {
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 0,
    });

    await controller.zoomIn();
    expect(renderer.setZoomPercent).toHaveBeenLastCalledWith(125);
    expect(controller.state).toMatchObject({ zoomMode: "manual", zoomPercent: 125 });
    expect(sink.commitZoom).toHaveBeenLastCalledWith("manual", 125);

    for (let index = 0; index < 20; index += 1) await controller.zoomIn();
    expect(controller.state.zoomPercent).toBe(400);
    expect(renderer.setZoomPercent).toHaveBeenLastCalledWith(400);

    for (let index = 0; index < 20; index += 1) await controller.zoomOut();
    expect(controller.state).toMatchObject({ zoomMode: "manual", zoomPercent: 25 });
    expect(renderer.setZoomPercent).toHaveBeenLastCalledWith(25);

    await controller.resetToFit();
    expect(renderer.setZoomPercent).toHaveBeenLastCalledWith(100);
    expect(controller.state).toMatchObject({ zoomMode: "fit", zoomPercent: 100 });
    expect(sink.commitZoom).toHaveBeenLastCalledWith("fit", 100);
    await queue.whenIdle();
  });

  it("reports unavailable zoom locally without calling an absent optional method", async () => {
    const renderer = createRenderer({
      capabilities: { prefetch: true, thumbnails: true, zoom: false },
      setZoomPercent: undefined,
    });
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 0,
    });

    await expect(controller.zoomIn()).resolves.toBeUndefined();
    await expect(controller.resetToFit()).resolves.toBeUndefined();

    expect(sink.reportActionFailure).toHaveBeenCalledTimes(2);
    expect(sink.reportActionFailure).toHaveBeenCalledWith(
      "Zoom is not supported by this renderer.",
    );
    expect(controller.state).toMatchObject({ zoomMode: "fit", zoomPercent: 100 });
    await queue.whenIdle();
  });

  it("retains the prior zoom after a renderer failure and serializes concurrent zoom actions", async () => {
    const zoomOne = deferred<void>();
    const zoomTwo = deferred<void>();
    const renderer = createRenderer();
    vi.mocked(renderer.setZoomPercent!)
      .mockImplementationOnce(() => zoomOne.promise)
      .mockImplementationOnce(() => zoomTwo.promise)
      .mockRejectedValueOnce(new Error("zoom failed"));
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 0,
    });

    const first = controller.zoomIn();
    const second = controller.zoomIn();
    await Promise.resolve();
    expect(renderer.setZoomPercent).toHaveBeenCalledTimes(1);
    expect(renderer.setZoomPercent).toHaveBeenLastCalledWith(125);

    zoomOne.resolve();
    await first;
    await Promise.resolve();
    expect(renderer.setZoomPercent).toHaveBeenCalledTimes(2);
    expect(renderer.setZoomPercent).toHaveBeenLastCalledWith(150);
    zoomTwo.resolve();
    await second;

    await controller.zoomOut();
    expect(sink.reportActionFailure).toHaveBeenCalledWith(
      "Unable to change zoom.",
    );
    expect(controller.state).toMatchObject({ zoomMode: "manual", zoomPercent: 150 });
    await queue.whenIdle();
  });

  it("ignores stale completions and post-disposal actions while settling pending truth", async () => {
    const navigation = deferred<void>();
    const renderer = createRenderer();
    vi.mocked(renderer.renderSlide)
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => navigation.promise);
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const cancelMatching = vi.spyOn(queue, "cancelMatching");
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 1,
    });
    await controller.start();
    sink.commitSlide.mockClear();
    sink.reportNavigationFailure.mockClear();
    sink.setNavigationPending.mockClear();
    cancelMatching.mockClear();

    const pending = controller.navigate(2);
    await Promise.resolve();
    controller.dispose();
    controller.dispose();
    navigation.resolve();
    await pending;

    expect(controller.state).toMatchObject({
      currentSlideIndex: 1,
      disposed: true,
      navigationPending: false,
    });
    expect(sink.commitSlide).not.toHaveBeenCalled();
    expect(sink.reportNavigationFailure).not.toHaveBeenCalled();
    expect(sink.setNavigationPending.mock.calls).toEqual([[true], [false]]);
    expect(cancelMatching).toHaveBeenCalledTimes(2);
    for (const [predicate] of cancelMatching.mock.calls) {
      expect(predicate("prefetch:1")).toBe(true);
      expect(predicate("thumbnail:1")).toBe(false);
    }

    await controller.navigate(3);
    await controller.zoomIn();
    await controller.resetToFit();
    expect(renderer.renderSlide).toHaveBeenCalledTimes(2);
    expect(renderer.setZoomPercent).not.toHaveBeenCalled();
    await queue.whenIdle();
  });

  it("does not start a queued initial render after synchronous disposal", async () => {
    const renderer = createRenderer();
    const queue = new RenderTaskQueue();
    const sink = createSink();
    const controller = new PptxViewerController(renderer, queue, sink, {
      initialSlideIndex: 1,
    });

    const starting = controller.start();
    controller.dispose();
    await starting;

    expect(renderer.renderSlide).not.toHaveBeenCalled();
    expect(sink.setNavigationPending).not.toHaveBeenCalled();
    expect(sink.commitSlide).not.toHaveBeenCalled();
    expect(controller.state.disposed).toBe(true);
    await queue.whenIdle();
  });
});
