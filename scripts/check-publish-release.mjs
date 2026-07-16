/**
 * @typedef {Object} PublishContext
 * @property {string} releaseTag
 * @property {string} headCommit
 * @property {string} tagCommit
 * @property {boolean} publishedReleaseExists
 */

/**
 * @param {PublishContext} publishContext
 * @returns {string[]}
 */
export function collectPublishReleaseErrors(publishContext) {
  const errors = [];

  if (publishContext.tagCommit !== publishContext.headCommit) {
    errors.push("release tag commit does not match HEAD");
  }

  if (publishContext.publishedReleaseExists) {
    errors.push(
      `GitHub release for ${publishContext.releaseTag} already exists; bump the version before publishing`,
    );
  }

  if (!publishContext.releaseTag) {
    errors.push("release tag is empty");
  }

  if (publishContext.releaseTag.startsWith("v")) {
    errors.push(
      `release tag ${publishContext.releaseTag} must not start with v; publish plain ${publishContext.releaseTag.slice(1)} instead`,
    );
  }

  return errors;
}

/**
 * @param {object} params
 * @param {string} params.manifestVersion
 * @param {PublishContext} params.publishContext
 * @returns {string[]}
 */
export function checkPublishRelease({ manifestVersion, publishContext }) {
  const errors = collectPublishReleaseErrors(publishContext);

  if (publishContext.releaseTag !== manifestVersion) {
    errors.push(
      `release tag ${publishContext.releaseTag} does not match manifest version ${manifestVersion}`,
    );
  }

  return errors;
}
