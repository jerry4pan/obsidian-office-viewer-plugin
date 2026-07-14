export interface SelectableMemorySnapshot {
  readonly label: string;
  readonly state: string;
  readonly rendererTimestampMs: number;
  readonly elapsedSinceCloseMs: number | null;
}

export interface MemoryAttemptSelection<Snapshot> {
  snapshots: Snapshot[];
  loadingSnapshotCount: number;
  preOpen: Snapshot | null;
  peak: Snapshot | null;
  steady: Snapshot | null;
  postClose: Snapshot | null;
  closeStartedAtRendererMs: number | null;
}

export function synchronizeMemoryAttemptSelection<
  Snapshot extends SelectableMemorySnapshot,
>(
  attempt: MemoryAttemptSelection<Snapshot>,
  snapshots: Snapshot[],
  selectPeak: (snapshots: readonly Snapshot[], steady: Snapshot) => Snapshot | null,
): void {
  attempt.snapshots = snapshots;
  attempt.loadingSnapshotCount = snapshots.filter(
    ({ state }) => state === "loading",
  ).length;
  attempt.preOpen =
    snapshots.find(({ label }) => label === "pre-open") ?? null;
  attempt.steady =
    snapshots.find(({ label }) => label === "steady") ?? null;
  attempt.postClose =
    snapshots.find(({ label }) => label === "post-close") ?? null;
  attempt.peak = attempt.steady
    ? selectPeak(snapshots, attempt.steady)
    : null;
  attempt.closeStartedAtRendererMs =
    attempt.postClose?.elapsedSinceCloseMs === null || !attempt.postClose
      ? null
      : attempt.postClose.rendererTimestampMs -
        attempt.postClose.elapsedSinceCloseMs;
}
