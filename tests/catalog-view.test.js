const test = require("node:test");
const assert = require("node:assert/strict");

const view = require("../catalog-view.js");

const HEX64 = "a".repeat(64);
const COMMIT = "b".repeat(40);

function evidenceFalse() {
  return {
    buildProvenanceAttestation: { available: false },
    sbom: { available: false },
    sbomAttestation: { available: false },
    vulnerabilityReport: { available: false }
  };
}

function record(options = {}) {
  const name = options.name || "pg_cron";
  const majors = options.majors || [17, 18];
  const postgresql = {};
  for (const major of majors) {
    postgresql[String(major)] = {
      available: options.unavailableMajor === major ? false : true,
      ...(options.unavailableMajor === major ? {} : {
        asset: `${name}-pg${major}.zip`,
        downloadUrl: `https://github.com/pgextwin/${name}/releases/download/v1/${name}-pg${major}.zip`,
        sha256: HEX64,
        evidence: evidenceFalse()
      })
    };
  }
  return {
    schemaVersion: 2,
    name,
    displayName: options.displayName || name,
    description: options.description || "Cron-based job scheduler for PostgreSQL.",
    upstream: { repository: options.upstream || "citusdata/pg_cron", version: "1.0" },
    repository: `pgextwin/${name}`,
    license: "PostgreSQL-style",
    architecture: "x64",
    latest: {
      releaseTag: "v1",
      publishedAt: "2026-10-06T01:00:00Z",
      releaseUrl: `https://github.com/pgextwin/${name}/releases/tag/v1`,
      checksumsAsset: "SHA256SUMS.txt"
    },
    postgresql,
    runtime: {
      requirements: options.requirements || {
        extensionCreation: "required",
        preload: "shared",
        backgroundWorker: true,
        clientExecutable: { required: false, packagePaths: [] }
      }
    },
    capabilities: {
      testContractVersion: 2,
      coverage: options.coverage || {
        createExtension: "covered",
        backgroundWorker: "covered",
        clientExecutable: "not-applicable",
        serverLogAssertions: "not-applicable",
        upgrade: "not-covered"
      },
      functionalScenarios: options.scenarios || [
        { id: "scheduled-job-executes", description: "Schedules and executes a real job.", evidence: ["sql-result"] }
      ]
    },
    capabilitiesSource: {
      repository: `pgextwin/${name}`,
      path: "config/test-contract.json",
      commit: COMMIT
    }
  };
}

test("search matches name", () => {
  assert.equal(view.matchesSearch(record({ name: "pg_cron" }), "cron"), true);
});

test("search matches description", () => {
  assert.equal(view.matchesSearch(record({ description: "Detailed AUDIT logging" }), "audit"), true);
});

test("search matches upstream repository", () => {
  assert.equal(view.matchesSearch(record({ upstream: "Acme/PlannerHints" }), "plannerhints"), true);
});

test("search is case-insensitive and reports no match", () => {
  assert.equal(view.matchesSearch(record({ displayName: "pgAudit" }), "PGAUDIT"), true);
  assert.equal(view.matchesSearch(record(), "repack"), false);
});

test("available PostgreSQL majors are derived from the union", () => {
  const majors = view.deriveAvailableMajors([
    record({ name: "one", majors: [14, 16] }),
    record({ name: "two", majors: [15, 18], unavailableMajor: 15 })
  ]);
  assert.deepEqual(majors, [14, 16, 18]);
});

test("PostgreSQL filter keeps selected available major and excludes unavailable major", () => {
  const records = [
    record({ name: "yes", majors: [18] }),
    record({ name: "no", majors: [18], unavailableMajor: 18 })
  ];
  assert.deepEqual(view.filterRecords(records, { major: 18 }).map((item) => item.name), ["yes"]);
});

test("search and PostgreSQL filters are ANDed", () => {
  const records = [
    record({ name: "pg_cron", majors: [18] }),
    record({ name: "pg_repack", majors: [18], description: "Online table rewrite", upstream: "reorg/pg_repack" }),
    record({ name: "cron_old", majors: [17], description: "Legacy scheduler" })
  ];
  assert.deepEqual(view.filterRecords(records, { query: "cron", major: 18 }).map((item) => item.name), ["pg_cron"]);
});

