import {
  PERFORMANCE_BUDGETS,
  summarizePerformance,
  type PerformanceSummary,
} from "../../src/performance/performance-report";
import type {
  ElectronMemoryRuntimeProbe,
  GarbageCollectionObservation,
} from "./electron-memory";
import {
  evaluateResourceReturn,
  resourceCompletionElapsedMs,
  stringifyJsonEvidence,
  summarizeInstalledPerformance,
} from "./installed-performance-analysis";
import type { InstalledMarkdownArtifact } from "./installed-performance-markdown";

type AttemptStatus = "pending" | "passed" | "failed";
type Analysis = ReturnType<typeof summarizeInstalledPerformance>;

export type InstalledPerformanceExpectedOutcome =
  "pass" | "expected-open-failure";

export interface InstalledSnapshot {
  readonly sequence: number;
  readonly label: string;
  readonly state: string;
  readonly lifecyclePhase: string;
  readonly rendererTimestampMs: number;
  readonly elapsedSinceOpenMs: number;
  readonly elapsedSinceCloseMs: number | null;
  readonly heapUsedBytes: number;
  readonly rssBytes: number;
  readonly heapSource: "process.memoryUsage().heapUsed";
  readonly rssSource: "process.memoryUsage().rss";
}

interface ResourceReturn {
  readonly passed: boolean;
  readonly deadlinePassed: boolean;
  readonly adapterStopped: boolean;
  readonly heapIncrementBytes: number;
  readonly retainedHeapBytes: number;
  readonly retainedHeapFraction: number | null;
  readonly allowedRetainedHeapBytes: number;
  readonly postCloseAtOrBelowSteady: boolean;
}

interface Diagnostics {
  readonly generation: number;
  readonly openPending: boolean;
  readonly rendererActive: boolean;
  readonly disposed: boolean;
  readonly lifecyclePhase: string;
  readonly backgroundPending: number;
  readonly backgroundRunning: number;
  readonly mountedThumbnails: number;
  readonly zoomMode: "fit" | "manual";
  readonly zoomPercent: number;
}

export interface InstalledOpenAttempt {
  readonly kind: "cold" | "warmup" | "measured";
  readonly sampleIndex: number;
  readonly token: string;
  readonly status: AttemptStatus;
  readonly timedOut: boolean;
  readonly metadataMs: number | null;
  readonly firstReadableMs: number | null;
  readonly slideSwitches: readonly {
    readonly action: "next" | "previous";
    readonly from: string;
    readonly to: string;
    readonly elapsedMs: number;
  }[];
  readonly error: string | null;
}

export interface InstalledMemoryAttempt {
  readonly sampleIndex: number;
  readonly token: string;
  readonly status: AttemptStatus;
  readonly timedOut: boolean;
  readonly snapshots: readonly InstalledSnapshot[];
  readonly loadingSnapshotCount: number;
  readonly peakDefinition: string;
  readonly preOpen: InstalledSnapshot | null;
  readonly peak: InstalledSnapshot | null;
  readonly steady: InstalledSnapshot | null;
  readonly postClose: InstalledSnapshot | null;
  readonly closeStartedAtRendererMs: number | null;
  readonly adapterStopElapsedMs: number | null;
  readonly gcCompletedElapsedMs: number | null;
  readonly resourceCompletionElapsedMs: number | null;
  readonly garbageCollection: GarbageCollectionObservation | null;
  readonly diagnosticsAfterClose: Diagnostics | null;
  readonly resourceReturn: ResourceReturn | null;
  readonly error: string | null;
}

export interface InstalledCancellationAttempt {
  readonly sampleIndex: number;
  readonly token: string;
  readonly status: AttemptStatus;
  readonly timedOut: boolean;
  readonly sawLoading: boolean;
  readonly sawInFlight: boolean;
  readonly snapshots: readonly InstalledSnapshot[];
  readonly loadingSnapshotCount: number;
  readonly inFlightSnapshotCount: number;
  readonly preOpen: InstalledSnapshot | null;
  readonly inFlight: InstalledSnapshot | null;
  readonly peak: InstalledSnapshot | null;
  readonly postClose: InstalledSnapshot | null;
  readonly cancellationElapsedMs: number | null;
  readonly adapterStopElapsedMs: number | null;
  readonly gcCompletedElapsedMs: number | null;
  readonly resourceCompletionElapsedMs: number | null;
  readonly garbageCollection: GarbageCollectionObservation | null;
  readonly diagnosticsAfterClose: Diagnostics | null;
  readonly resourceReturn: ResourceReturn | null;
  readonly detached: boolean | null;
  readonly viewerAbsent: boolean | null;
  readonly openSettled: boolean | null;
  readonly adapterDisposed: boolean | null;
  readonly error: string | null;
}

export interface BackgroundStopObservation {
  readonly reason: "close" | "file-switch";
  readonly elapsedMs: number;
  readonly pending: number;
  readonly running: number;
  readonly mounted: number;
}

export interface InstalledPerformanceArtifact
  extends PerformanceSummary, InstalledMarkdownArtifact {
  readonly protocol: InstalledMarkdownArtifact["protocol"] & {
    readonly coldRuns: number;
    readonly warmupRuns: number;
    readonly measuredRuns: number;
    readonly slideSwitchesPerMeasuredRun: number;
    readonly cancellationRuns: number;
    readonly attemptTimeoutMs: number;
    readonly rssPolicy: string;
  };
  readonly memoryRuntime: ElectronMemoryRuntimeProbe;
  readonly rawOpens: readonly InstalledOpenAttempt[];
  readonly rawMemoryAttempts: readonly InstalledMemoryAttempt[];
  readonly rawCancellationAttempts: readonly InstalledCancellationAttempt[];
  readonly thumbnailReadinessMs: readonly number[];
  readonly mountedThumbnailCounts: readonly number[];
  readonly backgroundStopObservations: readonly BackgroundStopObservation[];
  readonly analysis: Analysis;
}

function fail(path: string, expected: string): never {
  throw new Error(`${path} must be ${expected}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(path, "an object");
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  path: string,
  expectedKeys: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${path} must contain exactly: ${expected.join(", ")}`);
  }
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) return fail(path, "an array");
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string") return fail(path, "a string");
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(path, "a finite number");
  }
  return value;
}

function nonNegative(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result < 0) return fail(path, "a non-negative finite number");
  return result;
}

