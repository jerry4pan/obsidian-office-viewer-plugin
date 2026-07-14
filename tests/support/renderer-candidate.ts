import path from "node:path";
import {
  getRendererCandidateConfig,
  resolveRendererCandidate,
  type PptxRendererCandidate,
} from "../../src/renderer/renderer-candidate-config";

export function activeRendererCandidate(): PptxRendererCandidate {
  return resolveRendererCandidate(process.env.PPTX_RENDERER_CANDIDATE);
}

export function acceptancePathsForCandidate(
  candidate: PptxRendererCandidate,
) {
  const { evidenceId } = getRendererCandidateConfig(candidate);
  return {
    compatibilityArtifactDir: path.resolve(
      "artifacts/compatibility",
      evidenceId,
    ),
    compatibilityBaselineDir: path.resolve(
      "tests/compatibility/baselines",
      evidenceId,
    ),
    performanceArtifactDir: path.resolve("artifacts/performance", evidenceId),
  } as const;
}

export function activeRendererAcceptanceConfig() {
  const candidate = activeRendererCandidate();
  return {
    candidate: getRendererCandidateConfig(candidate),
    paths: acceptancePathsForCandidate(candidate),
  } as const;
}
