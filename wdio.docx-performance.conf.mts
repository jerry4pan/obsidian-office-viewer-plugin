import { config as docxConfig } from "./wdio.docx.conf.mts";

export const config: WebdriverIO.Config = {
  ...docxConfig,
  specs: ["./tests/e2e/docx-performance.performance.ts"],
  mochaOpts: { ui: "bdd", timeout: 300_000 },
};
