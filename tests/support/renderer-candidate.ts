import path from "node:path";
import {
  getRendererCandidateConfig,
  resolveRendererCandidate,
  type PptxRendererCandidate,
} from "../../src/renderer/renderer-candidate-config";

const PERFORMANCE_EVIDENCE_IDS: Readonly<
  Record<PptxRendererCandidate, string>
> = {
  aiden: "aiden-pptx-renderer-1.2.4-2026-07-19",
  "pptx-preview": "pptx-preview-1.0.7",
};

export function activeRendererCandidate(): PptxRendererCandidate {
  return resolveRendererCandidate(process.env.PPTX_RENDERER_CANDIDATE);
}

export function acceptancePathsForCandidate(
  candidate: PptxRendererCandidate,
) {
  const { evidenceId } = getRendererCandidateConfig(candidate);
  const performanceEvidenceId = PERFORMANCE_EVIDENCE_IDS[candidate];
  return {
    compatibilityArtifactDir: path.resolve(
      "artifacts/compatibility",
      evidenceId,
    ),
    compatibilityBaselineDir: path.resolve(
      "tests/compatibility/baselines",
      evidenceId,
    ),
    performanceArtifactDir: path.resolve(
      "artifacts/performance",
      performanceEvidenceId,
    ),
  } as const;
}

export function activeRendererAcceptanceConfig() {
  const candidate = activeRendererCandidate();
  return {
    candidate: getRendererCandidateConfig(candidate),
    performanceEvidenceId: PERFORMANCE_EVIDENCE_IDS[candidate],
    paths: acceptancePathsForCandidate(candidate),
  } as const;
}
