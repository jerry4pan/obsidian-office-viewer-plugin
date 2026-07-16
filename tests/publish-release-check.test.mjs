import { describe, expect, it } from "vitest";
import {
  checkPublishRelease,
  collectPublishReleaseErrors,
} from "../scripts/check-publish-release.mjs";
import { releaseExists } from "../scripts/run-check-publish-release.mjs";

const HEAD = "a".repeat(40);
const TAG_COMMIT = "b".repeat(40);

describe("publish release checks", () => {
  it("passes when the tag matches HEAD and no release exists yet", () => {
    expect(
      checkPublishRelease({
        manifestVersion: "0.1.6",
        publishContext: {
          releaseTag: "v0.1.6",
          headCommit: HEAD,
          tagCommit: HEAD,
          publishedReleaseExists: false,
        },
      }),
    ).toEqual([]);
  });

  it("accepts tags without a v prefix", () => {
    expect(
      checkPublishRelease({
        manifestVersion: "0.1.6",
        publishContext: {
          releaseTag: "0.1.6",
          headCommit: HEAD,
          tagCommit: HEAD,
          publishedReleaseExists: false,
        },
      }),
    ).toEqual([]);
  });

  it("fails when the tag commit does not match HEAD", () => {
    expect(
      collectPublishReleaseErrors({
        releaseTag: "v0.1.6",
        headCommit: HEAD,
        tagCommit: TAG_COMMIT,
        publishedReleaseExists: false,
      }),
    ).toContain("release tag commit does not match HEAD");
  });

  it("fails when a GitHub release already exists for the tag", () => {
    expect(
      collectPublishReleaseErrors({
        releaseTag: "v0.1.5",
        headCommit: HEAD,
        tagCommit: HEAD,
        publishedReleaseExists: true,
      }),
    ).toContain(
      "GitHub release for v0.1.5 already exists; bump the version before publishing",
    );
  });

  it("fails when the tag version does not match the manifest", () => {
    expect(
      checkPublishRelease({
        manifestVersion: "0.1.5",
        publishContext: {
          releaseTag: "v0.1.6",
          headCommit: HEAD,
          tagCommit: HEAD,
          publishedReleaseExists: false,
        },
      }),
    ).toContain("release tag v0.1.6 does not match manifest version 0.1.5");
  });

  it("treats only an explicit not-found response as an absent release", () => {
    const viewedTags = [];
    const viewRelease = (tag) => {
      viewedTags.push(tag);
      const error = new Error("release not found");
      error.stderr = "release not found\n";
      throw error;
    };

    expect(releaseExists("v0.1.6", viewRelease)).toBe(false);
    expect(viewedTags).toEqual(["v0.1.6", "0.1.6"]);
  });

  it("stops publishing when the GitHub release lookup fails operationally", () => {
    const viewRelease = () => {
      const error = new Error("GitHub API request failed");
      error.stderr = "HTTP 503 Service Unavailable\n";
      throw error;
    };

    expect(() => releaseExists("v0.1.6", viewRelease)).toThrow(
      "GitHub API request failed",
    );
  });
});
