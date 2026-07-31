export type DocxOpenErrorCategory =
  | "malformed"
  | "protected"
  | "incompatible"
  | "resource-exhausted"
  | "cancelled"
  | "unknown";

export class DocxOpenError extends Error {
  constructor(
    readonly category: DocxOpenErrorCategory,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DocxOpenError";
  }
}
