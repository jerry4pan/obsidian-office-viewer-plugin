import {
  AttemptDeadlineExceededError,
  attemptRemainingMs,
  pollUntilAttemptDeadline,
  withAttemptDeadline,
} from "./attempt-timeout";

describe("attempt-level monotonic timeout", () => {
  it("times out even when the observed run never starts closing", async () => {
    let now = 100;
    await expect(
      pollUntilAttemptDeadline({
        read: async () => ({ closeStarted: false }),
        isComplete: ({ closeStarted }) => closeStarted,
        now: () => now,
        pause: async () => {
          now += 5;
        },
        startedAtMs: 100,
        timeoutMs: 10,
      }),
    ).rejects.toBeInstanceOf(AttemptDeadlineExceededError);
  });

  it("returns completed state before the absolute attempt deadline", async () => {
    let now = 50;
    let reads = 0;
    const result = await pollUntilAttemptDeadline({
      read: async () => ({ ready: ++reads >= 2 }),
      isComplete: ({ ready }) => ready,
      now: () => now,
      pause: async () => {
        now += 2;
      },
      startedAtMs: 50,
      timeoutMs: 10,
    });

    expect(result).toEqual({
      value: { ready: true },
      timedOut: false,
      elapsedMs: 2,
    });
  });

  it("spends one shared budget across open, switches, and cleanup", () => {
    const deadline = { startedAtMs: 100, timeoutMs: 10 };

    expect(attemptRemainingMs(deadline, 104)).toBe(6);
    expect(attemptRemainingMs(deadline, 109)).toBe(1);
    expect(attemptRemainingMs(deadline, 111)).toBe(0);
  });

  it("rejects a never-resolving external operation at the shared deadline", async () => {
    vi.useFakeTimers();
    try {
      const startedAtMs = Date.now();
      const pending = withAttemptDeadline(
        { startedAtMs, timeoutMs: 10, now: () => Date.now() },
        () => new Promise<never>(() => {}),
      );
      const rejected = expect(pending).rejects.toBeInstanceOf(
        AttemptDeadlineExceededError,
      );

      await vi.advanceTimersByTimeAsync(10);
      await rejected;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an operation that completes after the deadline", async () => {
    let now = 100;
    await expect(
      withAttemptDeadline(
        { startedAtMs: 100, timeoutMs: 10, now: () => now },
        async () => {
          now = 111;
          return "late";
        },
      ),
    ).rejects.toBeInstanceOf(AttemptDeadlineExceededError);
  });

  it("does not accept a completed poll value after expiry", async () => {
    let now = 100;
    await expect(
      pollUntilAttemptDeadline({
        read: async () => {
          now = 111;
          return { ready: true };
        },
        isComplete: ({ ready }) => ready,
        now: () => now,
        pause: async () => {},
        startedAtMs: 100,
        timeoutMs: 10,
      }),
    ).rejects.toBeInstanceOf(AttemptDeadlineExceededError);
  });
});
