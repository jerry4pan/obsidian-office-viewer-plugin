import { config as docxConfig } from "./wdio.docx.conf.mts";

export const config: WebdriverIO.Config = {
  ...docxConfig,
  specs: ["./tests/e2e/docx-compatibility.compatibility.ts"],
};
