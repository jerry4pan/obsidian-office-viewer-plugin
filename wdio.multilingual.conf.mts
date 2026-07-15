import path from "node:path";

const hostLanguages = ["en-US", "zh-CN", "zh-TW", "fr"];

export const config: WebdriverIO.Config = {
  runner: "local",
  framework: "mocha",
  specs: ["./tests/e2e/multilingual.e2e.ts"],
  maxInstances: 1,
  capabilities: hostLanguages.map((language) => ({
    browserName: "obsidian",
    browserVersion: "latest",
    "goog:chromeOptions": {
      args: [`--lang=${language}`],
    },
    "wdio:obsidianOptions": {
      installerVersion: "latest",
      plugins: ["."],
      vault: "tests/vault",
    },
  })),
  services: ["obsidian"],
  reporters: ["obsidian"],
  cacheDir: path.resolve(".obsidian-cache"),
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },
  logLevel: "warn",
};
