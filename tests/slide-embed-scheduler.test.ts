import { describe, expect, it, vi } from "vitest";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

describe("SlideEmbedScheduler", () => {
  it("never runs more than two render tasks concurrently", async () => {
    const scheduler = new SlideEmbedScheduler(2);
    const releases: Array<() => void> = [];
    const started: number[] = [];
    const completed: number[] = [];

    for (let index = 0; index < 5; index += 1) {
      scheduler.schedule(async () => {
        started.push(index);
        await new Promise<void>((resolve) => releases.push(resolve));
        completed.push(index);
      });
    }

    expect(started).toEqual([0, 1]);
    expect(scheduler.activeCount).toBe(2);
    releases.shift()?.();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
    expect(scheduler.activeCount).toBe(2);
    while (releases.length > 0 || completed.length < 5) {
      releases.splice(0).forEach((release) => release());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(scheduler.peakActiveCount).toBe(2);
    expect(completed).toHaveLength(5);
  });

  it("aborts queued and running work when disposed", async () => {
    const scheduler = new SlideEmbedScheduler(1);
    const observed: boolean[] = [];
    scheduler.schedule(async (signal) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          observed.push(signal.aborted);
          resolve();
        }, { once: true });
      });
    });
    scheduler.schedule(async () => {
      throw new Error("queued work should not start");
    });

    scheduler.dispose();

    await vi.waitFor(() => expect(observed).toEqual([true]));
    await vi.waitFor(() => expect(scheduler.activeCount).toBe(0));
  });
});
