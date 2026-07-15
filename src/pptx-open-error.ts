export type PptxOpenErrorCategory =
  | "unsupported-legacy"
  | "malformed"
  | "protected"
  | "incompatible"
  | "resource-exhausted"
  | "cancelled"
  | "unknown";

export class PptxOpenError extends Error {
  override readonly name = "PptxOpenError";

  constructor(
    readonly category: PptxOpenErrorCategory,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
