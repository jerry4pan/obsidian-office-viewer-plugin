export const PERFORMANCE_RUN_SELECTION_POLICY = {
  id: "retain-all-require-two-consecutive-clean-runs-v1",
  requiredConsecutiveCleanRuns: 2,
  retention: "all-attempts",
} as const;

export interface PerformanceRunAttempt {
  readonly runId: string;
  readonly startedAtUtc: string;
  readonly completedAtUtc: string;
  readonly outcome: "passed" | "failed";
  readonly failureCount: number;
  readonly firstReadableP95Ms: number | null;
  readonly slideSwitchP95Ms: number | null;
  readonly bundleBytes: number;
  readonly representativeFixtureSha256: string;
}

export interface PerformanceRunProvenance {
  readonly policy: typeof PERFORMANCE_RUN_SELECTION_POLICY;
  readonly attempts: readonly PerformanceRunAttempt[];
  readonly eligibleForPromotion: boolean;
  readonly acceptedRunIds: readonly string[];
}

export interface PerformanceBaselineProvenanceLock {
  readonly attemptRunIds: readonly string[];
  readonly outcomes: readonly PerformanceRunAttempt["outcome"][];
  readonly acceptedRunIds: readonly string[];
  readonly bundleBytes: readonly number[];
  readonly representativeFixtureSha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...expected].sort())
  ) {
    throw new Error(`${path} has an unexpected schema`);
  }
}

function assertAttempt(value: unknown, path: string): asserts value is PerformanceRunAttempt {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  exactKeys(value, [
    "runId",
    "startedAtUtc",
    "completedAtUtc",
    "outcome",
    "failureCount",
    "firstReadableP95Ms",
    "slideSwitchP95Ms",
    "bundleBytes",
    "representativeFixtureSha256",
  ], path);
  if (typeof value.runId !== "string" || value.runId.length === 0) {
    throw new Error(`${path}.runId must be non-empty`);
  }
  if (
    typeof value.startedAtUtc !== "string" ||
    typeof value.completedAtUtc !== "string" ||
    !Number.isFinite(Date.parse(value.startedAtUtc)) ||
    !Number.isFinite(Date.parse(value.completedAtUtc)) ||
    Date.parse(value.completedAtUtc) < Date.parse(value.startedAtUtc)
  ) {
    throw new Error(`${path} must contain ordered UTC timestamps`);
  }
  if (value.outcome !== "passed" && value.outcome !== "failed") {
    throw new Error(`${path}.outcome must be passed or failed`);
  }
  if (!Number.isInteger(value.failureCount) || (value.failureCount as number) < 0) {
    throw new Error(`${path}.failureCount must be a non-negative integer`);
  }
  if (
    (value.outcome === "passed" && value.failureCount !== 0) ||
    (value.outcome === "failed" && value.failureCount === 0)
  ) {
    throw new Error(`${path} outcome must agree with failureCount`);
  }
  for (const key of ["firstReadableP95Ms", "slideSwitchP95Ms"] as const) {
    const metric = value[key];
    if (metric !== null && (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0)) {
      throw new Error(`${path}.${key} must be null or non-negative`);
    }
  }
  if (!Number.isInteger(value.bundleBytes) || (value.bundleBytes as number) < 0) {
    throw new Error(`${path}.bundleBytes must be a non-negative integer`);
  }
  if (
    typeof value.representativeFixtureSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.representativeFixtureSha256)
  ) {
    throw new Error(`${path}.representativeFixtureSha256 must be SHA-256`);
  }
}

function selection(attempts: readonly PerformanceRunAttempt[]): {
  eligibleForPromotion: boolean;
  acceptedRunIds: string[];
} {
  const required = PERFORMANCE_RUN_SELECTION_POLICY.requiredConsecutiveCleanRuns;
  const candidates = attempts.slice(-required);
  const reference = candidates[0];
  const eligibleForPromotion =
    candidates.length === required &&
    candidates.every(
      (attempt) =>
        attempt.outcome === "passed" &&
        attempt.bundleBytes === reference?.bundleBytes &&
        attempt.representativeFixtureSha256 ===
          reference?.representativeFixtureSha256,
    );
  return {
    eligibleForPromotion,
    acceptedRunIds: eligibleForPromotion
      ? candidates.map(({ runId }) => runId)
      : [],
  };
}

export function emptyPerformanceRunProvenance(): PerformanceRunProvenance {
  return {
    policy: PERFORMANCE_RUN_SELECTION_POLICY,
    attempts: [],
    eligibleForPromotion: false,
    acceptedRunIds: [],
  };
}

