export interface AttemptPollOptions<T> {
  readonly read: () => Promise<T>;
  readonly isComplete: (value: T) => boolean;
  readonly now: () => number;
  readonly pause: () => Promise<void>;
  readonly startedAtMs: number;
  readonly timeoutMs: number;
}

export interface AttemptPollResult<T> {
  readonly value: T;
  readonly timedOut: boolean;
  readonly elapsedMs: number;
}

export async function pollUntilAttemptDeadline<T>(
  options: AttemptPollOptions<T>,
): Promise<AttemptPollResult<T>> {
  while (true) {
    const value = await options.read();
    const elapsedMs = options.now() - options.startedAtMs;
    if (options.isComplete(value)) {
      return { value, timedOut: false, elapsedMs };
    }
    if (elapsedMs >= options.timeoutMs) {
      return { value, timedOut: true, elapsedMs };
    }
    await options.pause();
  }
}
