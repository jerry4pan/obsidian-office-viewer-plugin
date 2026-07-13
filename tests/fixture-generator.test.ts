import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function fixtureHash(): Promise<string> {
  const bytes = await readFile("tests/fixtures/minimal.pptx");
  return createHash("sha256").update(bytes).digest("hex");
}

describe("minimal fixture generator", () => {
  it("keeps the committed fixture stable during normal verification", async () => {
    const before = await fixtureHash();

    await execFileAsync(process.execPath, ["scripts/generate-minimal-fixture.mjs"]);

    expect(await fixtureHash()).toBe(before);
    expect(await readFile("tests/vault/minimal.pptx")).toEqual(
      await readFile("tests/fixtures/minimal.pptx"),
    );
  });
});
