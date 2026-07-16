import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  renderCompatibilityMarkdown,
  summarizeCompatibility,
  type CompatibilityObservation,
} from "../../src/compatibility/compatibility-report";
import { captureApprovedBaseline } from "../compatibility/baseline";
import {
  applyFixedEnvironment,
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";
import {
  CORPUS_ENVIRONMENT,
  CORPUS_EXPECTED_GATE,
  corpusManifest,
  getCandidateReview,
} from "../compatibility/corpus-manifest";
import { inspectActiveFixture } from "../compatibility/fixture-inspection";
import { fileSha256 } from "../compatibility/hash";
import { activeRendererAcceptanceConfig } from "../support/renderer-candidate";
import {
  closeSettings,
  setDiagnosticSummaryEnabled,
} from "./office-viewer-settings";

const renderer = activeRendererAcceptanceConfig();
const artifactDir = renderer.paths.compatibilityArtifactDir;
const updateBaselines = process.env.UPDATE_COMPATIBILITY_BASELINES === "1";

describe("installed PPTX compatibility corpus", () => {
  it("detects main-slide font labels when thumbnails duplicate slide content", async () => {
    await applyFixedEnvironment(CORPUS_ENVIRONMENT);
    const fixture = corpusManifest.find(({ id }) => id === "text-theme-wide");
    if (!fixture) throw new Error("text-theme-wide fixture is missing");

    await obsidianPage.openFile(fixture.vaultPath);
    const root = await browser.$(".workspace-leaf.mod-active .pptx-viewer");
    await root.waitForExist({ timeout: 30_000 });
    await browser.waitUntil(async () =>
      (await root.getAttribute("data-state")) === "ready" &&
      (await root.getText()).includes("Quarterly Brief"), {
      timeout: 30_000,
      timeoutMsg: "text-theme-wide did not render its main marker",
    });

    const fontLabels = fixture.mainContentChecks
      .filter((check) => check.kind === "font")
      .map(({ label }) => label);
    const { readableContent } = await inspectActiveFixture(
      fixture.mainContentChecks,
    );
    expect(readableContent).toEqual(expect.arrayContaining(fontLabels));
  });

  it("renders, captures and classifies every representative fixture", async () => {
    await mkdir(artifactDir, { recursive: true });
    await applyFixedEnvironment(CORPUS_ENVIRONMENT);
    await installNetworkGuard();
    await setDiagnosticSummaryEnabled(true, "Diagnostic summary");
    await closeSettings();

    const sourceHashes = new Map<string, string>();
    for (const fixture of corpusManifest) {
      sourceHashes.set(
        fixture.id,
        await fileSha256(path.resolve("tests/vault", fixture.vaultPath)),
      );
    }

    const observations: CompatibilityObservation[] = [];
    const failures: string[] = [];
    for (const fixture of corpusManifest) {
      const review = getCandidateReview(fixture, renderer.candidate.id);
      let visualDiffRatio = 0;
      let error: string | undefined;
      let expectedContent: readonly string[] = fixture.mainContentChecks.map(
        ({ label }) => label,
      );
      let readableContent: readonly string[] = [];
      try {
        const currentMarker = fixture.mainContentChecks.find(
          (check) => check.kind === "text" || check.kind === "font",
        );
        if (!currentMarker || (currentMarker.kind !== "text" && currentMarker.kind !== "font")) {
          throw new Error(`${fixture.id} has no text synchronization marker`);
        }
        await obsidianPage.openFile(fixture.vaultPath);
        const root = await browser.$(
          ".workspace-leaf.mod-active .pptx-viewer",
        );
        await root.waitForExist({ timeout: 30_000 });
        await browser.waitUntil(async () => {
          const state = await root.getAttribute("data-state");
          if (state === "error") return true;
          return state === "ready" && (await root.getText()).includes(currentMarker.text);
        }, {
          timeout: 30_000,
          timeoutMsg: `${fixture.id} did not render its current-file marker`,
        });
        if ((await root.getAttribute("data-state")) !== "ready") {
          throw new Error("view reached error state");
        }
        await browser.waitUntil(async () => {
          const observedWarnings = (await root.getAttribute(
            "data-warning-categories",
          ))?.split(",").filter(Boolean) ?? [];
          return JSON.stringify(observedWarnings) ===
            JSON.stringify([...fixture.runtimeWarnings].sort());
        }, {
          timeout: 7_000,
          timeoutMsg: `${fixture.id} did not expose its compatibility warnings`,
        });

        // Candidate chart renderers may finish an internal animation after the
        // view becomes readable. Capture only after that fixed settling window
        // so the shared zero-pixel drift gate compares stable output.
        await browser.pause(1_200);

        ({ expectedContent, readableContent } = await inspectActiveFixture(
          fixture.mainContentChecks,
        ));
        const manuallyUnreadable = new Set(review.unreadableContent);
        readableContent = readableContent.filter(
          (label) => !manuallyUnreadable.has(label),
        );
        visualDiffRatio = await captureApprovedBaseline(
          fixture,
          await root.$(".pptx-viewer__slide"),
          updateBaselines,
          CORPUS_ENVIRONMENT.maxVisualDiffRatio,
        );
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        failures.push(`${fixture.id}: ${error}`);
      }
      observations.push({
        fixtureId: fixture.id,
        title: fixture.title,
        expectedContent,
        readableContent,
        reviewClassification: review.classification,
        reviewReason: review.reason,
        visualDiffRatio,
        ...(error ? { error } : {}),
      });
    }

    for (const fixture of corpusManifest) {
      const currentHash = await fileSha256(
        path.resolve("tests/vault", fixture.vaultPath),
      );
      if (currentHash !== sourceHashes.get(fixture.id)) {
        failures.push(`${fixture.id}: source PPTX changed during compatibility run`);
      }
    }
    await assertNoNetworkRequests();

    const summary = summarizeCompatibility(
      observations,
      CORPUS_ENVIRONMENT.readabilityGate,
    );
    await writeFile(
      path.join(artifactDir, "results.json"),
      `${JSON.stringify({
        candidate: renderer.candidate.id,
        environment: {
          ...CORPUS_ENVIRONMENT,
          renderer: renderer.candidate.label,
        },
        ...summary,
      }, null, 2)}\n`,
    );
    await writeFile(
      path.join(artifactDir, "summary.md"),
      renderCompatibilityMarkdown(summary),
    );
    if (summary.gatePassed !== CORPUS_EXPECTED_GATE) {
      failures.push(
        `readability gate was ${summary.gatePassed ? "PASS" : "FAIL"}, expected ${CORPUS_EXPECTED_GATE ? "PASS" : "FAIL"}`,
      );
    }
    if (failures.length > 0) throw new Error(failures.join("\n"));
  });
});
