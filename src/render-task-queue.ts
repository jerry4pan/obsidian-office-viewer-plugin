export interface RenderTask<T> {
  readonly key: string;
  readonly priority: number;
  readonly run: (signal: AbortSignal) => Promise<T>;
  readonly disposeResult?: (result: T) => void;
}

type EntryState = "pending" | "running" | "settled";

interface QueueEntry<T = unknown> {
  readonly controller: AbortController;
  readonly key: string;
  readonly priority: number;
  readonly promise: Promise<T>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly sequence: number;
  readonly task: RenderTask<T>;
  canceled: boolean;
  state: EntryState;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export class RenderTaskQueue {
  private readonly entries = new Map<string, QueueEntry>();
  private readonly idleWaiters = new Set<() => void>();
  private readonly pending: QueueEntry[] = [];
  private disposed = false;
  private maxConcurrency = 0;
  private running: QueueEntry | undefined;
  private sequence = 0;

  get diagnostics(): Readonly<{
    pending: number;
    running: number;
    disposed: boolean;
  }> {
    return {
      pending: this.pending.length,
      running: this.running === undefined ? 0 : 1,
      disposed: this.disposed,
    };
  }

  get maxObservedConcurrency(): number {
    return this.maxConcurrency;
  }

  enqueue<T>(task: RenderTask<T>): Promise<T> {
    const duplicate = this.entries.get(task.key);
    if (duplicate !== undefined) {
      return duplicate.promise as Promise<T>;
    }
    if (this.disposed) {
      return Promise.reject(abortError());
    }

    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    const entry: QueueEntry<T> = {
      canceled: false,
      controller: new AbortController(),
      key: task.key,
      priority: task.priority,
      promise,
      reject,
      resolve,
      sequence: this.sequence++,
      state: "pending",
      task,
    };

    this.entries.set(entry.key, entry as QueueEntry);
    this.pending.push(entry as QueueEntry);
    this.pump();
    return promise;
  }

  cancel(key: string): void {
    const entry = this.entries.get(key);
    if (entry !== undefined) {
      this.cancelEntry(entry);
    }
  }

  cancelMatching(predicate: (key: string) => boolean): void {
    for (const entry of [...this.entries.values()]) {
      if (predicate(entry.key)) {
        this.cancelEntry(entry);
      }
    }
  }

  clear(): void {
    for (const entry of [...this.entries.values()]) {
      this.cancelEntry(entry);
    }
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleWaiters.add(resolve);
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clear();
  }

  private cancelEntry(entry: QueueEntry): void {
    if (entry.state === "settled" || entry.canceled) {
      return;
    }
    entry.canceled = true;
    entry.controller.abort(abortError());

    if (entry.state === "pending") {
      const index = this.pending.indexOf(entry);
      if (index !== -1) {
        this.pending.splice(index, 1);
      }
      entry.state = "settled";
      this.entries.delete(entry.key);
      entry.reject(abortError());
      this.resolveIdleWaiters();
    }
  }

  private pump(): void {
    if (this.running !== undefined || this.pending.length === 0) {
      this.resolveIdleWaiters();
      return;
    }

    this.pending.sort(
      (left, right) =>
        left.priority - right.priority || left.sequence - right.sequence,
    );
    const entry = this.pending.shift();
    if (entry === undefined) {
      this.resolveIdleWaiters();
      return;
    }

    entry.state = "running";
    this.running = entry;
    this.maxConcurrency = Math.max(this.maxConcurrency, 1);
    void this.execute(entry);
  }

  private async execute(entry: QueueEntry): Promise<void> {
    try {
      const result = await entry.task.run(entry.controller.signal);
      if (entry.canceled || entry.controller.signal.aborted) {
        try {
          entry.task.disposeResult?.(result);
        } catch {
          // Cleanup must not replace the cancellation result.
        }
        entry.reject(abortError());
      } else {
        entry.resolve(result);
      }
    } catch (error) {
      entry.reject(
        entry.canceled || entry.controller.signal.aborted ? abortError() : error,
      );
    } finally {
      entry.state = "settled";
      if (this.entries.get(entry.key) === entry) {
        this.entries.delete(entry.key);
      }
      if (this.running === entry) {
        this.running = undefined;
      }
      this.pump();
    }
  }

  private isIdle(): boolean {
    return this.pending.length === 0 && this.running === undefined;
  }

  private resolveIdleWaiters(): void {
    if (!this.isIdle()) {
      return;
    }
    for (const resolve of this.idleWaiters) {
      resolve();
    }
    this.idleWaiters.clear();
  }
}
