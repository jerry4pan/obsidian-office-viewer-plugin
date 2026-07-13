import type { PptxOpenErrorCategory } from "../../src/pptx-open-error";
import { parseSafetyFixtureManifest } from "../../scripts/safety-fixture-manifest.mjs";
import manifest from "./failure-fixtures.json";

export interface SafetyFixtureRecord {
  readonly id: string;
  readonly category: PptxOpenErrorCategory | null;
  readonly provenance: string;
  readonly fixturePath: string;
  readonly vaultPath: string;
}

export interface ExpectedFailureFixture extends SafetyFixtureRecord {
  readonly category: PptxOpenErrorCategory;
}

export interface SafeRenderFixture extends SafetyFixtureRecord {
  readonly category: null;
}

export const allSafetyFixtures: readonly SafetyFixtureRecord[] =
  parseSafetyFixtureManifest(manifest);
export const expectedFailureFixtures = allSafetyFixtures.filter(
  (fixture): fixture is ExpectedFailureFixture => fixture.category !== null,
);
export const safeRenderFixtures = allSafetyFixtures.filter(
  (fixture): fixture is SafeRenderFixture => fixture.category === null,
);

export function fixturePath(fixture: SafetyFixtureRecord): string {
  return fixture.fixturePath;
}

export function vaultPath(fixture: SafetyFixtureRecord): string {
  return fixture.vaultPath;
}
