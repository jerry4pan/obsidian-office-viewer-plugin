import { RenderTaskQueue } from "../src/render-task-queue";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function expectAbort(error: unknown): void {
  expect(error).toBeInstanceOf(DOMException);
  expect((error as DOMException).name).toBe("AbortError");
}

describe("RenderTaskQueue", () => {
  it("runs one task at a time by priority and FIFO sequence", async () => {
    const queue = new RenderTaskQueue();
    const gate = deferred<void>();
    const order: string[] = [];

    const running = queue.enqueue({
      key: "running",
      priority: 2,
      run: async () => {
        order.push("running:start");
        await gate.promise;
        order.push("running:end");
      },
    });
    const overscanOne = queue.enqueue({
      key: "overscan-1",
      priority: 2,
      run: async () => {
        order.push("overscan-1");
      },
    });
    const adjacentOne = queue.enqueue({
      key: "adjacent-1",
      priority: 0,
      run: async () => {
        order.push("adjacent-1");
      },
    });
    const overscanTwo = queue.enqueue({
      key: "overscan-2",
      priority: 2,
      run: async () => {
        order.push("overscan-2");
      },
    });
    const adjacentTwo = queue.enqueue({
      key: "adjacent-2",
      priority: 0,
      run: async () => {
        order.push("adjacent-2");
      },
    });

    expect(queue.diagnostics).toEqual({ pending: 4, running: 1, disposed: false });
    gate.resolve();
    await Promise.all([running, overscanOne, adjacentOne, overscanTwo, adjacentTwo]);
    await queue.whenIdle();

    expect(order).toEqual([
      "running:start",
      "running:end",
      "adjacent-1",
      "adjacent-2",
      "overscan-1",
      "overscan-2",
    ]);
    expect(queue.maxObservedConcurrency).toBe(1);
    expect(queue.diagnostics).toEqual({ pending: 0, running: 0, disposed: false });
  });

  it("returns the exact existing promise for a duplicate key", async () => {
    const queue = new RenderTaskQueue();
    const gate = deferred<number>();
    const first = queue.enqueue({ key: "thumbnail:4", priority: 1, run: () => gate.promise });
    const duplicate = queue.enqueue({
      key: "thumbnail:4",
      priority: 0,
      run: async () => 99,
    });

    expect(duplicate).toBe(first);
    gate.resolve(4);
    await expect(first).resolves.toBe(4);
  });

  it("cancels pending work by key without running it", async () => {
    const queue = new RenderTaskQueue();
    const gate = deferred<void>();
    const ran: string[] = [];
    const running = queue.enqueue({ key: "running", priority: 0, run: () => gate.promise });
    const canceled = queue.enqueue({
      key: "thumbnail:1",
      priority: 1,
      run: async () => ran.push("thumbnail:1"),
    });
    const canceledResult = canceled.catch((error: unknown) => error);

    queue.cancel("thumbnail:1");
    gate.resolve();
    await running;
    expectAbort(await canceledResult);
    await queue.whenIdle();
    expect(ran).toEqual([]);
  });

  it("cancels all matching pending and running work", async () => {
    const queue = new RenderTaskQueue();
    const runningStarted = deferred<void>();
    const running = queue.enqueue({
      key: "prefetch:1",
      priority: 0,
      run: async (signal) => {
        runningStarted.resolve();
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });
    const pending = queue.enqueue({
      key: "prefetch:2",
      priority: 0,
      run: async () => undefined,
    });
    const retained = queue.enqueue({
      key: "thumbnail:2",
      priority: 1,
      run: async () => "kept",
    });
    const runningResult = running.catch((error: unknown) => error);
    const pendingResult = pending.catch((error: unknown) => error);

    await runningStarted.promise;
    queue.cancelMatching((key) => key.startsWith("prefetch:"));
    expectAbort(await runningResult);
    expectAbort(await pendingResult);
    await expect(retained).resolves.toBe("kept");
    await queue.whenIdle();
  });

  it("disposes a result when cancellation wins the resolution race", async () => {
    const queue = new RenderTaskQueue();
    const gate = deferred<{ id: number }>();
    const disposed: Array<{ id: number }> = [];
    const result = queue.enqueue({
      key: "thumbnail:8",
      priority: 1,
      run: () => gate.promise,
      disposeResult: (value) => disposed.push(value),
    });
    const rejection = result.catch((error: unknown) => error);

    gate.resolve({ id: 8 });
    queue.cancel("thumbnail:8");

    expectAbort(await rejection);
    await queue.whenIdle();
    expect(disposed).toEqual([{ id: 8 }]);
  });

  it("clear aborts all work but leaves the queue reusable", async () => {
    const queue = new RenderTaskQueue();
    const started = deferred<void>();
    const running = queue.enqueue({
      key: "running",
      priority: 0,
      run: async (signal) => {
        started.resolve();
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });
    const pending = queue.enqueue({ key: "pending", priority: 1, run: async () => 1 });
    const runningRejection = running.catch((error: unknown) => error);
    const pendingRejection = pending.catch((error: unknown) => error);

    await started.promise;
    queue.clear();
    expectAbort(await runningRejection);
    expectAbort(await pendingRejection);
    await queue.whenIdle();
    await expect(queue.enqueue({ key: "new", priority: 0, run: async () => 2 })).resolves.toBe(2);
  });

  it("dispose aborts work, is idempotent, and rejects future enqueues", async () => {
    const queue = new RenderTaskQueue();
    const started = deferred<void>();
    const running = queue.enqueue({
      key: "running",
      priority: 0,
      run: async (signal) => {
        started.resolve();
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });
    const rejection = running.catch((error: unknown) => error);

    await started.promise;
    queue.dispose();
    queue.dispose();
    expect(queue.diagnostics.disposed).toBe(true);
    expectAbort(await rejection);
    await queue.whenIdle();
    await expect(
      queue.enqueue({ key: "later", priority: 0, run: async () => undefined }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("whenIdle waits for both pending and running work", async () => {
    const queue = new RenderTaskQueue();
    const firstGate = deferred<void>();
    const secondGate = deferred<void>();
    const first = queue.enqueue({ key: "first", priority: 0, run: () => firstGate.promise });
    const second = queue.enqueue({ key: "second", priority: 0, run: () => secondGate.promise });
    let idle = false;
    const idlePromise = queue.whenIdle().then(() => {
      idle = true;
    });

    await Promise.resolve();
    expect(idle).toBe(false);
    firstGate.resolve();
    await first;
    expect(idle).toBe(false);
    secondGate.resolve();
    await second;
    await idlePromise;
    expect(idle).toBe(true);
  });
});
