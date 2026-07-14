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

export interface AttemptDeadline {
  readonly startedAtMs: number;
  readonly timeoutMs: number;
  readonly now: () => number;
}

export class AttemptDeadlineExceededError extends Error {
  constructor(readonly elapsedMs: number) {
    super(`attempt exceeded its deadline after ${elapsedMs} ms`);
    this.name = "AttemptDeadlineExceededError";
  }
}

export function attemptRemainingMs(
  deadline: Pick<AttemptPollOptions<unknown>, "startedAtMs" | "timeoutMs">,
  nowMs: number,
): number {
  return Math.max(0, deadline.timeoutMs - (nowMs - deadline.startedAtMs));
}

export async function withAttemptDeadline<T>(
  deadline: AttemptDeadline,
  operation: () => Promise<T>,
): Promise<T> {
  const remainingMs = attemptRemainingMs(deadline, deadline.now());
  if (remainingMs <= 0) {
    throw new AttemptDeadlineExceededError(
      deadline.now() - deadline.startedAtMs,
    );
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new AttemptDeadlineExceededError(
                deadline.now() - deadline.startedAtMs,
              ),
            ),
          remainingMs,
        );
      }),
    ]);
    const elapsedMs = deadline.now() - deadline.startedAtMs;
    if (elapsedMs >= deadline.timeoutMs) {
      throw new AttemptDeadlineExceededError(elapsedMs);
    }
    return result;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function withFreshAttemptDeadline<T>(
  timeoutMs: number,
  now: () => number,
  operation: () => Promise<T>,
): Promise<T> {
  return withAttemptDeadline(
    { startedAtMs: now(), timeoutMs, now },
    operation,
  );
}

export async function pollUntilAttemptDeadline<T>(
  options: AttemptPollOptions<T>,
): Promise<AttemptPollResult<T>> {
  const deadline: AttemptDeadline = {
    startedAtMs: options.startedAtMs,
    timeoutMs: options.timeoutMs,
    now: options.now,
  };
  while (true) {
    const value = await withAttemptDeadline(deadline, options.read);
    const elapsedMs = options.now() - options.startedAtMs;
    if (elapsedMs >= options.timeoutMs) {
      throw new AttemptDeadlineExceededError(elapsedMs);
    }
    if (options.isComplete(value)) {
      return { value, timedOut: false, elapsedMs };
    }
    await withAttemptDeadline(deadline, options.pause);
  }
}
