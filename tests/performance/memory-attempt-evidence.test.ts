import { describe, expect, it, vi } from "vitest";
import { synchronizeMemoryAttemptSelection } from "./memory-attempt-evidence";

interface Snapshot {
  label: string;
  state: string;
  rendererTimestampMs: number;
  elapsedSinceCloseMs: number | null;
}

function attemptWith(stale: Snapshot) {
  return {
    snapshots: [stale],
    loadingSnapshotCount: 1,
    preOpen: stale,
    peak: stale,
    steady: stale,
    postClose: stale,
    closeStartedAtRendererMs: 1,
  };
}

describe("synchronizeMemoryAttemptSelection", () => {
  it("clears stale selected snapshots when a timeout captured no raw snapshots", () => {
    const stale: Snapshot = {
      label: "steady",
      state: "ready",
      rendererTimestampMs: 100,
      elapsedSinceCloseMs: null,
    };
    const attempt = attemptWith(stale);
    const selectPeak = vi.fn(() => stale);

    synchronizeMemoryAttemptSelection(attempt, [], selectPeak);

    expect(attempt).toEqual({
      snapshots: [],
      loadingSnapshotCount: 0,
      preOpen: null,
      peak: null,
      steady: null,
      postClose: null,
      closeStartedAtRendererMs: null,
    });
    expect(selectPeak).not.toHaveBeenCalled();
  });

  it("recomputes every selected field from the supplied raw snapshots", () => {
    const preOpen: Snapshot = {
      label: "pre-open",
      state: "loading",
      rendererTimestampMs: 100,
      elapsedSinceCloseMs: null,
    };
    const steady: Snapshot = {
      label: "steady",
      state: "ready",
      rendererTimestampMs: 200,
      elapsedSinceCloseMs: null,
    };
    const postClose: Snapshot = {
      label: "post-close",
      state: "disposed",
      rendererTimestampMs: 300,
      elapsedSinceCloseMs: 50,
    };
    const attempt = attemptWith(steady);
    const selectPeak = vi.fn(() => steady);

    synchronizeMemoryAttemptSelection(
      attempt,
      [preOpen, steady, postClose],
      selectPeak,
    );

    expect(attempt).toMatchObject({
      snapshots: [preOpen, steady, postClose],
      loadingSnapshotCount: 1,
      preOpen,
      peak: steady,
      steady,
      postClose,
      closeStartedAtRendererMs: 250,
    });
    expect(selectPeak).toHaveBeenCalledWith(
      [preOpen, steady, postClose],
      steady,
    );
  });
});
