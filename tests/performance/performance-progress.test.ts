import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AttemptDeadlineExceededError,
  withAttemptDeadline,
} from "./attempt-timeout";
import { writePerformanceProgressAtomic } from "./performance-progress";

describe("installed performance progress checkpoint", () => {
  it("atomically serializes completed raw attempts and failures", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pptx-progress-"));
    const target = path.join(directory, "progress.json");

    try {
      await writePerformanceProgressAtomic(target, {
        environment: { renderer: "candidate@1" },
        protocol: { measuredRuns: 10 },
        rawOpens: [{ kind: "cold", status: "passed" }],
        rawMemoryAttempts: [],
        rawCancellationAttempts: [],
        failures: [],
      });

      expect(JSON.parse(await readFile(target, "utf8"))).toMatchObject({
        rawOpens: [{ kind: "cold", status: "passed" }],
        failures: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("checkpoints timeout evidence even when the external operation never resolves", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pptx-timeout-progress-"));
    const target = path.join(directory, "progress.json");
    const attempt = { status: "pending", timedOut: false, error: null as string | null };
    const startedAtMs = performance.now();

    try {
      try {
        await withAttemptDeadline(
          { startedAtMs, timeoutMs: 5, now: () => performance.now() },
          () => new Promise<never>(() => {}),
        );
      } catch (error) {
        attempt.status = "failed";
        attempt.timedOut = error instanceof AttemptDeadlineExceededError;
        attempt.error = error instanceof Error ? error.message : String(error);
      } finally {
        await writePerformanceProgressAtomic(target, { rawOpens: [attempt] });
      }

      expect(JSON.parse(await readFile(target, "utf8"))).toMatchObject({
        rawOpens: [
          {
            status: "failed",
            timedOut: true,
            error: expect.stringContaining("attempt exceeded its deadline"),
          },
        ],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
