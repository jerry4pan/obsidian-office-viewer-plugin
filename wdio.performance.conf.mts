import { config as baseConfig } from "./wdio.conf.mts";

export const config: WebdriverIO.Config = {
  ...baseConfig,
  specs: ["./tests/e2e/**/*.performance.ts"],
  mochaOpts: {
    ...baseConfig.mochaOpts,
    timeout: 300_000,
  },
};
