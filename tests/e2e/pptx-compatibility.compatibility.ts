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
} from "../compatibility/corpus-manifest";
import { inspectActiveFixture } from "../compatibility/fixture-inspection";
import { fileSha256 } from "../compatibility/hash";

const artifactDir = path.resolve("artifacts/compatibility");
const updateBaselines = process.env.UPDATE_COMPATIBILITY_BASELINES === "1";

describe("installed PPTX compatibility corpus", () => {
  it("renders, captures and classifies every representative fixture", async () => {
    await mkdir(artifactDir, { recursive: true });
    await applyFixedEnvironment(CORPUS_ENVIRONMENT);
    await installNetworkGuard();

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

        ({ expectedContent, readableContent } = await inspectActiveFixture(
          fixture.mainContentChecks,
        ));
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
        reviewClassification: fixture.review.classification,
        reviewReason: fixture.review.reason,
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
      `${JSON.stringify({ environment: CORPUS_ENVIRONMENT, ...summary }, null, 2)}\n`,
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
