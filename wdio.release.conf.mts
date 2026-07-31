import path from "node:path";

export const config: WebdriverIO.Config = {
  runner: "local",
  framework: "mocha",
  specs: ["./tests/e2e/packaged-release.release.e2e.ts"],
  maxInstances: 1,
  capabilities: [{
    browserName: "obsidian",
    browserVersion: "1.12.7",
    "goog:chromeOptions": { args: ["--lang=en-US"] },
    "wdio:obsidianOptions": {
      installerVersion: "1.12.7",
      plugins: ["artifacts/release/plugin"],
      vault: "artifacts/release/vault",
    },
  }],
  services: ["obsidian"],
  reporters: ["obsidian"],
  cacheDir: path.resolve(".obsidian-cache"),
  mochaOpts: { ui: "bdd", timeout: 120_000 },
  logLevel: "warn",
};