function integer(value: unknown, path: string): number {
  const result = nonNegative(value, path);
  if (!Number.isInteger(result)) return fail(path, "a non-negative integer");
  return result;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") return fail(path, "a boolean");
  return value;
}

function nullable<T>(
  value: unknown,
  path: string,
  validate: (value: unknown, path: string) => T,
): T | null {
  return value === null ? null : validate(value, path);
}

function enumeration<T extends string>(
  value: unknown,
  path: string,
  values: readonly T[],
): T {
  const result = string(value, path);
  if (!values.includes(result as T)) return fail(path, values.join(" | "));
  return result as T;
}

function assertJsonSafe(value: unknown, path = "artifact"): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    finite(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }
  const object = record(value, path);
  for (const [key, item] of Object.entries(object)) {
    assertJsonSafe(item, `${path}.${key}`);
  }
}

function assertSnapshot(value: unknown, path: string): void {
  const snapshot = record(value, path);
  assertExactKeys(snapshot, path, [
    "sequence",
    "label",
    "state",
    "lifecyclePhase",
    "rendererTimestampMs",
    "elapsedSinceOpenMs",
    "elapsedSinceCloseMs",
    "heapUsedBytes",
    "rssBytes",
    "heapSource",
    "rssSource",
  ]);
  integer(snapshot.sequence, `${path}.sequence`);
  string(snapshot.label, `${path}.label`);
  string(snapshot.state, `${path}.state`);
  string(snapshot.lifecyclePhase, `${path}.lifecyclePhase`);
  nonNegative(snapshot.rendererTimestampMs, `${path}.rendererTimestampMs`);
  nonNegative(snapshot.elapsedSinceOpenMs, `${path}.elapsedSinceOpenMs`);
  nullable(
    snapshot.elapsedSinceCloseMs,
    `${path}.elapsedSinceCloseMs`,
    nonNegative,
  );
  nonNegative(snapshot.heapUsedBytes, `${path}.heapUsedBytes`);
  nonNegative(snapshot.rssBytes, `${path}.rssBytes`);
  enumeration(snapshot.heapSource, `${path}.heapSource`, [
    "process.memoryUsage().heapUsed",
  ]);
  enumeration(snapshot.rssSource, `${path}.rssSource`, [
    "process.memoryUsage().rss",
  ]);
}

function assertDiagnostics(value: unknown, path: string): void {
  const diagnostics = record(value, path);
  assertExactKeys(diagnostics, path, [
    "generation",
    "openPending",
    "rendererActive",
    "disposed",
    "lifecyclePhase",
    "backgroundPending",
    "backgroundRunning",
    "mountedThumbnails",
    "zoomMode",
    "zoomPercent",
  ]);
  integer(diagnostics.generation, `${path}.generation`);
  boolean(diagnostics.openPending, `${path}.openPending`);
  boolean(diagnostics.rendererActive, `${path}.rendererActive`);
  boolean(diagnostics.disposed, `${path}.disposed`);
  string(diagnostics.lifecyclePhase, `${path}.lifecyclePhase`);
  integer(diagnostics.backgroundPending, `${path}.backgroundPending`);
  integer(diagnostics.backgroundRunning, `${path}.backgroundRunning`);
  integer(diagnostics.mountedThumbnails, `${path}.mountedThumbnails`);
  enumeration(diagnostics.zoomMode, `${path}.zoomMode`, ["fit", "manual"]);
  nonNegative(diagnostics.zoomPercent, `${path}.zoomPercent`);
}

function assertResourceReturn(value: unknown, path: string): void {
  const result = record(value, path);
  assertExactKeys(result, path, [
    "passed",
    "deadlinePassed",
    "adapterStopped",
    "heapIncrementBytes",
    "retainedHeapBytes",
    "retainedHeapFraction",
    "allowedRetainedHeapBytes",
    "postCloseAtOrBelowSteady",
  ]);
  for (const key of [
    "passed",
    "deadlinePassed",
    "adapterStopped",
    "postCloseAtOrBelowSteady",
  ]) {
    boolean(result[key], `${path}.${key}`);
  }
  for (const key of [
    "heapIncrementBytes",
    "retainedHeapBytes",
    "allowedRetainedHeapBytes",
  ]) {
    nonNegative(result[key], `${path}.${key}`);
  }
  nullable(
    result.retainedHeapFraction,
    `${path}.retainedHeapFraction`,
    nonNegative,
  );
}

function assertGarbageCollection(value: unknown, path: string): void {
  const gc = record(value, path);
  boolean(gc.forced, `${path}.forced`);
  enumeration(gc.method, `${path}.method`, [
    "cdp-heap-profiler",
    "renderer-global-gc",
    "observation-window-only",
  ]);
  if (gc.cdpError !== undefined) string(gc.cdpError, `${path}.cdpError`);
  if (gc.fallbackReason !== undefined) {
    string(gc.fallbackReason, `${path}.fallbackReason`);
  }
}

function assertAttemptBase(
  attempt: Record<string, unknown>,
  path: string,
): void {
  integer(attempt.sampleIndex, `${path}.sampleIndex`);
  string(attempt.token, `${path}.token`);
  enumeration(attempt.status, `${path}.status`, [
    "pending",
    "passed",
    "failed",
  ]);
  nullable(attempt.error, `${path}.error`, string);
}

