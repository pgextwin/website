(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.pgextwinCatalogView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SHA256_PATTERN = /^[0-9a-f]{64}$/;
  const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
  const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isHttpsUrl(value) {
    if (!isNonEmptyString(value)) return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  function validateCatalogIndex(index) {
    if (!isObject(index)) return { valid: false, reason: "Catalog index is not an object" };
    if (index.schemaVersion !== 2) return { valid: false, reason: "Catalog index schemaVersion must be 2" };
    if (!Array.isArray(index.extensions)) return { valid: false, reason: "Catalog index extensions must be an array" };
    if (!index.extensions.every(isNonEmptyString)) return { valid: false, reason: "Catalog index contains an invalid extension name" };
    return { valid: true, reason: null };
  }

  function validateEvidenceShape(evidence) {
    if (!isObject(evidence)) return false;
    for (const key of ["buildProvenanceAttestation", "sbom", "sbomAttestation", "vulnerabilityReport"]) {
      if (!isObject(evidence[key]) || typeof evidence[key].available !== "boolean") return false;
    }
    for (const key of ["sbom", "vulnerabilityReport"]) {
      const item = evidence[key];
      if (item.available && (!isHttpsUrl(item.downloadUrl) || !SHA256_PATTERN.test(item.sha256 || ""))) return false;
    }
    return true;
  }

  function validateCatalogRecord(record) {
    if (!isObject(record)) return { valid: false, reason: "Record is not an object" };
    if (record.schemaVersion !== 2) return { valid: false, reason: "Record schemaVersion must be 2" };

    for (const key of ["name", "displayName", "description", "repository", "license", "architecture"]) {
      if (!isNonEmptyString(record[key])) return { valid: false, reason: `Record ${key} is missing` };
    }
    if (!REPOSITORY_PATTERN.test(record.repository)) return { valid: false, reason: "Record repository is invalid" };
    if (!isObject(record.upstream) || !REPOSITORY_PATTERN.test(record.upstream.repository || "")) {
      return { valid: false, reason: "Record upstream repository is invalid" };
    }
    if (!isObject(record.latest) || !isNonEmptyString(record.latest.releaseTag) ||
        !isNonEmptyString(record.latest.publishedAt) || !isHttpsUrl(record.latest.releaseUrl)) {
      return { valid: false, reason: "Record latest release metadata is invalid" };
    }
    if (!isObject(record.postgresql) || Object.keys(record.postgresql).length === 0) {
      return { valid: false, reason: "Record PostgreSQL map is missing" };
    }

    for (const [major, binary] of Object.entries(record.postgresql)) {
      if (!/^[1-9][0-9]*$/.test(major) || !isObject(binary) || typeof binary.available !== "boolean") {
        return { valid: false, reason: `Record PostgreSQL ${major} entry is invalid` };
      }
      if (binary.available) {
        if (!isNonEmptyString(binary.asset) || !isHttpsUrl(binary.downloadUrl) ||
            !SHA256_PATTERN.test(binary.sha256 || "") || !validateEvidenceShape(binary.evidence)) {
          return { valid: false, reason: `Record PostgreSQL ${major} distribution metadata is invalid` };
        }
      }
    }

    const requirements = record.runtime && record.runtime.requirements;
    if (!isObject(requirements) || !isNonEmptyString(requirements.extensionCreation) ||
        !isNonEmptyString(requirements.preload) || typeof requirements.backgroundWorker !== "boolean" ||
        !isObject(requirements.clientExecutable) || typeof requirements.clientExecutable.required !== "boolean" ||
        !Array.isArray(requirements.clientExecutable.packagePaths)) {
      return { valid: false, reason: "Record runtime requirements are invalid" };
    }

    if (!isObject(record.capabilities) || record.capabilities.testContractVersion !== 2 ||
        !isObject(record.capabilities.coverage) || !Array.isArray(record.capabilities.functionalScenarios)) {
      return { valid: false, reason: "Record capabilities are invalid" };
    }
    if (!isObject(record.capabilitiesSource) || !REPOSITORY_PATTERN.test(record.capabilitiesSource.repository || "") ||
        !isNonEmptyString(record.capabilitiesSource.path) || !COMMIT_PATTERN.test(record.capabilitiesSource.commit || "")) {
      return { valid: false, reason: "Record capabilitiesSource is invalid" };
    }

    return { valid: true, reason: null };
  }

  function deriveAvailableMajors(records) {
    const majors = new Set();
    for (const record of Array.isArray(records) ? records : []) {
      if (!record || !isObject(record.postgresql)) continue;
      for (const [major, info] of Object.entries(record.postgresql)) {
        if (info && info.available === true && /^[1-9][0-9]*$/.test(major)) majors.add(Number(major));
      }
    }
    return [...majors].sort((a, b) => a - b);
  }

  function matchesSearch(record, query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
      record && record.name,
      record && record.displayName,
      record && record.description,
      record && record.upstream && record.upstream.repository
    ].filter(Boolean).join("\n").toLowerCase();
    return haystack.includes(needle);
  }

  function isAvailableForMajor(record, major) {
    if (major === null || major === undefined || major === "") return true;
    const info = record && record.postgresql && record.postgresql[String(major)];
    return Boolean(info && info.available === true);
  }

  function filterRecords(records, options) {
    const query = options && options.query;
    const major = options && options.major;
    return (Array.isArray(records) ? records : []).filter(
      (record) => matchesSearch(record, query) && isAvailableForMajor(record, major)
    );
  }

  function formatRuntimeRequirements(requirements) {
    const req = isObject(requirements) ? requirements : {};
    const extensionLabels = {
      required: "Extension creation: CREATE EXTENSION required",
      optional: "Extension creation: CREATE EXTENSION optional",
      "not-required": "Extension creation: CREATE EXTENSION not required",
      unknown: "Extension creation: requirement unknown"
    };
    const preloadLabels = {
      none: "Preload: none required",
      shared: "Preload: shared_preload_libraries required",
      session: "Preload: session preload required",
      either: "Preload: shared or session preload required",
      optional: "Preload: optional",
      unknown: "Preload: requirement unknown"
    };
    const client = isObject(req.clientExecutable) ? req.clientExecutable : { required: false, packagePaths: [] };
    const paths = Array.isArray(client.packagePaths) ? client.packagePaths.filter(isNonEmptyString) : [];

    return {
      extensionCreation: extensionLabels[req.extensionCreation] || extensionLabels.unknown,
      preload: preloadLabels[req.preload] || preloadLabels.unknown,
      backgroundWorker: req.backgroundWorker === true ? "Background worker: used" : "Background worker: not used",
      clientExecutable: client.required === true
        ? `Client executable: required${paths.length ? ` — ${paths.join(", ")}` : ""}`
        : "Client executable: not required",
      backgroundWorkerRequired: req.backgroundWorker === true,
      clientExecutableRequired: client.required === true,
      clientExecutablePaths: paths
    };
  }

  function scenarioAppliesToMajor(scenario, major) {
    if (major === null || major === undefined || major === "") return true;
    if (!scenario || !Array.isArray(scenario.postgresqlMajors) || scenario.postgresqlMajors.length === 0) return true;
    return scenario.postgresqlMajors.includes(Number(major));
  }

  function formatMajorRanges(values) {
    const majors = [...new Set((Array.isArray(values) ? values : []).filter(Number.isInteger))].sort((a, b) => a - b);
    if (!majors.length) return "";
    const ranges = [];
    let start = majors[0];
    let previous = majors[0];
    for (let i = 1; i <= majors.length; i += 1) {
      const current = majors[i];
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      ranges.push(start === previous ? String(start) : `${start}–${previous}`);
      start = current;
      previous = current;
    }
    return ranges.join(", ");
  }

  function scenarioScopeLabel(scenario) {
    if (!scenario || !Array.isArray(scenario.postgresqlMajors) || scenario.postgresqlMajors.length === 0) return null;
    return `PostgreSQL ${formatMajorRanges(scenario.postgresqlMajors)} only`;
  }

  function getApplicableScenarios(record, major) {
    const scenarios = record && record.capabilities && Array.isArray(record.capabilities.functionalScenarios)
      ? record.capabilities.functionalScenarios
      : [];
    return scenarios.filter((scenario) => scenarioAppliesToMajor(scenario, major));
  }

  function getCoverageRows(coverage) {
    const source = isObject(coverage) ? coverage : {};
    const labels = {
      createExtension: "CREATE EXTENSION",
      backgroundWorker: "Background worker",
      clientExecutable: "Client executable",
      serverLogAssertions: "Server-log assertions",
      upgrade: "Upgrade path"
    };
    const statusLabels = {
      covered: "Covered by current CI",
      "not-covered": "Not covered by current CI",
      "not-applicable": "Not applicable to this extension"
    };
    return Object.entries(labels).map(([key, label]) => ({
      key,
      label,
      status: source[key] || "unknown",
      text: statusLabels[source[key]] || "Coverage unknown"
    }));
  }

  function normalizeArtifactEvidence(value) {
    const item = isObject(value) ? value : {};
    return {
      available: item.available === true,
      asset: isNonEmptyString(item.asset) ? item.asset : null,
      downloadUrl: item.available === true && isHttpsUrl(item.downloadUrl) ? item.downloadUrl : null,
      sha256: SHA256_PATTERN.test(item.sha256 || "") ? item.sha256 : null
    };
  }

  function normalizeEvidence(evidence) {
    const source = isObject(evidence) ? evidence : {};
    const normalized = {
      buildProvenanceAttestation: { available: source.buildProvenanceAttestation && source.buildProvenanceAttestation.available === true },
      sbom: normalizeArtifactEvidence(source.sbom),
      sbomAttestation: { available: source.sbomAttestation && source.sbomAttestation.available === true },
      vulnerabilityReport: normalizeArtifactEvidence(source.vulnerabilityReport)
    };
    normalized.anyAvailable = normalized.buildProvenanceAttestation.available || normalized.sbom.available ||
      normalized.sbomAttestation.available || normalized.vulnerabilityReport.available;
    return normalized;
  }

  function formatPublishedDate(value) {
    if (typeof value !== "string") return "Unknown";
    const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
    return match ? match[1] : value;
  }

  function partitionCatalogRecordResults(results) {
    const records = [];
    const failures = [];
    for (const result of Array.isArray(results) ? results : []) {
      if (!result || result.status !== "fulfilled") {
        failures.push({ reason: result && result.reason ? String(result.reason) : "Record fetch failed" });
        continue;
      }
      const validation = validateCatalogRecord(result.value);
      if (!validation.valid) {
        failures.push({ reason: validation.reason });
        continue;
      }
      records.push(result.value);
    }
    return { records, failures };
  }

  return {
    deriveAvailableMajors,
    filterRecords,
    formatMajorRanges,
    formatPublishedDate,
    formatRuntimeRequirements,
    getApplicableScenarios,
    getCoverageRows,
    isAvailableForMajor,
    isHttpsUrl,
    matchesSearch,
    normalizeEvidence,
    partitionCatalogRecordResults,
    scenarioAppliesToMajor,
    scenarioScopeLabel,
    validateCatalogIndex,
    validateCatalogRecord
  };
});
