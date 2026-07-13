import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writePerformanceProgressAtomic } from "./performance-progress";

describe("installed performance progress checkpoint", () => {
  it("atomically serializes completed raw attempts and failures", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pptx-progress-"));
    const target = path.join(directory, "progress.json");

    try {
      await writePerformanceProgressAtomic(target, {
        environment: { renderer: "candidate@1" },
        protocol: { measuredRuns: 10 },
        rawOpens: [{ kind: "cold", status: "passed" }],
        rawMemoryAttempts: [],
        rawCancellationAttempts: [],
        failures: [],
      });

      expect(JSON.parse(await readFile(target, "utf8"))).toMatchObject({
        rawOpens: [{ kind: "cold", status: "passed" }],
        failures: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
