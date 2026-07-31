import path from "node:path";

const appVersion = process.env.OBSIDIAN_TEST_VERSION ?? "latest";
const installerVersion =
  process.env.OBSIDIAN_INSTALLER_VERSION ?? "latest";

export const config: WebdriverIO.Config = {
  runner: "local",
  framework: "mocha",
  specs: ["./tests/e2e/**/*.e2e.ts"],
  exclude: [
    "./tests/e2e/pptx-degraded.e2e.ts",
    "./tests/e2e/multilingual.e2e.ts",
    "./tests/e2e/packaged-release.release.e2e.ts",
  ],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "obsidian",
      browserVersion: appVersion,
      "goog:chromeOptions": {
        args: ["--lang=en-US"],
      },
      "wdio:obsidianOptions": {
        installerVersion,
        plugins: ["."],
        vault: "tests/vault"
      }
    }
  ],
  services: ["obsidian"],
  reporters: ["obsidian"],
  cacheDir: path.resolve(".obsidian-cache"),
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000
  },
  logLevel: "warn"
};