export function assertPerformanceRunProvenance(
  value: unknown,
): asserts value is PerformanceRunProvenance {
  if (!isRecord(value)) throw new Error("run provenance must be an object");
  exactKeys(value, ["policy", "attempts", "eligibleForPromotion", "acceptedRunIds"], "run provenance");
  if (!isRecord(value.policy)) throw new Error("run provenance policy must be an object");
  exactKeys(value.policy, ["id", "requiredConsecutiveCleanRuns", "retention"], "run provenance policy");
  if (
    value.policy.id !== PERFORMANCE_RUN_SELECTION_POLICY.id ||
    value.policy.requiredConsecutiveCleanRuns !==
      PERFORMANCE_RUN_SELECTION_POLICY.requiredConsecutiveCleanRuns ||
    value.policy.retention !== PERFORMANCE_RUN_SELECTION_POLICY.retention
  ) {
    throw new Error("run provenance must use the fixed selection policy");
  }
  if (!Array.isArray(value.attempts)) throw new Error("run provenance attempts must be an array");
  value.attempts.forEach((attempt, index) => assertAttempt(attempt, `run provenance attempts[${index}]`));
  if (new Set(value.attempts.map(({ runId }) => runId)).size !== value.attempts.length) {
    throw new Error("run provenance run IDs must be unique");
  }
  if (!Array.isArray(value.acceptedRunIds) || value.acceptedRunIds.some((id) => typeof id !== "string")) {
    throw new Error("run provenance acceptedRunIds must be strings");
  }
  if (typeof value.eligibleForPromotion !== "boolean") {
    throw new Error("run provenance eligibility must be boolean");
  }
  const expected = selection(value.attempts);
  if (
    value.eligibleForPromotion !== expected.eligibleForPromotion ||
    JSON.stringify(value.acceptedRunIds) !== JSON.stringify(expected.acceptedRunIds)
  ) {
    throw new Error("run provenance selection does not match retained attempts");
  }
}

function assertPerformanceBaselineProvenanceLock(
  value: unknown,
): asserts value is PerformanceBaselineProvenanceLock {
  if (!isRecord(value)) throw new Error("performance provenance lock must be an object");
  exactKeys(value, [
    "attemptRunIds",
    "outcomes",
    "acceptedRunIds",
    "bundleBytes",
    "representativeFixtureSha256",
  ], "performance provenance lock");
  if (
    !Array.isArray(value.attemptRunIds) ||
    value.attemptRunIds.some((runId) => typeof runId !== "string" || runId.length === 0)
  ) {
    throw new Error("performance provenance lock attemptRunIds must be non-empty strings");
  }
  if (
    !Array.isArray(value.outcomes) ||
    value.outcomes.some((outcome) => outcome !== "passed" && outcome !== "failed") ||
    value.outcomes.length !== value.attemptRunIds.length
  ) {
    throw new Error("performance provenance lock outcomes must align with attemptRunIds");
  }
  if (
    !Array.isArray(value.acceptedRunIds) ||
    value.acceptedRunIds.some((runId) => typeof runId !== "string" || runId.length === 0)
  ) {
    throw new Error("performance provenance lock acceptedRunIds must be non-empty strings");
  }
  if (
    !Array.isArray(value.bundleBytes) ||
    value.bundleBytes.length !== value.attemptRunIds.length ||
    value.bundleBytes.some(
      (bundleBytes) => !Number.isInteger(bundleBytes) || bundleBytes < 0,
    )
  ) {
    throw new Error(
      "performance provenance lock bundleBytes must align with attempts and contain non-negative integers",
    );
  }
  if (
    typeof value.representativeFixtureSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.representativeFixtureSha256)
  ) {
    throw new Error("performance provenance lock fixture hash must be SHA-256");
  }
}

export function assertPerformanceRunProvenanceMatchesLock(
  provenance: PerformanceRunProvenance,
  lockValue: unknown,
): asserts lockValue is PerformanceBaselineProvenanceLock {
  assertPerformanceRunProvenance(provenance);
  assertPerformanceBaselineProvenanceLock(lockValue);
  const actualRunIds = provenance.attempts.map(({ runId }) => runId);
  const actualOutcomes = provenance.attempts.map(({ outcome }) => outcome);
  if (
    JSON.stringify(actualRunIds) !== JSON.stringify(lockValue.attemptRunIds) ||
    JSON.stringify(actualOutcomes) !== JSON.stringify(lockValue.outcomes) ||
    JSON.stringify(provenance.acceptedRunIds) !==
      JSON.stringify(lockValue.acceptedRunIds) ||
    provenance.attempts.some(
      (attempt, index) =>
        attempt.bundleBytes !== lockValue.bundleBytes[index] ||
        attempt.representativeFixtureSha256 !==
          lockValue.representativeFixtureSha256,
    )
  ) {
    throw new Error(
      "performance provenance lock does not match the committed retained attempt history",
    );
  }
}

export function appendPerformanceRunAttempt(
  previous: PerformanceRunProvenance,
  attempt: PerformanceRunAttempt,
): PerformanceRunProvenance {
  assertPerformanceRunProvenance(previous);
  assertAttempt(attempt, "run attempt");
  if (previous.attempts.some(({ runId }) => runId === attempt.runId)) {
    throw new Error(`duplicate performance run ID: ${attempt.runId}`);
  }
  const attempts = [...previous.attempts, attempt];
  return {
    policy: PERFORMANCE_RUN_SELECTION_POLICY,
    attempts,
    ...selection(attempts),
  };
}
