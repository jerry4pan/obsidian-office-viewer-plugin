import { pollUntilAttemptDeadline } from "./attempt-timeout";

describe("attempt-level monotonic timeout", () => {
  it("times out even when the observed run never starts closing", async () => {
    let now = 100;
    const result = await pollUntilAttemptDeadline({
      read: async () => ({ closeStarted: false }),
      isComplete: ({ closeStarted }) => closeStarted,
      now: () => now,
      pause: async () => {
        now += 5;
      },
      startedAtMs: 100,
      timeoutMs: 10,
    });

    expect(result).toEqual({
      value: { closeStarted: false },
      timedOut: true,
      elapsedMs: 10,
    });
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
});
