import { browser } from "@wdio/globals";
import type { CORPUS_ENVIRONMENT } from "./corpus-manifest";

type CorpusEnvironment = typeof CORPUS_ENVIRONMENT;

export async function applyFixedEnvironment(
  environment: CorpusEnvironment,
): Promise<void> {
  const actual = await browser.execute(async (expected) => {
    const electron = (
      window as typeof window & {
        electron: {
          remote: {
            getCurrentWindow(): {
              setContentSize(width: number, height: number): Promise<void>;
            };
          };
        };
      }
    ).electron;
    await electron.remote
      .getCurrentWindow()
      .setContentSize(expected.viewport.width, expected.viewport.height);
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
    document.documentElement.style.zoom = String(expected.zoom);
    document.body.style.fontFamily = expected.fontFamily;
    await document.fonts.load(`16px "${expected.fontFamily}"`);
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      fontReady: document.fonts.check(`16px "${expected.fontFamily}"`),
    };
  }, environment);
  if (
    actual.width !== environment.viewport.width ||
    actual.height !== environment.viewport.height ||
    !actual.fontReady
  ) {
    throw new Error(
      `fixed environment unavailable: ${actual.width}x${actual.height}, fontReady=${actual.fontReady}`,
    );
  }
}

export async function installNetworkGuard(): Promise<void> {
  await browser.execute(() => {
    const guarded = window as typeof window & { __pptxNetworkRequests?: string[] };
    guarded.__pptxNetworkRequests = [];
    guarded.fetch = ((input: RequestInfo | URL) => {
      guarded.__pptxNetworkRequests?.push(String(input));
      return Promise.reject(new Error("network disabled during PPTX acceptance"));
    }) as typeof fetch;
    XMLHttpRequest.prototype.open = function (
      _method: string,
      url: string | URL,
    ): void {
      guarded.__pptxNetworkRequests?.push(String(url));
      throw new Error("network disabled during PPTX acceptance");
    };
  });
}

export async function assertNoNetworkRequests(): Promise<void> {
  const requests = await browser.execute(
    () =>
      (window as typeof window & { __pptxNetworkRequests?: string[] })
        .__pptxNetworkRequests ?? [],
  );
  if (requests.length > 0) {
    throw new Error(`PPTX acceptance attempted network access: ${requests.join(", ")}`);
  }
}
