import { config as baseConfig } from "./wdio.docx.conf.mts";

export const config: WebdriverIO.Config = {
  ...baseConfig,
  specs: ["./tests/e2e/**/*.compatibility.ts"],
};
