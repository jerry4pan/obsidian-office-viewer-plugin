export type PptxOpenErrorCategory =
  | "malformed"
  | "protected"
  | "incompatible"
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
