export function reportNonFatalError(message: string, error: unknown): void {
  try {
    console.error(message, error);
  } catch {
    // Reporting must never turn a contained lifecycle failure into a rejection.
  }
}
