import {
  appendPerformanceRunAttempt,
  assertPerformanceRunProvenanceMatchesLock,
  emptyPerformanceRunProvenance,
  type PerformanceBaselineProvenanceLock,
  type PerformanceRunAttempt,
} from "./performance-run-provenance";

function attempt(
  runId: string,
  outcome: "passed" | "failed",
): PerformanceRunAttempt {
  return {
    runId,
    startedAtUtc: `2026-07-14T10:00:0${runId}.000Z`,
    completedAtUtc: `2026-07-14T10:00:1${runId}.000Z`,
    outcome,
    failureCount: outcome === "passed" ? 0 : 1,
    firstReadableP95Ms: outcome === "passed" ? 90 : null,
    slideSwitchP95Ms: outcome === "passed" ? 3 : null,
    bundleBytes: 1_171_580,
    representativeFixtureSha256:
      "d613d62d93be1a11c9a52537ecf2bcd5bbc8c0aae8cd4c6b84b721ebc96d8948",
  };
}

describe("performance run provenance", () => {
  it("retains failed attempts and requires two later consecutive clean runs", () => {
    let provenance = emptyPerformanceRunProvenance();
    provenance = appendPerformanceRunAttempt(provenance, attempt("1", "failed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("2", "passed"));

    expect(provenance.eligibleForPromotion).toBe(false);
    expect(provenance.attempts.map(({ outcome }) => outcome)).toEqual([
      "failed",
      "passed",
    ]);

    provenance = appendPerformanceRunAttempt(provenance, attempt("3", "passed"));
    expect(provenance.attempts.map(({ runId }) => runId)).toEqual(["1", "2", "3"]);
    expect(provenance.eligibleForPromotion).toBe(true);
    expect(provenance.acceptedRunIds).toEqual(["2", "3"]);
  });

  it("resets promotion eligibility after any later failed run", () => {
    let provenance = emptyPerformanceRunProvenance();
    provenance = appendPerformanceRunAttempt(provenance, attempt("1", "passed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("2", "passed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("3", "failed"));

    expect(provenance.eligibleForPromotion).toBe(false);
    expect(provenance.acceptedRunIds).toEqual([]);
    expect(provenance.attempts).toHaveLength(3);
  });

  it("rejects uniformly replaced bundle bytes against a baseline lock", () => {
    let provenance = emptyPerformanceRunProvenance();
    provenance = appendPerformanceRunAttempt(provenance, attempt("1", "failed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("2", "passed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("3", "passed"));
    const lock: PerformanceBaselineProvenanceLock = {
      attemptRunIds: ["1", "2", "3"],
      outcomes: ["failed", "passed", "passed"],
      acceptedRunIds: ["2", "3"],
      bundleBytes: provenance.attempts.map(({ bundleBytes }) => bundleBytes),
      representativeFixtureSha256:
        provenance.attempts[0]!.representativeFixtureSha256,
    };
    const uniformlyReplaced = {
      ...provenance,
      attempts: provenance.attempts.map((item) => ({
        ...item,
        bundleBytes: item.bundleBytes + 1,
      })),
    };

    expect(() =>
      assertPerformanceRunProvenanceMatchesLock(uniformlyReplaced, lock),
    ).toThrow(/provenance lock/);
  });

  it("anchors each retained attempt to the bundle it actually measured", () => {
    let provenance = emptyPerformanceRunProvenance();
    provenance = appendPerformanceRunAttempt(provenance, attempt("1", "passed"));
    provenance = appendPerformanceRunAttempt(provenance, {
      ...attempt("2", "passed"),
      bundleBytes: 1_200_540,
    });
    provenance = appendPerformanceRunAttempt(provenance, {
      ...attempt("3", "passed"),
      bundleBytes: 1_200_540,
    });
    const lock = {
      attemptRunIds: ["1", "2", "3"],
      outcomes: ["passed", "passed", "passed"],
      acceptedRunIds: ["2", "3"],
      bundleBytes: [1_171_580, 1_200_540, 1_200_540],
      representativeFixtureSha256:
        provenance.attempts[0]!.representativeFixtureSha256,
    };

    expect(() =>
      assertPerformanceRunProvenanceMatchesLock(provenance, lock),
    ).not.toThrow();
  });

  it("anchors every retained attempt outcome in the baseline lock", () => {
    let provenance = emptyPerformanceRunProvenance();
    provenance = appendPerformanceRunAttempt(provenance, attempt("1", "failed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("2", "passed"));
    provenance = appendPerformanceRunAttempt(provenance, attempt("3", "passed"));
    const lockWithChangedOutcome: PerformanceBaselineProvenanceLock = {
      attemptRunIds: ["1", "2", "3"],
      outcomes: ["passed", "passed", "passed"],
      acceptedRunIds: ["2", "3"],
      bundleBytes: provenance.attempts.map(({ bundleBytes }) => bundleBytes),
      representativeFixtureSha256:
        provenance.attempts[0]!.representativeFixtureSha256,
    };

    expect(() =>
      assertPerformanceRunProvenanceMatchesLock(
        provenance,
        lockWithChangedOutcome,
      ),
    ).toThrow(/provenance lock/);
  });
});
