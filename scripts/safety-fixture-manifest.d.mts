export type SafetyFixtureCategory =
  | "malformed"
  | "protected"
  | "incompatible"
  | "unknown"
  | null;

export interface ParsedSafetyFixtureRecord {
  readonly id: string;
  readonly category: SafetyFixtureCategory;
  readonly provenance: string;
  readonly fixturePath: string;
  readonly vaultPath: string;
}

export function parseSafetyFixtureManifest(
  value: unknown,
): readonly ParsedSafetyFixtureRecord[];
