import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { checkPublishRelease } from "./check-publish-release.mjs";
import { checkRelease } from "./check-release.mjs";

function readCommit(ref) {
  try {
    return execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`git ref ${ref} is not available in the local repository`);
  }
}

function readTagCommit(releaseTag) {
  try {
    return execFileSync("git", ["rev-list", "-n", "1", releaseTag], {
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error(`release tag ${releaseTag} is not available in the local repository`);
  }
}

function viewRelease(releaseTag) {
  execFileSync("gh", ["release", "view", releaseTag, "--json", "tagName"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
  });
}

function isReleaseNotFound(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    String(error.stderr).trim() === "release not found"
  );
}

export function releaseExists(releaseTag, lookupRelease = viewRelease) {
  try {
    lookupRelease(releaseTag);
    return true;
  } catch (error) {
    if (!isReleaseNotFound(error)) throw error;
  }

  return false;
}

function resolvePublishContext(releaseTag) {
  return {
    releaseTag,
    headCommit: readCommit("HEAD"),
    tagCommit: readTagCommit(releaseTag),
    publishedReleaseExists: releaseExists(releaseTag),
  };
}

export async function runCheckPublishRelease({
  releaseTag = process.env.RELEASE_TAG,
} = {}) {
  if (!releaseTag) {
    throw new Error("RELEASE_TAG is required for publish release checks");
  }

  const metadata = await checkRelease({ releaseTag });
  const publishContext = resolvePublishContext(releaseTag);
  const errors = checkPublishRelease({
    manifestVersion: metadata.version,
    publishContext,
  });

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return { ...metadata, publishContext };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runCheckPublishRelease();
  process.stdout.write(
    `Publish release checks passed for ${result.id} v${result.version} (${result.publishContext.releaseTag}).\n`,
  );
}
