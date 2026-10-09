const t = (value) => globalThis.pgextwinI18n ? globalThis.pgextwinI18n.t(value) : String(value);
const CATALOG_BASE = "https://raw.githubusercontent.com/pgextwin/catalog/main";
const POSTGRESQL_LIFECYCLE_URL = "https://raw.githubusercontent.com/pgextwin/build/main/metadata/postgresql.json";

const statusElement = document.getElementById("status");
const resultsCountElement = document.getElementById("results-count");
const emptyStateElement = document.getElementById("empty-state");
const gridElement = document.getElementById("extensions");
const reloadButton = document.getElementById("reload");
const searchInput = document.getElementById("search");
const pgFilter = document.getElementById("pg-filter");
const lifecycleNoticeElement = document.getElementById("lifecycle-notice");

const lifecycle = globalThis.pgextwinLifecycle;
const catalogView = globalThis.pgextwinCatalogView;
const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const state = {
  records: [],
  lifecycleByMajor: new Map(),
  lifecycleAvailable: false,
  effectiveDate: null,
  recordFailureCount: 0
};

function text(value) {
  return document.createTextNode(t(value));
}

function element(name, className) {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

function githubRepositoryUrl(repository) {
  if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return null;
  return `https://github.com/${repository}`;
}

function capabilitySourceUrl(source) {
  if (!source || !/^[0-9a-f]{40}$/.test(source.commit || "")) return null;
  const repository = githubRepositoryUrl(source.repository);
  if (!repository || typeof source.path !== "string" || source.path.includes("..") || source.path.startsWith("/")) return null;
  const path = source.path.split("/").map(encodeURIComponent).join("/");
  return `${repository}/blob/${source.commit}/${path}`;
}

function appendHttpsLink(parent, href, label, className) {
  if (!catalogView.isHttpsUrl(href)) return false;
  const link = element("a", className);
  link.href = href;
  link.append(text(label));
  parent.append(link);
  return true;
}

function upstreamVersionLabel(record) {
  if (record.upstream && record.upstream.version) return record.upstream.version;
  if (record.upstream && record.upstream.perPostgresql) return "Per PostgreSQL major";
  return "Unknown";
}

function upstreamVersionForMajor(record, major) {
  const mapping = record.upstream && record.upstream.perPostgresql;
  if (!mapping) return null;
  const info = mapping[String(major)];
  return info && info.version ? info.version : null;
}

function formatEnglishCalendarDate(value) {
  if (!lifecycle.isValidCalendarDate(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return `${ENGLISH_MONTHS[month - 1]} ${day}, ${year}`;
}

function formatJapaneseCalendarDate(value) {
  if (!lifecycle.isValidCalendarDate(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function lifecycleView(lifecycleByMajor, major, effectiveDate) {
  const entry = lifecycleByMajor.get(String(major));
  const status = lifecycle.getPostgresqlLifecycleStatus(entry && entry.eol, effectiveDate);
  return { entry, status };
}

function renderLifecycleBadge(status) {
  const badge = element("span", `lifecycle-badge lifecycle-badge--${status}`);
  if (status === "maintained") badge.append(text("Maintained"));
  else if (status === "historical") badge.append(text("EOL / Historical"));
  else badge.append(text("Lifecycle unknown"));
  return badge;
}

function renderEvidence(evidence) {
  const section = element("section", "evidence");
  const heading = element("h5");
  heading.append(text("Supply-chain evidence"));
  section.append(heading);

  const normalized = catalogView.normalizeEvidence(evidence);
  if (!normalized.anyAvailable) {
    const note = element("p", "evidence-note");
    note.append(text(
      "Historical release — additional build provenance, SPDX SBOM, SBOM attestation, and vulnerability report were not published for this release. The current build infrastructure supports this evidence for newer releases."
    ));
    section.append(note);
    return section;
  }

  const list = element("ul", "evidence-list");
  const provenance = element("li");
  provenance.append(text(`Build provenance attestation: ${normalized.buildProvenanceAttestation.available ? "Available" : "Not published for this release"}`));
  list.append(provenance);

  const sbom = element("li");
  if (normalized.sbom.available && normalized.sbom.downloadUrl) {
    sbom.append(text("SPDX SBOM: "));
    appendHttpsLink(sbom, normalized.sbom.downloadUrl, "Download SPDX JSON", "inline-link");
  } else {
    sbom.append(text("SPDX SBOM: Not published for this release"));
  }
  list.append(sbom);

  const sbomAttestation = element("li");
  sbomAttestation.append(text(`SBOM attestation: ${normalized.sbomAttestation.available ? "Available" : "Not published for this release"}`));
  list.append(sbomAttestation);

  const vulnerability = element("li");
  if (normalized.vulnerabilityReport.available && normalized.vulnerabilityReport.downloadUrl) {
    vulnerability.append(text("Vulnerability report: "));
    appendHttpsLink(vulnerability, normalized.vulnerabilityReport.downloadUrl, "Download point-in-time Grype report", "inline-link");
  } else {
    vulnerability.append(text("Vulnerability report: Not published for this release"));
  }
  list.append(vulnerability);

  section.append(list);
  return section;
}

function renderChecksum(sha256, record, major) {
  const block = element("div", "checksum-block");
  const label = element("span", "checksum-label");
  label.append(text("ZIP SHA-256"));
  const code = element("code", "checksum");
  code.append(text(sha256));
  const button = element("button", "copy-button");
  button.type = "button";
  button.setAttribute("aria-label", `Copy ZIP SHA-256 for ${record.displayName}, PostgreSQL ${major}`);
  button.append(text("Copy SHA-256"));
  button.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(sha256);
      button.textContent = t("Copied");
    } catch (error) {
      console.warn(error);
      button.textContent = t("Copy unavailable");
    } finally {
      window.setTimeout(() => { button.textContent = t("Copy SHA-256"); }, 1800);
    }
  });
  block.append(label, code, button);
  return block;
}

function renderPostgresqlMajor(record, major, lifecycleByMajor, effectiveDate) {
  const info = record.postgresql[String(major)];
  const item = element("li");
  const details = element("details", "pg-version");
  const summary = element("summary", "pg-version-summary");
  const summaryTitle = element("span", "pg-version-title");
  const name = element("strong");
  name.append(text(`PostgreSQL ${major}`));
  summaryTitle.append(name);
  summary.append(summaryTitle);

  const { entry, status } = lifecycleView(lifecycleByMajor, major, effectiveDate);
  summary.append(renderLifecycleBadge(status));
  details.append(summary);

  const body = element("div", "pg-version-body");
  const detail = element("p", "pg-version-detail");
  if (status === "maintained") {
    detail.append(text(`Available binary · Supported through ${entry.eol}`));
  } else if (status === "historical") {
    detail.append(text(`Historical binary · PostgreSQL ${major} reached EOL on ${entry.eol}`));
  } else {
    detail.append(text("Available binary · Lifecycle data unavailable"));
  }
  body.append(detail);

  const version = upstreamVersionForMajor(record, major);
  if (version) {
    const upstreamVersion = element("p", "pg-version-upstream");
    upstreamVersion.append(text(`Upstream version for PostgreSQL ${major}: ${version}`));
    body.append(upstreamVersion);
  }

  const downloadRow = element("div", "download-row");
  if (!appendHttpsLink(downloadRow, info.downloadUrl, "Download ZIP", "download-link")) {
    const unavailable = element("span", "link-unavailable");
    unavailable.append(text("Direct download URL unavailable"));
    downloadRow.append(unavailable);
  }
  body.append(downloadRow);
  body.append(renderChecksum(info.sha256, record, major));
  body.append(renderEvidence(info.evidence));
  details.append(body);
  item.append(details);
  return item;
}

function renderRuntime(record) {
  const section = element("section", "runtime-section");
  const heading = element("h4");
  heading.append(text("Runtime"));
  section.append(heading);

  const labels = catalogView.formatRuntimeRequirements(record.runtime.requirements);
  const list = element("ul", "runtime-list");
  for (const value of [labels.extensionCreation, labels.preload, labels.backgroundWorker, labels.clientExecutable]) {
    const item = element("li", "runtime-item");
    item.append(text(value));
    list.append(item);
  }
  section.append(list);
  return section;
}

function renderCapabilities(record, selectedMajor) {
  const details = element("details", "capabilities");
  const summary = element("summary");
  summary.append(text("What pgextwin CI verifies"));
  details.append(summary);

  const content = element("div", "capabilities-body");
  const scenarioHeading = element("h5");
  scenarioHeading.append(text("Tested capabilities"));
  content.append(scenarioHeading);

  const scenarios = catalogView.getApplicableScenarios(record, selectedMajor);
  const list = element("ul", "scenario-list");
  for (const scenario of scenarios) {
    const item = element("li", "scenario-item");
    const description = element("span");
    description.append(text(scenario.description));
    item.append(description);
    const scope = catalogView.scenarioScopeLabel(scenario);
    if (scope) {
      const scopeBadge = element("span", "scope-badge");
      scopeBadge.append(text(scope));
      item.append(scopeBadge);
    }
    const id = element("code", "scenario-id");
    id.append(text(scenario.id));
    item.append(id);
    list.append(item);
  }
  if (scenarios.length === 0) {
    const item = element("li", "scenario-item");
    item.append(text("No functional scenario applies to the selected PostgreSQL major."));
    list.append(item);
  }
  content.append(list);

  const coverageHeading = element("h5");
  coverageHeading.append(text("CI coverage"));
  content.append(coverageHeading);
  const coverage = element("dl", "coverage-list");
  for (const row of catalogView.getCoverageRows(record.capabilities.coverage)) {
    const dt = element("dt");
    dt.append(text(row.label));
    const dd = element("dd", `coverage-status coverage-status--${row.status}`);
    dd.append(text(row.text));
    coverage.append(dt, dd);
  }
  content.append(coverage);

  const source = record.capabilitiesSource;
  const sourceParagraph = element("p", "capability-source");
  sourceParagraph.append(text("Capability source: "));
  const href = capabilitySourceUrl(source);
  if (href) appendHttpsLink(sourceParagraph, href, `${source.repository}/${source.path} @ ${source.commit}`, "inline-link");
  else sourceParagraph.append(text(`${source.repository}/${source.path} @ ${source.commit}`));
  content.append(sourceParagraph);

  details.append(content);
  return details;
}

function renderExtension(record, lifecycleByMajor, effectiveDate, selectedMajor) {
  const card = element("article", "extension-card");

  const header = element("header", "extension-header");
  const title = element("h3");
  title.append(text(record.displayName));
  header.append(title);
  const description = element("p");
  description.append(text(record.description));
  header.append(description);
  card.append(header);

  const overviewHeading = element("h4", "visually-hidden");
  overviewHeading.append(text("Overview"));
  card.append(overviewHeading);
  const meta = element("dl", "meta");
  const pairs = [
    ["Upstream version", upstreamVersionLabel(record)],
    ["pgextwin release", record.latest.releaseTag],
    ["Release date", `${catalogView.formatPublishedDate(record.latest.publishedAt)} UTC`],
    ["Architecture", `Windows ${record.architecture}`],
    ["License", record.license]
  ];
  for (const [label, value] of pairs) {
    const dt = element("dt");
    dt.append(text(label));
    const dd = element("dd");
    dd.append(text(value));
    meta.append(dt, dd);
  }
  card.append(meta);
  card.append(renderRuntime(record));

  const pgHeading = element("h4", "pg-heading");
  pgHeading.append(text("PostgreSQL binaries"));
  card.append(pgHeading);

  const pgList = element("ul", "pg-list");
  let majors = Object.entries(record.postgresql)
    .filter(([, info]) => info.available)
    .map(([major]) => Number(major))
    .sort((a, b) => a - b);
  if (selectedMajor !== null && selectedMajor !== "") majors = majors.filter((major) => major === Number(selectedMajor));
  for (const major of majors) pgList.append(renderPostgresqlMajor(record, major, lifecycleByMajor, effectiveDate));
  card.append(pgList);

  card.append(renderCapabilities(record, selectedMajor));

  const actions = element("nav", "card-actions");
  actions.setAttribute("aria-label", `${record.displayName} project links`);
  appendHttpsLink(actions, record.latest.releaseUrl, "Release page", "inline-link");
  appendHttpsLink(actions, githubRepositoryUrl(record.repository), "Repository", "inline-link");
  appendHttpsLink(actions, githubRepositoryUrl(record.upstream.repository), "Upstream", "inline-link");
  card.append(actions);
  return card;
}

function renderLifecycleNotice(lifecycleByMajor, effectiveDate) {
  lifecycleNoticeElement.replaceChildren();
  const { entry, status } = lifecycleView(lifecycleByMajor, 14, effectiveDate);
  const english = element("p");
  const japanese = element("p");
  japanese.lang = "ja";

  if (status === "maintained") {
    const nextDate = lifecycle.nextCalendarDate(entry.eol);
    english.append(text(
      `PostgreSQL 14 is supported through ${formatEnglishCalendarDate(entry.eol)}. ` +
      `Existing binaries will remain available after EOL, but new normal builds will exclude PG14 beginning ${formatEnglishCalendarDate(nextDate)}.`
    ));
    japanese.append(text(
      `PostgreSQL 14は${formatJapaneseCalendarDate(entry.eol)}までメンテナンス対象です。` +
      `EOL後も既存バイナリは保持しますが、${formatJapaneseCalendarDate(nextDate)}以降の通常の新規ビルド対象からは除外します。`
    ));
  } else if (status === "historical") {
    const nextDate = lifecycle.nextCalendarDate(entry.eol);
    english.append(text(
      `PostgreSQL 14 reached EOL on ${formatEnglishCalendarDate(entry.eol)}. ` +
      `Existing binaries remain available as historical downloads; normal new builds have excluded PG14 since ${formatEnglishCalendarDate(nextDate)}.`
    ));
    japanese.append(text(
      `PostgreSQL 14は${formatJapaneseCalendarDate(entry.eol)}にEOLを迎えました。` +
      `既存バイナリは過去バージョンのダウンロードとして保持し、通常の新規ビルドでは${formatJapaneseCalendarDate(nextDate)}以降PG14を対象外としています。`
    ));
  } else {
    english.append(text(
      "PostgreSQL lifecycle data is unavailable. Published binary availability is still shown from the catalog, but current maintenance status cannot be determined."
    ));
    japanese.append(text(
      "PostgreSQLのライフサイクル情報を取得できません。カタログに基づく公開済みバイナリの表示は継続しますが、現在の保守状況は判定できません。"
    ));
  }
  lifecycleNoticeElement.append(document.documentElement.lang === "ja" ? japanese : english);
}

function populateMajorFilter(records) {
  const previous = pgFilter.value;
  pgFilter.replaceChildren();
  const all = element("option");
  all.value = "";
  all.append(text("All PostgreSQL versions"));
  pgFilter.append(all);
  for (const major of catalogView.deriveAvailableMajors(records)) {
    const option = element("option");
    option.value = String(major);
    option.append(text(`PostgreSQL ${major}`));
    pgFilter.append(option);
  }
  if ([...pgFilter.options].some((option) => option.value === previous)) pgFilter.value = previous;
}

function renderFilteredCatalog() {
  const selectedMajor = pgFilter.value || null;
  const query = searchInput.value.trim().toLocaleLowerCase();
  const records = catalogView.filterRecords(state.records, { query: searchInput.value, major: selectedMajor });
  if (document.documentElement.lang === "ja" && query) {
    for (const record of state.records) {
      if (!records.includes(record) && t(record.description).toLocaleLowerCase().includes(query) &&
          catalogView.isAvailableForMajor(record,selectedMajor)) records.push(record);
    }
  }
  gridElement.replaceChildren(
    ...records.map((record) => renderExtension(record, state.lifecycleByMajor, state.effectiveDate, selectedMajor))
  );
  resultsCountElement.textContent = t(`${records.length} of ${state.records.length} extensions shown.`);
  emptyStateElement.hidden = records.length !== 0;
  if (records.length === 0) {
    emptyStateElement.textContent = t(state.records.length === 0
      ? "No valid extension records are currently available."
      : "No extensions match the current search and PostgreSQL filters.");
  }
}

async function loadCatalogRecords() {
  const indexResponse = await fetch(`${CATALOG_BASE}/index.json`, { cache: "no-store" });
  if (!indexResponse.ok) throw new Error(`Catalog index: HTTP ${indexResponse.status}`);
  const index = await indexResponse.json();
  const indexValidation = catalogView.validateCatalogIndex(index);
  if (!indexValidation.valid) throw new Error(indexValidation.reason);

  const settled = await Promise.allSettled(index.extensions.map(async (name) => {
    const response = await fetch(`${CATALOG_BASE}/extensions/${encodeURIComponent(name)}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  }));
  return catalogView.partitionCatalogRecordResults(settled);
}

async function loadLifecycleMetadata() {
  const response = await fetch(POSTGRESQL_LIFECYCLE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`PostgreSQL lifecycle metadata: HTTP ${response.status}`);
  const metadata = await response.json();
  if (!metadata || metadata.schemaVersion !== 1 || !Array.isArray(metadata.postgresql)) {
    throw new Error("PostgreSQL lifecycle metadata has an unsupported shape");
  }
  return metadata;
}

async function loadCatalog() {
  reloadButton.disabled = true;
  statusElement.textContent = t("Loading catalog…");
  resultsCountElement.textContent = t("");
  emptyStateElement.hidden = true;
  gridElement.replaceChildren();

  try {
    const [catalogResult, lifecycleResult] = await Promise.all([
      loadCatalogRecords(),
      loadLifecycleMetadata().then(
        (metadata) => ({ ok: true, metadata }),
        (error) => ({ ok: false, error })
      )
    ]);

    state.records = catalogResult.records.sort((a, b) => a.displayName.localeCompare(b.displayName));
    state.recordFailureCount = catalogResult.failures.length;
    state.effectiveDate = lifecycle.getUtcCalendarDate(new Date());
    state.lifecycleAvailable = lifecycleResult.ok;
    state.lifecycleByMajor = lifecycleResult.ok
      ? lifecycle.indexPostgresqlLifecycleMetadata(lifecycleResult.metadata)
      : new Map();

    if (!lifecycleResult.ok) console.warn(lifecycleResult.error);
    for (const failure of catalogResult.failures) console.warn("Catalog record unavailable:", failure.reason);

    populateMajorFilter(state.records);
    renderFilteredCatalog();
    renderLifecycleNotice(state.lifecycleByMajor, state.effectiveDate);

    const partial = state.recordFailureCount
      ? ` ${state.recordFailureCount} catalog record${state.recordFailureCount === 1 ? "" : "s"} could not be loaded or validated; other records remain available.`
      : "";
    const lifecycleSuffix = state.lifecycleAvailable
      ? ` Lifecycle status uses the ${state.effectiveDate} UTC calendar date.`
      : " Lifecycle data unavailable; binary availability and downloads are still shown.";
    statusElement.textContent = t(`${state.records.length} extension records loaded.${partial}${lifecycleSuffix}`);
  } catch (error) {
    console.error(error);
    state.records = [];
    state.recordFailureCount = 0;
    statusElement.textContent = t("The catalog index could not be loaded or does not use supported schema v2. Please use the GitHub catalog link below.");
    resultsCountElement.textContent = t("0 extensions shown.");
    gridElement.replaceChildren();
    emptyStateElement.hidden = false;
    emptyStateElement.textContent = t("Catalog unavailable.");
    lifecycleNoticeElement.textContent = "";
  } finally {
    reloadButton.disabled = false;
  }
}

searchInput.addEventListener("input", renderFilteredCatalog);
pgFilter.addEventListener("change", renderFilteredCatalog);
reloadButton.addEventListener("click", loadCatalog);
loadCatalog();
