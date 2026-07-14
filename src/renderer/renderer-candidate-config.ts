import candidateManifest from "./renderer-candidates.json";

export type PptxRendererCandidate = keyof typeof candidateManifest;

export interface RendererCandidateConfig {
  readonly id: PptxRendererCandidate;
  readonly packageName: string;
  readonly version: string;
  readonly label: string;
  readonly evidenceId: string;
}

const CANDIDATES = candidateManifest as Readonly<
  Record<PptxRendererCandidate, RendererCandidateConfig>
>;

export function resolveRendererCandidate(
  candidate: string | undefined,
): PptxRendererCandidate {
  const resolved = candidate ?? "aiden";
  if (Object.hasOwn(CANDIDATES, resolved)) {
    return resolved as PptxRendererCandidate;
  }
  throw new Error(`Unsupported PPTX renderer candidate "${resolved}"`);
}

export function getRendererCandidateConfig(
  candidate: PptxRendererCandidate,
): RendererCandidateConfig {
  return CANDIDATES[candidate];
}
