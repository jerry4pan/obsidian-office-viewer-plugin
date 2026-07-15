const errorCategories = new Set([
  "malformed",
  "protected",
  "incompatible",
  "resource-exhausted",
  "unknown",
]);

function requireString(record, field) {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Safety fixture ${field} must be a non-empty string`);
  }
  return value;
}

function requireScopedPath(value, prefix, field) {
  if (
    !value.startsWith(prefix) ||
    !value.endsWith(".pptx") ||
    value.includes("..") ||
    value.includes("\\")
  ) {
    throw new Error(`Safety fixture ${field} must stay under ${prefix}`);
  }
}

export function parseSafetyFixtureManifest(value) {
  if (!Array.isArray(value)) throw new Error("Safety fixture manifest must be an array");
  const ids = new Set();
  const fixturePaths = new Set();
  const vaultPaths = new Set();
  const fixtures = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Safety fixture entry must be an object");
    }
    const id = requireString(entry, "id");
    const provenance = requireString(entry, "provenance");
    const fixturePath = requireString(entry, "fixturePath");
    const vaultPath = requireString(entry, "vaultPath");
    if (entry.category !== null && !errorCategories.has(entry.category)) {
      throw new Error(`Safety fixture ${id} has an invalid category`);
    }
    requireScopedPath(fixturePath, "tests/fixtures/failure/", "fixturePath");
    requireScopedPath(vaultPath, "tests/vault/failure/", "vaultPath");
    if (ids.has(id)) throw new Error(`Duplicate safety fixture id ${id}`);
    if (fixturePaths.has(fixturePath)) {
      throw new Error(`Duplicate safety fixture path ${fixturePath}`);
    }
    if (vaultPaths.has(vaultPath)) {
      throw new Error(`Duplicate safety Vault path ${vaultPath}`);
    }
    ids.add(id);
    fixturePaths.add(fixturePath);
    vaultPaths.add(vaultPath);
    return Object.freeze({
      id,
      category: entry.category,
      provenance,
      fixturePath,
      vaultPath,
    });
  });
  return Object.freeze(fixtures);
}