test("runtime labels preserve shared/either/optional/none semantics", () => {
  assert.equal(view.formatRuntimeRequirements({ extensionCreation: "required", preload: "shared", backgroundWorker: false, clientExecutable: { required: false, packagePaths: [] } }).preload, "Preload: shared_preload_libraries required");
  assert.equal(view.formatRuntimeRequirements({ extensionCreation: "required", preload: "either", backgroundWorker: false, clientExecutable: { required: false, packagePaths: [] } }).preload, "Preload: shared or session preload required");
  assert.equal(view.formatRuntimeRequirements({ extensionCreation: "required", preload: "optional", backgroundWorker: false, clientExecutable: { required: false, packagePaths: [] } }).preload, "Preload: optional");
  assert.equal(view.formatRuntimeRequirements({ extensionCreation: "required", preload: "none", backgroundWorker: false, clientExecutable: { required: false, packagePaths: [] } }).preload, "Preload: none required");
});

test("runtime labels expose background worker and client executable paths", () => {
  const labels = view.formatRuntimeRequirements({
    extensionCreation: "required",
    preload: "none",
    backgroundWorker: true,
    clientExecutable: { required: true, packagePaths: ["bin/pg_repack.exe"] }
  });
  assert.equal(labels.backgroundWorker, "Background worker: used");
  assert.equal(labels.clientExecutable, "Client executable: required — bin/pg_repack.exe");
});

test("normal scenario applies to every selected major", () => {
  const scenario = { id: "normal", description: "Normal", evidence: ["sql-result"] };
  assert.equal(view.scenarioAppliesToMajor(scenario, 18), true);
});

test("major-limited scenario only applies to declared PostgreSQL majors", () => {
  const scenario = { id: "hint-table", description: "Hint table", evidence: ["query-plan"], postgresqlMajors: [14, 15, 16] };
  assert.equal(view.scenarioAppliesToMajor(scenario, 16), true);
  assert.equal(view.scenarioAppliesToMajor(scenario, 18), false);
  assert.equal(view.scenarioScopeLabel(scenario), "PostgreSQL 14–16 only");
});

test("upgrade not-covered remains a CI coverage statement, not unsupported", () => {
  const row = view.getCoverageRows({ upgrade: "not-covered" }).find((item) => item.key === "upgrade");
  assert.equal(row.text, "Not covered by current CI");
  assert.equal(row.text.toLowerCase().includes("unsupported"), false);
});

test("historical all-false evidence normalizes to no available evidence", () => {
  const normalized = view.normalizeEvidence(evidenceFalse());
  assert.equal(normalized.anyAvailable, false);
});

test("future all-true evidence keeps SBOM and point-in-time vulnerability URLs", () => {
  const normalized = view.normalizeEvidence({
    buildProvenanceAttestation: { available: true },
    sbom: { available: true, asset: "sbom.spdx.json", downloadUrl: "https://example.test/sbom.spdx.json", sha256: HEX64 },
    sbomAttestation: { available: true },
    vulnerabilityReport: { available: true, asset: "grype.json", downloadUrl: "https://example.test/grype.json", sha256: HEX64 }
  });
  assert.equal(normalized.anyAvailable, true);
  assert.equal(normalized.sbom.downloadUrl, "https://example.test/sbom.spdx.json");
  assert.equal(normalized.vulnerabilityReport.downloadUrl, "https://example.test/grype.json");
  assert.equal(Object.hasOwn(normalized.buildProvenanceAttestation, "downloadUrl"), false);
  assert.equal(Object.hasOwn(normalized.sbomAttestation, "downloadUrl"), false);
});

test("non-https evidence URL is not exposed as a link", () => {
  const normalized = view.normalizeEvidence({
    buildProvenanceAttestation: { available: false },
    sbom: { available: true, downloadUrl: "javascript:alert(1)", sha256: HEX64 },
    sbomAttestation: { available: false },
    vulnerabilityReport: { available: false }
  });
  assert.equal(normalized.sbom.downloadUrl, null);
});

test("unsupported schema record is rejected", () => {
  const bad = record();
  bad.schemaVersion = 1;
  assert.equal(view.validateCatalogRecord(bad).valid, false);
});

test("partial record failures preserve valid records", () => {
  const valid = record();
  const malformed = record({ name: "bad" });
  malformed.schemaVersion = 99;
  const result = view.partitionCatalogRecordResults([
    { status: "fulfilled", value: valid },
    { status: "rejected", reason: new Error("HTTP 500") },
    { status: "fulfilled", value: malformed }
  ]);
  assert.equal(result.records.length, 1);
  assert.equal(result.failures.length, 2);
});

test("catalog index requires schema v2", () => {
  assert.equal(view.validateCatalogIndex({ schemaVersion: 2, extensions: ["pg_cron"] }).valid, true);
  assert.equal(view.validateCatalogIndex({ schemaVersion: 1, extensions: ["pg_cron"] }).valid, false);
});
