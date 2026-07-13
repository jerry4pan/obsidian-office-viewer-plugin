import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getCandidateBaselineApproval,
  type CorpusFixture,
} from "./corpus-manifest";
import { fileSha256, sha256 } from "./hash";
import { assertVisualMatch, comparePngBuffers } from "./visual-regression";
import { activeRendererAcceptanceConfig } from "../support/renderer-candidate";

const renderer = activeRendererAcceptanceConfig();
const { paths } = renderer;
const artifactDir = path.join(paths.compatibilityArtifactDir, "current");
const baselineDir = paths.compatibilityBaselineDir;

export async function captureApprovedBaseline(
  fixture: CorpusFixture,
  slide: { saveScreenshot(path: string): Promise<Buffer> },
  update: boolean,
  maximumRatio: number,
): Promise<number> {
  await mkdir(artifactDir, { recursive: true });
  await mkdir(baselineDir, { recursive: true });
  const currentPath = path.join(artifactDir, `${fixture.id}.png`);
  const baselinePath = path.join(baselineDir, `${fixture.id}.png`);
  const current = await slide.saveScreenshot(currentPath);
  if (update) await writeFile(baselinePath, current);

  const approval = getCandidateBaselineApproval(fixture, renderer.candidate.id);
  const approvedHash = await fileSha256(baselinePath);
  if (approvedHash !== approval.sha256) {
    throw new Error(
      `${fixture.id} baseline hash is not approved for ${renderer.candidate.id}; update its baseline approval hash and reason after visual review (actual ${approvedHash})`,
    );
  }
  if (approval.reason.trim().length < 10) {
    throw new Error(
      `${fixture.id} baseline approval reason is missing for ${renderer.candidate.id}`,
    );
  }
  const baseline = await readFile(baselinePath);
  if (sha256(current) === approvedHash) return 0;
  const diff = comparePngBuffers(baseline, current);
  assertVisualMatch(fixture.id, diff, maximumRatio);
  return diff.ratio;
}
