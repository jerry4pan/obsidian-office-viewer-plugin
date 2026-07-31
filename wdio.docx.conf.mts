import path from "node:path";

export const config: WebdriverIO.Config = {
  runner: "local",
  framework: "mocha",
  specs: ["./tests/e2e/docx-reading-search.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "obsidian",
      browserVersion: "1.12.7",
      "goog:chromeOptions": { args: ["--lang=en-US"] },
      "wdio:obsidianOptions": {
        installerVersion: "1.12.7",
        plugins: ["."],
        vault: "tests/vault",
      },
    },
  ],
  services: ["obsidian"],
  reporters: ["obsidian"],
  cacheDir: path.resolve(".obsidian-cache"),
  mochaOpts: { ui: "bdd", timeout: 120_000 },
  logLevel: "warn",
};
