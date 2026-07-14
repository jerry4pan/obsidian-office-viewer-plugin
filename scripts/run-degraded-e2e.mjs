import { spawnSync } from "node:child_process";

function run(command, args, env) {
  return spawnSync(command, args, {
    env,
    stdio: "inherit",
  });
}

const normalEnvironment = { ...process.env };
delete normalEnvironment.PPTX_RENDERER_TEST_ADAPTER;
const degradedEnvironment = {
  ...normalEnvironment,
  PPTX_RENDERER_TEST_ADAPTER: "degraded-navigation",
};

let result;
try {
  result = run("npm", ["run", "build"], degradedEnvironment);
  if ((result.status ?? 1) === 0) {
    result = run(
      "npx",
      ["wdio", "run", "wdio.degraded.conf.mts"],
      degradedEnvironment,
    );
  }
} finally {
  const restored = run("npm", ["run", "build"], normalEnvironment);
  if ((restored.status ?? 1) !== 0) {
    throw new Error("Failed to restore the production renderer bundle");
  }
}

if (result?.error) throw result.error;
process.exitCode = result?.status ?? 1;
