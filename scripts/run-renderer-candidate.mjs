import { spawnSync } from "node:child_process";
import process from "node:process";
import rendererCandidates from "../src/renderer/renderer-candidates.json" with {
  type: "json",
};

const [candidate, task] = process.argv.slice(2);
const tasks = new Set([
  "build",
  "test:e2e",
  "test:compatibility",
  "test:performance",
  "test:performance:baseline",
]);

if (!candidate || !Object.hasOwn(rendererCandidates, candidate)) {
  throw new Error(`Unsupported PPTX renderer candidate "${candidate ?? ""}"`);
}
if (!task || !tasks.has(task)) {
  throw new Error(`Unsupported renderer acceptance task "${task ?? ""}"`);
}

const result = spawnSync("npm", ["run", task], {
  env: { ...process.env, PPTX_RENDERER_CANDIDATE: candidate },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
