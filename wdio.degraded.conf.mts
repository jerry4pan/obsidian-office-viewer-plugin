import { config as baseConfig } from "./wdio.conf.mts";

export const config: WebdriverIO.Config = {
  ...baseConfig,
  specs: ["./tests/e2e/pptx-degraded.e2e.ts"],
  exclude: [],
};
