export type SlideEmbedTask = (signal: AbortSignal) => Promise<void>;

interface ScheduledTask {
  readonly controller: AbortController;
  readonly run: SlideEmbedTask;
  cancelled: boolean;
}

export class SlideEmbedScheduler {
  private readonly pending: ScheduledTask[] = [];
  private readonly running = new Set<ScheduledTask>();
  private disposed = false;
  private peak = 0;

  constructor(readonly concurrency = 2) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error("Slide embed concurrency must be a positive integer");
    }
  }

  get activeCount(): number {
    return this.running.size;
  }

  get peakActiveCount(): number {
    return this.peak;
  }

  schedule(run: SlideEmbedTask): () => void {
    if (this.disposed) return () => {};
    const task: ScheduledTask = {
      controller: new AbortController(),
      run,
      cancelled: false,
    };
    this.pending.push(task);
    this.pump();
    return () => {
      if (task.cancelled) return;
      task.cancelled = true;
      task.controller.abort();
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const task of this.pending) {
      task.cancelled = true;
      task.controller.abort();
    }
    this.pending.length = 0;
    for (const task of this.running) {
      task.cancelled = true;
      task.controller.abort();
    }
  }

  private pump(): void {
    while (!this.disposed && this.running.size < this.concurrency) {
      const task = this.pending.shift();
      if (task === undefined) return;
      if (task.cancelled) continue;
      this.running.add(task);
      this.peak = Math.max(this.peak, this.running.size);
      void task.run(task.controller.signal).catch(() => undefined).finally(() => {
        this.running.delete(task);
        this.pump();
      });
    }
  }
}
