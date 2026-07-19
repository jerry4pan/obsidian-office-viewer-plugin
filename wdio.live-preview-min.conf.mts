import { config as baseConfig } from "./wdio.conf.mts";

export const config: WebdriverIO.Config = {
  ...baseConfig,
  specs: ["./tests/e2e/pptx-live-preview-embed.e2e.ts"],
  capabilities: [
    {
      browserName: "obsidian",
      browserVersion: "earliest",
      "goog:chromeOptions": {
        args: ["--lang=en-US"],
      },
      "wdio:obsidianOptions": {
        installerVersion: "earliest",
        plugins: ["."],
        vault: "tests/vault",
      },
    },
  ],
};
