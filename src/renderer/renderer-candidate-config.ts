export type PptxRendererCandidate = "aiden" | "pptx-preview";

export interface RendererCandidateConfig {
  readonly id: PptxRendererCandidate;
  readonly packageName: string;
  readonly version: string;
  readonly label: string;
  readonly evidenceId: string;
}

const CANDIDATES: Readonly<
  Record<PptxRendererCandidate, RendererCandidateConfig>
> = {
  aiden: {
    id: "aiden",
    packageName: "@aiden0z/pptx-renderer",
    version: "1.2.4",
    label: "@aiden0z/pptx-renderer@1.2.4",
    evidenceId: "aiden-pptx-renderer-1.2.4",
  },
  "pptx-preview": {
    id: "pptx-preview",
    packageName: "pptx-preview",
    version: "1.0.7",
    label: "pptx-preview@1.0.7",
    evidenceId: "pptx-preview-1.0.7",
  },
};

export function resolveRendererCandidate(
  candidate: string | undefined,
): PptxRendererCandidate {
  const resolved = candidate ?? "aiden";
  if (resolved === "aiden" || resolved === "pptx-preview") return resolved;
  throw new Error(`Unsupported PPTX renderer candidate "${resolved}"`);
}

export function getRendererCandidateConfig(
  candidate: PptxRendererCandidate,
): RendererCandidateConfig {
  return CANDIDATES[candidate];
}