function assertCommonResourceAttempt(
  attempt: Record<string, unknown>,
  path: string,
): void {
  assertAttemptBase(attempt, path);
  array(attempt.snapshots, `${path}.snapshots`).forEach((snapshot, index) =>
    assertSnapshot(snapshot, `${path}.snapshots[${index}]`),
  );
  for (const key of ["preOpen", "peak", "postClose"] as const) {
    if (attempt[key] !== null) assertSnapshot(attempt[key], `${path}.${key}`);
  }
  nullable(
    attempt.adapterStopElapsedMs,
    `${path}.adapterStopElapsedMs`,
    nonNegative,
  );
  nullable(
    attempt.gcCompletedElapsedMs,
    `${path}.gcCompletedElapsedMs`,
    nonNegative,
  );
  nullable(
    attempt.resourceCompletionElapsedMs,
    `${path}.resourceCompletionElapsedMs`,
    nonNegative,
  );
  if (attempt.garbageCollection !== null) {
    assertGarbageCollection(
      attempt.garbageCollection,
      `${path}.garbageCollection`,
    );
  }
  if (attempt.diagnosticsAfterClose !== null) {
    assertDiagnostics(
      attempt.diagnosticsAfterClose,
      `${path}.diagnosticsAfterClose`,
    );
  }
  if (attempt.resourceReturn !== null) {
    assertResourceReturn(attempt.resourceReturn, `${path}.resourceReturn`);
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function assertEqual(actual: unknown, expected: unknown, path: string): void {
  if (
    stringifyJsonEvidence(canonical(actual)) !==
    stringifyJsonEvidence(canonical(expected))
  ) {
    throw new Error(
      `${path} does not match values recomputed from raw evidence`,
    );
  }
}

export function selectActualPeakSnapshot(
  snapshots: readonly InstalledSnapshot[],
  boundary: InstalledSnapshot,
): InstalledSnapshot | null {
  return snapshots
    .filter(
      (snapshot) =>
        snapshot.label !== "pre-open" &&
        snapshot.label !== "pre-close" &&
        snapshot.label !== "post-close" &&
        snapshot.rendererTimestampMs <= boundary.rendererTimestampMs,
    )
    .reduce<InstalledSnapshot | null>(
      (peak, snapshot) =>
        peak === null || snapshot.heapUsedBytes > peak.heapUsedBytes
          ? snapshot
          : peak,
      null,
    );
}

function validateExpectedOpenFailureArtifact(
  artifact: InstalledPerformanceArtifact,
): InstalledPerformanceArtifact {
  const expectedOpenError = artifact.rawOpens[0]?.error;
  if (
    artifact.rawOpens.some(
      ({
        status,
        timedOut,
        metadataMs,
        firstReadableMs,
        slideSwitches,
        error,
      }) =>
        status !== "failed" ||
        timedOut ||
        metadataMs !== null ||
        firstReadableMs !== null ||
        slideSwitches.length !== 0 ||
        error === null ||
        error !== expectedOpenError,
    )
  ) {
    throw new Error(
      "artifact raw opens must contain complete expected open-failure evidence",
    );
  }

  const measuredOpens = artifact.rawOpens.filter(
    ({ kind }) => kind === "measured",
  );
  if (
    artifact.rawMemoryAttempts.some(
      (attempt, index) =>
        attempt.sampleIndex !== index + 1 ||
        attempt.status !== "failed" ||
        attempt.timedOut ||
        attempt.loadingSnapshotCount < 1 ||
        !attempt.preOpen ||
        attempt.peak !== null ||
        attempt.steady !== null ||
        !attempt.postClose ||
        attempt.closeStartedAtRendererMs === null ||
        attempt.adapterStopElapsedMs === null ||
        attempt.gcCompletedElapsedMs === null ||
        attempt.resourceCompletionElapsedMs !== null ||
        !attempt.garbageCollection ||
        !attempt.diagnosticsAfterClose ||
        attempt.resourceReturn !== null ||
        attempt.error === null ||
        attempt.error !== measuredOpens[index]?.error,
    )
  ) {
    throw new Error(
      "artifact memory attempts must preserve failed-open cleanup evidence without invented steady-state measurements",
    );
  }

  if (
    artifact.rawCancellationAttempts.some(
      (attempt, index) =>
        attempt.sampleIndex !== index + 1 ||
        attempt.status !== "passed" ||
        attempt.timedOut ||
        !attempt.sawLoading ||
        !attempt.sawInFlight ||
        attempt.inFlightSnapshotCount < 1 ||
        !attempt.preOpen ||
        !attempt.inFlight ||
        !attempt.peak ||
        !attempt.postClose ||
        attempt.adapterStopElapsedMs === null ||
        attempt.gcCompletedElapsedMs === null ||
        attempt.resourceCompletionElapsedMs === null ||
        !attempt.garbageCollection ||
        !attempt.diagnosticsAfterClose ||
        !attempt.resourceReturn?.passed ||
        attempt.cancellationElapsedMs === null ||
        attempt.cancellationElapsedMs > artifact.protocol.observationWindowMs ||
        attempt.resourceCompletionElapsedMs >
          artifact.protocol.observationWindowMs ||
        attempt.detached !== true ||
        attempt.viewerAbsent !== true ||
        attempt.openSettled !== true ||
        attempt.adapterDisposed !== true ||
        attempt.error !== null,
    )
  ) {
    throw new Error(
      "artifact cancellation attempts must prove strict in-flight resource return",
    );
  }

  const cancellationResourceCompletion = artifact.rawCancellationAttempts.map(
    (attempt) => {
      if (attempt.cancellationElapsedMs !== attempt.adapterStopElapsedMs) {
        throw new Error(
          `cancellation attempt ${attempt.sampleIndex} cancellation latency must equal adapter-stop latency`,
        );
      }
      const expectedResourceReturn = evaluateResourceReturn({
        preOpenHeapBytes: attempt.preOpen!.heapUsedBytes,
        steadyHeapBytes: attempt.peak!.heapUsedBytes,
        postCloseHeapBytes: attempt.postClose!.heapUsedBytes,
        postCloseElapsedMs: attempt.postClose!.elapsedSinceCloseMs!,
        openSettled: attempt.openSettled!,
        adapterDisposed: attempt.adapterDisposed!,
        maxRetainedHeapFraction: artifact.protocol.maxRetainedHeapFraction,
        deadlineMs: artifact.protocol.observationWindowMs,
      });
      assertEqual(
        attempt.resourceReturn,
        expectedResourceReturn,
        `cancellation attempt ${attempt.sampleIndex} resourceReturn`,
      );
      const completion = resourceCompletionElapsedMs({
        cleanupElapsedMs: attempt.adapterStopElapsedMs!,
        gcCompletedElapsedMs: attempt.gcCompletedElapsedMs!,
        postCloseElapsedMs: attempt.postClose!.elapsedSinceCloseMs!,
      });
      if (attempt.resourceCompletionElapsedMs !== completion) {
        throw new Error(
          `cancellation attempt ${attempt.sampleIndex} resourceCompletionElapsedMs does not match raw timing evidence`,
        );
      }
      return completion;
    },
  );

  const expectedResources = {
    memory: [],
    cancellation: artifact.rawCancellationAttempts.map((attempt) => ({
      elapsedMs: attempt.cancellationElapsedMs!,
      detached: attempt.detached!,
      viewerAbsent: attempt.viewerAbsent!,
    })),
    cleanup: artifact.rawCancellationAttempts.map((attempt) => ({
      elapsedMs: attempt.resourceCompletionElapsedMs!,
      unfinishedWorkStopped: Boolean(
        attempt.openSettled && attempt.adapterDisposed,
      ),
      resourcesReleased: true,
    })),
    bundleBytes: artifact.resources.bundleBytes,
    observationWindowMs: artifact.protocol.observationWindowMs,
  };
  assertEqual(artifact.resources, expectedResources, "artifact.resources");

  const expectedFailures = artifact.rawOpens.flatMap((attempt) => {
    const failures = [
      {
        phase: `${attempt.kind}-open`,
        message: attempt.error!,
        sampleIndex: attempt.sampleIndex,
      },
    ];
    if (attempt.kind === "measured") {
      failures.push({
        phase: "memory",
        message: "required pre-open/peak/steady/post-close snapshot missing",
        sampleIndex: attempt.sampleIndex,
      });
    }
    return failures;
  });
  const expectedSummary = summarizePerformance({
    environment: artifact.environment,
    firstReadableMs: [],
    slideSwitchMs: [],
    resources: expectedResources,
    failures: expectedFailures,
  });
  for (const key of [
    "environment",
    "firstReadable",
    "slideSwitch",
    "resources",
    "failures",
    "gates",
  ] as const) {
    assertEqual(artifact[key], expectedSummary[key], `artifact.${key}`);
  }
  if (artifact.gates.overallPassed) {
    throw new Error(
      "artifact expected open-failure evidence must fail M0 gates",
    );
  }

  const expectedAnalysis = summarizeInstalledPerformance({
    expectedMeasuredRuns: artifact.protocol.measuredRuns,
    expectedCancellationRuns: artifact.protocol.cancellationRuns,
    expectedResourceCompletionRuns:
      artifact.protocol.measuredRuns + artifact.protocol.cancellationRuns,
    switchesPerRun: artifact.protocol.slideSwitchesPerMeasuredRun,
    metadataMs: [],
    firstReadableMs: [],
    slideSwitchMs: [],
    thumbnailReadinessMs: [],
    mountedThumbnailCounts: [],
    memory: [],
    cancellationElapsedMs: artifact.rawCancellationAttempts.map(
      ({ cancellationElapsedMs }) => cancellationElapsedMs!,
    ),
    resourceCompletionElapsedMs: cancellationResourceCompletion,
    failures: expectedSummary.failures,
    budgets: PERFORMANCE_BUDGETS,
  });
  assertEqual(artifact.analysis, expectedAnalysis, "artifact.analysis");
  return artifact;
}

export function validateInstalledPerformanceArtifact(
  value: unknown,
  expectedBundleBytes: number,
  expectedOutcome: InstalledPerformanceExpectedOutcome,
  expectedRendererLabel: string,
): InstalledPerformanceArtifact {
  assertJsonSafe(value);
  nonNegative(expectedBundleBytes, "expectedBundleBytes");
  string(expectedRendererLabel, "expectedRendererLabel");
  const top = record(value, "artifact");
  assertExactKeys(top, "artifact", [
    "protocol",
    "memoryRuntime",
    "rawOpens",
    "rawMemoryAttempts",
    "rawCancellationAttempts",
    "thumbnailReadinessMs",
    "mountedThumbnailCounts",
    "backgroundStopObservations",
    "analysis",
    "environment",
    "firstReadable",
    "slideSwitch",
    "resources",
    "failures",
    "gates",
  ]);
  const protocol = record(top.protocol, "artifact.protocol");
  assertExactKeys(protocol, "artifact.protocol", [
    "coldRuns",
    "warmupRuns",
    "measuredRuns",
    "slideSwitchesPerMeasuredRun",
    "cancellationRuns",
    "observationWindowMs",
    "postCloseSampleTargetMs",
    "maxRetainedHeapFraction",
    "attemptTimeoutMs",
    "rssPolicy",
  ]);
  for (const key of [
    "coldRuns",
    "warmupRuns",
    "measuredRuns",
    "slideSwitchesPerMeasuredRun",
    "cancellationRuns",
    "observationWindowMs",
    "postCloseSampleTargetMs",
    "attemptTimeoutMs",
  ]) {
    integer(protocol[key], `artifact.protocol.${key}`);
  }
  const maxRetainedHeapFraction = finite(
    protocol.maxRetainedHeapFraction,
    "artifact.protocol.maxRetainedHeapFraction",
  );
  if (maxRetainedHeapFraction < 0 || maxRetainedHeapFraction > 1) {
    fail("artifact.protocol.maxRetainedHeapFraction", "between zero and one");
  }
  string(protocol.rssPolicy, "artifact.protocol.rssPolicy");
  const fixedProtocol = {
    coldRuns: 1,
    warmupRuns: 2,
    measuredRuns: 10,
    slideSwitchesPerMeasuredRun: 4,
    cancellationRuns: 5,
    observationWindowMs: 2_000,
    postCloseSampleTargetMs: 1_850,
    attemptTimeoutMs: 10_000,
    maxRetainedHeapFraction: 0.5,
  } as const;
  for (const [key, expected] of Object.entries(fixedProtocol)) {
    if (protocol[key] !== expected) {
      throw new Error(
        `artifact.protocol.${key} must equal fixed value ${expected}`,
      );
    }
  }

  const memoryRuntime = record(top.memoryRuntime, "artifact.memoryRuntime");
  assertExactKeys(memoryRuntime, "artifact.memoryRuntime", [
    "memoryUsageAvailable",
    "getProcessMemoryInfoAvailable",
    "getProcessMemoryInfoError",
    "getProcessMemoryInfoKeys",
    "getProcessMemoryInfoResidentSet",
    "rssFallbackReason",
    "selectedHeapSource",
    "selectedRssSource",
  ]);
  boolean(
    memoryRuntime.memoryUsageAvailable,
    "artifact.memoryRuntime.memoryUsageAvailable",
  );
  boolean(
    memoryRuntime.getProcessMemoryInfoAvailable,
    "artifact.memoryRuntime.getProcessMemoryInfoAvailable",
  );
  nullable(
    memoryRuntime.getProcessMemoryInfoError,
    "artifact.memoryRuntime.getProcessMemoryInfoError",
    string,
  );
  array(
    memoryRuntime.getProcessMemoryInfoKeys,
    "artifact.memoryRuntime.getProcessMemoryInfoKeys",
  ).forEach((key, index) =>
    string(key, `artifact.memoryRuntime.getProcessMemoryInfoKeys[${index}]`),
  );
  nullable(
    memoryRuntime.getProcessMemoryInfoResidentSet,
    "artifact.memoryRuntime.getProcessMemoryInfoResidentSet",
    nonNegative,
  );
  nullable(
    memoryRuntime.rssFallbackReason,
    "artifact.memoryRuntime.rssFallbackReason",
    string,
  );
  nullable(
    memoryRuntime.selectedHeapSource,
    "artifact.memoryRuntime.selectedHeapSource",
    (source, path) =>
      enumeration(source, path, ["process.memoryUsage().heapUsed"]),
  );
  nullable(
    memoryRuntime.selectedRssSource,
    "artifact.memoryRuntime.selectedRssSource",
    (source, path) =>
      enumeration(source, path, [
        "process.getProcessMemoryInfo().residentSet * 1024",
        "process.memoryUsage().rss",
      ]),
  );

  const environment = record(top.environment, "artifact.environment");
  assertExactKeys(environment, "artifact.environment", [
    "device",
    "os",
    "obsidianVersion",
    "installerVersion",
    "electronVersion",
    "chromiumVersion",
    "nodeVersion",
    "renderer",
    "coldDefinition",
    "warmDefinition",
    "warmupRuns",
    "measuredRuns",
    "slideSwitchesPerRun",
  ]);
  for (const key of [
    "device",
    "os",
    "obsidianVersion",
    "electronVersion",
    "installerVersion",
    "chromiumVersion",
    "nodeVersion",
    "renderer",
    "coldDefinition",
    "warmDefinition",
  ]) {
    string(environment[key], `artifact.environment.${key}`);
  }
  for (const key of ["warmupRuns", "measuredRuns", "slideSwitchesPerRun"]) {
    integer(environment[key], `artifact.environment.${key}`);
  }
  if (environment.renderer !== expectedRendererLabel) {
    throw new Error(
      `artifact.environment.renderer must equal selected candidate ${expectedRendererLabel}`,
    );
  }
  if (
    environment.warmupRuns !== protocol.warmupRuns ||
    environment.measuredRuns !== protocol.measuredRuns ||
    environment.slideSwitchesPerRun !== protocol.slideSwitchesPerMeasuredRun
  ) {
    throw new Error("artifact environment run counts do not match protocol");
  }

  const rawOpens = array(top.rawOpens, "artifact.rawOpens");
  const rawMemory = array(top.rawMemoryAttempts, "artifact.rawMemoryAttempts");
  const rawCancellation = array(
    top.rawCancellationAttempts,
    "artifact.rawCancellationAttempts",
  );
  const thumbnailReadiness = array(
    top.thumbnailReadinessMs,
    "artifact.thumbnailReadinessMs",
  );
  thumbnailReadiness.forEach((value, index) =>
    nonNegative(value, `artifact.thumbnailReadinessMs[${index}]`),
  );
  const mountedThumbnailCounts = array(
    top.mountedThumbnailCounts,
    "artifact.mountedThumbnailCounts",
  );
  mountedThumbnailCounts.forEach((value, index) =>
    integer(value, `artifact.mountedThumbnailCounts[${index}]`),
  );
  const backgroundStops = array(
    top.backgroundStopObservations,
    "artifact.backgroundStopObservations",
  );
  backgroundStops.forEach((value, index) => {
    const path = `artifact.backgroundStopObservations[${index}]`;
    const observation = record(value, path);
    assertExactKeys(observation, path, [
      "reason",
      "elapsedMs",
      "pending",
      "running",
      "mounted",
    ]);
    enumeration(observation.reason, `${path}.reason`, ["close", "file-switch"]);
    nonNegative(observation.elapsedMs, `${path}.elapsedMs`);
    integer(observation.pending, `${path}.pending`);
    integer(observation.running, `${path}.running`);
    integer(observation.mounted, `${path}.mounted`);
  });
  const expectedOpenCount =
    (protocol.coldRuns as number) +
    (protocol.warmupRuns as number) +
    (protocol.measuredRuns as number);
  if (rawOpens.length !== expectedOpenCount) {
    throw new Error(
      `artifact.rawOpens must contain exactly ${expectedOpenCount} attempts`,
    );
  }
  if (rawMemory.length !== protocol.measuredRuns) {
    throw new Error(
      `artifact.rawMemoryAttempts must contain exactly ${protocol.measuredRuns} attempts`,
    );
  }
  if (rawCancellation.length !== protocol.cancellationRuns) {
    throw new Error(
      `artifact.rawCancellationAttempts must contain exactly ${protocol.cancellationRuns} attempts`,
    );
  }

  rawOpens.forEach((value, index) => {
    const path = `artifact.rawOpens[${index}]`;
    const attempt = record(value, path);
    assertExactKeys(attempt, path, [
      "kind",
      "sampleIndex",
      "token",
      "status",
      "metadataMs",
      "timedOut",
      "firstReadableMs",
      "slideSwitches",
      "error",
    ]);
    assertAttemptBase(attempt, path);
    boolean(attempt.timedOut, `${path}.timedOut`);
    enumeration(attempt.kind, `${path}.kind`, ["cold", "warmup", "measured"]);
    nullable(attempt.metadataMs, `${path}.metadataMs`, nonNegative);
    nullable(attempt.firstReadableMs, `${path}.firstReadableMs`, nonNegative);
    const switches = array(attempt.slideSwitches, `${path}.slideSwitches`);
    switches.forEach((value, switchIndex) => {
      const switchPath = `${path}.slideSwitches[${switchIndex}]`;
      const slideSwitch = record(value, switchPath);
      enumeration(slideSwitch.action, `${switchPath}.action`, [
        "next",
        "previous",
      ]);
      string(slideSwitch.from, `${switchPath}.from`);
      string(slideSwitch.to, `${switchPath}.to`);
      nonNegative(slideSwitch.elapsedMs, `${switchPath}.elapsedMs`);
    });
  });

  rawMemory.forEach((value, index) => {
    const path = `artifact.rawMemoryAttempts[${index}]`;
    const attempt = record(value, path);
    assertExactKeys(attempt, path, [
      "sampleIndex",
      "token",
      "status",
      "snapshots",
      "loadingSnapshotCount",
      "timedOut",
      "peakDefinition",
      "preOpen",
      "peak",
      "steady",
      "postClose",
      "closeStartedAtRendererMs",
      "adapterStopElapsedMs",
      "gcCompletedElapsedMs",
      "resourceCompletionElapsedMs",
      "garbageCollection",
      "diagnosticsAfterClose",
      "resourceReturn",
      "error",
    ]);
    assertCommonResourceAttempt(attempt, path);
    boolean(attempt.timedOut, `${path}.timedOut`);
    integer(attempt.loadingSnapshotCount, `${path}.loadingSnapshotCount`);
    string(attempt.peakDefinition, `${path}.peakDefinition`);
    nullable(
      attempt.closeStartedAtRendererMs,
      `${path}.closeStartedAtRendererMs`,
      nonNegative,
    );
    if (attempt.steady !== null)
      assertSnapshot(attempt.steady, `${path}.steady`);
  });

  rawCancellation.forEach((value, index) => {
    const path = `artifact.rawCancellationAttempts[${index}]`;
    const attempt = record(value, path);
    assertExactKeys(attempt, path, [
      "sampleIndex",
      "token",
      "status",
      "timedOut",
      "sawLoading",
      "sawInFlight",
      "snapshots",
      "loadingSnapshotCount",
      "inFlightSnapshotCount",
      "preOpen",
      "inFlight",
      "peak",
      "postClose",
      "cancellationElapsedMs",
      "adapterStopElapsedMs",
      "gcCompletedElapsedMs",
      "resourceCompletionElapsedMs",
      "garbageCollection",
      "diagnosticsAfterClose",
      "resourceReturn",
      "detached",
      "viewerAbsent",
      "openSettled",
      "adapterDisposed",
      "error",
    ]);
    assertCommonResourceAttempt(attempt, path);
    for (const key of ["timedOut", "sawLoading", "sawInFlight"] as const) {
      boolean(attempt[key], `${path}.${key}`);
    }
    for (const key of [
      "loadingSnapshotCount",
      "inFlightSnapshotCount",
    ] as const) {
      integer(attempt[key], `${path}.${key}`);
    }
    if (attempt.inFlight !== null)
      assertSnapshot(attempt.inFlight, `${path}.inFlight`);
    nullable(
      attempt.cancellationElapsedMs,
      `${path}.cancellationElapsedMs`,
      nonNegative,
    );
    for (const key of [
      "detached",
      "viewerAbsent",
      "openSettled",
      "adapterDisposed",
    ] as const) {
      nullable(attempt[key], `${path}.${key}`, boolean);
    }
  });

  const artifact = value as InstalledPerformanceArtifact;
  if (artifact.resources.bundleBytes !== expectedBundleBytes) {
    throw new Error(
      `artifact.resources.bundleBytes must equal actual production main.js size ${expectedBundleBytes}`,
    );
  }
  const expectedOpenSequence = [
    { kind: "cold", sampleIndex: 1 },
    ...Array.from({ length: artifact.protocol.warmupRuns }, (_, index) => ({
      kind: "warmup",
      sampleIndex: index + 1,
    })),
    ...Array.from({ length: artifact.protocol.measuredRuns }, (_, index) => ({
      kind: "measured",
      sampleIndex: index + 1,
    })),
  ];
  const actualOpenSequence = artifact.rawOpens.map(({ kind, sampleIndex }) => ({
    kind,
    sampleIndex,
  }));
  if (
    actualOpenSequence.some(
      ({ kind, sampleIndex }, index) =>
        kind !== expectedOpenSequence[index]?.kind ||
        sampleIndex !== expectedOpenSequence[index]?.sampleIndex,
    )
  ) {
    throw new Error(
      "artifact.rawOpens must follow the exact cold, warmup, measured sequence",
    );
  }

  artifact.rawMemoryAttempts.forEach((attempt) => {
    const preOpen =
      attempt.snapshots.find(({ label }) => label === "pre-open") ?? null;
    const steady =
      attempt.snapshots.find(({ label }) => label === "steady") ?? null;
    const postClose =
      attempt.snapshots.find(({ label }) => label === "post-close") ?? null;
    const peak = steady
      ? selectActualPeakSnapshot(attempt.snapshots, steady)
      : null;
    assertEqual(
      attempt.preOpen,
      preOpen,
      `memory attempt ${attempt.sampleIndex} selected pre-open snapshot`,
    );
    assertEqual(
      attempt.steady,
      steady,
      `memory attempt ${attempt.sampleIndex} selected steady snapshot`,
    );
    assertEqual(
      attempt.postClose,
      postClose,
      `memory attempt ${attempt.sampleIndex} selected post-close snapshot`,
    );
    assertEqual(
      attempt.peak,
      peak,
      `memory attempt ${attempt.sampleIndex} selected peak snapshot`,
    );
    const loadingSnapshotCount = attempt.snapshots.filter(
      ({ state }) => state === "loading",
    ).length;
    if (attempt.loadingSnapshotCount !== loadingSnapshotCount) {
      throw new Error(
        `memory attempt ${attempt.sampleIndex} loadingSnapshotCount does not match raw snapshots`,
      );
    }
  });

  artifact.rawCancellationAttempts.forEach((attempt) => {
    const preOpen =
      attempt.snapshots.find(({ label }) => label === "pre-open") ?? null;
    const inFlight =
      attempt.snapshots.find(
        ({ lifecyclePhase }) => lifecyclePhase === "adapter-opening",
      ) ?? null;
    const postClose =
      attempt.snapshots.find(({ label }) => label === "post-close") ?? null;
    const peak = inFlight
      ? selectActualPeakSnapshot(attempt.snapshots, inFlight)
      : null;
    assertEqual(
      attempt.preOpen,
      preOpen,
      `cancellation attempt ${attempt.sampleIndex} selected pre-open snapshot`,
    );
    assertEqual(
      attempt.inFlight,
      inFlight,
      `cancellation attempt ${attempt.sampleIndex} selected in-flight snapshot`,
    );
    assertEqual(
      attempt.postClose,
      postClose,
      `cancellation attempt ${attempt.sampleIndex} selected post-close snapshot`,
    );
    assertEqual(
      attempt.peak,
      peak,
      `cancellation attempt ${attempt.sampleIndex} selected peak snapshot`,
    );
    const loadingSnapshotCount = attempt.snapshots.filter(
      ({ state }) => state === "loading",
    ).length;
    const inFlightSnapshotCount = attempt.snapshots.filter(
      ({ lifecyclePhase }) => lifecyclePhase === "adapter-opening",
    ).length;
    if (
      attempt.loadingSnapshotCount !== loadingSnapshotCount ||
      attempt.inFlightSnapshotCount !== inFlightSnapshotCount
    ) {
      throw new Error(
        `cancellation attempt ${attempt.sampleIndex} loading/in-flight counts do not match raw snapshots`,
      );
    }
  });
  if (expectedOutcome === "expected-open-failure") {
    return validateExpectedOpenFailureArtifact(artifact);
  }
  if (artifact.thumbnailReadinessMs.length < artifact.protocol.measuredRuns) {
    throw new Error(
      `artifact.thumbnailReadinessMs must contain at least ${artifact.protocol.measuredRuns} observations`,
    );
  }
  if (
    artifact.mountedThumbnailCounts.length < artifact.protocol.measuredRuns ||
    artifact.mountedThumbnailCounts.some((count) => count <= 0 || count >= 50)
  ) {
    throw new Error(
      `artifact.mountedThumbnailCounts must contain at least ${artifact.protocol.measuredRuns} positive observations strictly below 50`,
    );
  }
  if (
    artifact.backgroundStopObservations.length < 2 ||
    !(["close", "file-switch"] as const).every((reason) =>
      artifact.backgroundStopObservations.some(
        (observation) =>
          observation.reason === reason &&
          observation.elapsedMs <= artifact.protocol.observationWindowMs &&
          observation.pending === 0 &&
          observation.running === 0 &&
          observation.mounted === 0,
      ),
    )
  ) {
    throw new Error(
      "artifact.backgroundStopObservations must prove close and file-switch cleanup at zero pending/running/mounted within the observation window",
    );
  }
  if (
    artifact.rawOpens.some(
      ({ status, timedOut }) => status !== "passed" || timedOut,
    )
  ) {
    throw new Error(
      "artifact.rawOpens must follow the exact cold, warmup, measured sequence with passed status",
    );
  }
  const measuredOpens = artifact.rawOpens.filter(
    ({ kind }) => kind === "measured",
  );
  if (
    measuredOpens.length !== artifact.protocol.measuredRuns ||
    measuredOpens.some(
      ({ status, metadataMs, firstReadableMs, slideSwitches, error }) =>
        status !== "passed" ||
        metadataMs === null ||
        firstReadableMs === null ||
        slideSwitches.length !==
          artifact.protocol.slideSwitchesPerMeasuredRun ||
        error !== null,
    )
  ) {
    throw new Error(
      "artifact measured opens must be complete passed attempts with exact switch counts",
    );
  }
  if (
    artifact.rawMemoryAttempts.some(
      (attempt, index) =>
        attempt.sampleIndex !== index + 1 ||
        attempt.timedOut ||
        attempt.status !== "passed" ||
        attempt.loadingSnapshotCount < 1 ||
        !attempt.snapshots.some(({ state }) => state === "loading") ||
        !attempt.preOpen ||
        !attempt.peak ||
        !attempt.steady ||
        !attempt.postClose ||
        attempt.adapterStopElapsedMs === null ||
        attempt.gcCompletedElapsedMs === null ||
        attempt.resourceCompletionElapsedMs === null ||
        !attempt.garbageCollection ||
        !attempt.diagnosticsAfterClose ||
        !attempt.resourceReturn ||
        !attempt.resourceReturn.passed ||
        attempt.error !== null,
    )
  ) {
    throw new Error(
      "artifact memory attempts must contain complete strict resource-return evidence",
    );
  }
  if (
    artifact.rawCancellationAttempts.some(
      (attempt, index) =>
        attempt.sampleIndex !== index + 1 ||
        attempt.status !== "passed" ||
        attempt.timedOut ||
        !attempt.sawLoading ||
        !attempt.sawInFlight ||
        attempt.inFlightSnapshotCount < 1 ||
        !attempt.snapshots.some(
          ({ lifecyclePhase }) => lifecyclePhase === "adapter-opening",
        ) ||
        !attempt.preOpen ||
        !attempt.inFlight ||
        !attempt.peak ||
        !attempt.postClose ||
        attempt.adapterStopElapsedMs === null ||
        attempt.gcCompletedElapsedMs === null ||
        attempt.resourceCompletionElapsedMs === null ||
        !attempt.garbageCollection ||
        !attempt.diagnosticsAfterClose ||
        !attempt.resourceReturn?.passed ||
        attempt.cancellationElapsedMs === null ||
        attempt.cancellationElapsedMs > artifact.protocol.observationWindowMs ||
        attempt.resourceCompletionElapsedMs >
          artifact.protocol.observationWindowMs ||
        attempt.detached !== true ||
        attempt.viewerAbsent !== true ||
        attempt.openSettled !== true ||
        attempt.adapterDisposed !== true ||
        attempt.error !== null,
    )
  ) {
    throw new Error(
      "artifact cancellation attempts must prove strict in-flight resource return",
    );
  }
  if (artifact.failures.length > 0) {
    throw new Error("artifact committed baseline must not contain failures");
  }

  for (const attempt of artifact.rawMemoryAttempts) {
    const expected = evaluateResourceReturn({
      preOpenHeapBytes: attempt.preOpen!.heapUsedBytes,
      steadyHeapBytes: attempt.steady!.heapUsedBytes,
      postCloseHeapBytes: attempt.postClose!.heapUsedBytes,
      postCloseElapsedMs: attempt.postClose!.elapsedSinceCloseMs!,
      openSettled: true,
      adapterDisposed:
        attempt.diagnosticsAfterClose!.disposed &&
        !attempt.diagnosticsAfterClose!.openPending &&
        !attempt.diagnosticsAfterClose!.rendererActive,
      maxRetainedHeapFraction: artifact.protocol.maxRetainedHeapFraction,
      deadlineMs: artifact.protocol.observationWindowMs,
    });
    assertEqual(
      attempt.resourceReturn,
      expected,
      `memory attempt ${attempt.sampleIndex} resourceReturn`,
    );
  }
  for (const attempt of artifact.rawCancellationAttempts) {
    const expected = evaluateResourceReturn({
      preOpenHeapBytes: attempt.preOpen!.heapUsedBytes,
      steadyHeapBytes: attempt.peak!.heapUsedBytes,
      postCloseHeapBytes: attempt.postClose!.heapUsedBytes,
      postCloseElapsedMs: attempt.postClose!.elapsedSinceCloseMs!,
      openSettled: attempt.openSettled!,
      adapterDisposed: attempt.adapterDisposed!,
      maxRetainedHeapFraction: artifact.protocol.maxRetainedHeapFraction,
      deadlineMs: artifact.protocol.observationWindowMs,
    });
    assertEqual(
      attempt.resourceReturn,
      expected,
      `cancellation attempt ${attempt.sampleIndex} resourceReturn`,
    );
  }

  const firstReadableMs = measuredOpens.map(
    ({ firstReadableMs }) => firstReadableMs!,
  );
  const metadataMs = measuredOpens.map(({ metadataMs }) => metadataMs!);
  const slideSwitchMs = measuredOpens.flatMap(({ slideSwitches }) =>
    slideSwitches.map(({ elapsedMs }) => elapsedMs),
  );
  const measuredCleanup = artifact.rawMemoryAttempts.map((attempt) =>
    resourceCompletionElapsedMs({
      cleanupElapsedMs: attempt.adapterStopElapsedMs!,
      gcCompletedElapsedMs: attempt.gcCompletedElapsedMs!,
      postCloseElapsedMs: attempt.postClose!.elapsedSinceCloseMs!,
    }),
  );
  const cancellationElapsed = artifact.rawCancellationAttempts.map(
    ({ cancellationElapsedMs }) => cancellationElapsedMs!,
  );
  const cancellationResourceCompletion = artifact.rawCancellationAttempts.map(
    (attempt) => {
      if (attempt.cancellationElapsedMs !== attempt.adapterStopElapsedMs) {
        throw new Error(
          `cancellation attempt ${attempt.sampleIndex} cancellation latency must equal adapter-stop latency`,
        );
      }
      const completion = resourceCompletionElapsedMs({
        cleanupElapsedMs: attempt.adapterStopElapsedMs!,
        gcCompletedElapsedMs: attempt.gcCompletedElapsedMs!,
        postCloseElapsedMs: attempt.postClose!.elapsedSinceCloseMs!,
      });
      if (attempt.resourceCompletionElapsedMs !== completion) {
        throw new Error(
          `cancellation attempt ${attempt.sampleIndex} resourceCompletionElapsedMs does not match raw timing evidence`,
        );
      }
      return completion;
    },
  );
  measuredCleanup.forEach((completion, index) => {
    if (
      artifact.rawMemoryAttempts[index]!.resourceCompletionElapsedMs !==
      completion
    ) {
      throw new Error(
        `memory attempt ${index + 1} resourceCompletionElapsedMs does not match raw timing evidence`,
      );
    }
  });
  const expectedResources = {
    memory: artifact.rawMemoryAttempts.flatMap(
      ({ peak, steady, postClose, sampleIndex }) => [
        {
          label: `measured-${sampleIndex}-peak-actual-snapshot-${peak!.sequence}`,
          heapUsedBytes: peak!.heapUsedBytes,
          rssBytes: peak!.rssBytes,
        },
        {
          label: `measured-${sampleIndex}-steady`,
          heapUsedBytes: steady!.heapUsedBytes,
          rssBytes: steady!.rssBytes,
        },
        {
          label: `measured-${sampleIndex}-post-close`,
          heapUsedBytes: postClose!.heapUsedBytes,
          rssBytes: postClose!.rssBytes,
        },
      ],
    ),
    cancellation: artifact.rawCancellationAttempts.map((attempt) => ({
      elapsedMs: attempt.cancellationElapsedMs!,
      detached: attempt.detached!,
      viewerAbsent: attempt.viewerAbsent!,
    })),
    cleanup: [
      ...artifact.rawMemoryAttempts.map((attempt, index) => ({
        elapsedMs: measuredCleanup[index]!,
        unfinishedWorkStopped: attempt.resourceReturn!.adapterStopped,
        resourcesReleased:
          attempt.resourceReturn!.passed &&
          measuredCleanup[index]! <= artifact.protocol.observationWindowMs,
      })),
      ...artifact.rawCancellationAttempts.map((attempt) => ({
        elapsedMs: attempt.resourceCompletionElapsedMs!,
        unfinishedWorkStopped: Boolean(
          attempt.openSettled && attempt.adapterDisposed,
        ),
        resourcesReleased: true,
      })),
    ],
    bundleBytes: artifact.resources.bundleBytes,
    observationWindowMs: artifact.protocol.observationWindowMs,
  };
  assertEqual(artifact.resources, expectedResources, "artifact.resources");

  const expectedSummary = summarizePerformance({
    environment: artifact.environment,
    firstReadableMs,
    slideSwitchMs,
    resources: expectedResources,
    failures: [],
  });
  for (const key of [
    "environment",
    "firstReadable",
    "slideSwitch",
    "resources",
    "failures",
    "gates",
  ] as const) {
    assertEqual(artifact[key], expectedSummary[key], `artifact.${key}`);
  }
  const expectedAnalysis = summarizeInstalledPerformance({
    expectedMeasuredRuns: artifact.protocol.measuredRuns,
    expectedCancellationRuns: artifact.protocol.cancellationRuns,
    expectedResourceCompletionRuns:
      artifact.protocol.measuredRuns + artifact.protocol.cancellationRuns,
    switchesPerRun: artifact.protocol.slideSwitchesPerMeasuredRun,
    metadataMs,
    firstReadableMs,
    slideSwitchMs,
    thumbnailReadinessMs: artifact.thumbnailReadinessMs,
    mountedThumbnailCounts: artifact.mountedThumbnailCounts,
    memory: artifact.rawMemoryAttempts.map(({ peak, steady, postClose }) => ({
      peak: peak!,
      steady: steady!,
      postClose: postClose!,
    })),
    cancellationElapsedMs: cancellationElapsed,
    resourceCompletionElapsedMs: [
      ...measuredCleanup,
      ...cancellationResourceCompletion,
    ],
    failures: expectedSummary.failures,
    budgets: PERFORMANCE_BUDGETS,
  });
  assertEqual(artifact.analysis, expectedAnalysis, "artifact.analysis");
  return artifact;
}
