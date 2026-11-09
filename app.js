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


function renderBinaryTable(record, selectedMajor) {
  const section = element("section", "binary-section");
  const heading = element("h4");
  heading.append(text("Original Windows binaries"));
  const explanation = element("p", "binary-intro");
  explanation.append(text("These ZIP files are pgextwin-built Windows x64 packages. SPDX SBOM and Grype reports are supporting evidence, not installation packages."));
  section.append(heading, explanation);
  const scroll = element("div", "binary-table-scroll");
  const table = element("table", "binary-table");
  const thead = element("thead");
  const header = element("tr");
  for (const label of ["PostgreSQL", "Original ZIP package", "Supporting artifacts"]) {
    const th = element("th");
    th.scope = "col";
    th.append(text(label));
    header.append(th);
  }
  thead.append(header);
  const tbody = element("tbody");
  const majors = Object.entries(record.postgresql).filter(([, entry]) => entry.available)
    .map(([major]) => Number(major))
    .filter((major) => !selectedMajor || major === Number(selectedMajor))
    .sort((a, b) => b - a);
  for (const major of majors) {
    const info = record.postgresql[String(major)];
    const row = element("tr");
    const pg = element("th");
    pg.scope = "row";
    pg.append(text("PG " + major));
    const zip = element("td");
    appendHttpsLink(zip, info.downloadUrl, "Download ZIP", "download-link download-link--compact");
    const filename = element("code", "asset-name");
    filename.append(text(info.asset));
    zip.append(filename);
    const auxiliary = element("td");
    const supporting = element("div", "supporting-links");
    const evidence = catalogView.normalizeEvidence(info.evidence);
    let hasEvidence = false;
    if (evidence.sbom.available && evidence.sbom.downloadUrl)
      hasEvidence = appendHttpsLink(supporting, evidence.sbom.downloadUrl, "SPDX SBOM", "inline-link") || hasEvidence;
    if (evidence.vulnerabilityReport.available && evidence.vulnerabilityReport.downloadUrl)
      hasEvidence = appendHttpsLink(supporting, evidence.vulnerabilityReport.downloadUrl, "Grype report", "inline-link") || hasEvidence;
    if (!hasEvidence) supporting.append(text("Not published for this release"));
    auxiliary.append(supporting);
    row.append(pg, zip, auxiliary);
    tbody.append(row);
  }
  table.append(thead, tbody);
  scroll.append(table);
  section.append(scroll);
  const note = element("p", "binary-hint");
  note.append(text("For the full ZIP SHA-256 checksum, attestations and CI verification, expand the corresponding PostgreSQL version below."));
  section.append(note);
  return section;
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
  const content = element("div", "extension-details-body");
  content.append(renderBinaryTable(record, selectedMajor));
  while (card.firstChild) content.append(card.firstChild);

  const details = element("details", "extension-collapse");
  details.name = "pgextwin-extension";
  details.id = "extension-" + record.name;
  const summary = element("summary", "extension-summary");
  const identity = element("span", "extension-identity");
  identity.append(element("span", "extension-title"), element("span", "extension-description"));
  identity.children[0].append(text(record.displayName));
  identity.children[1].append(text(record.description));
  const badges = element("span", "extension-summary-badges");
  const release = element("span", "summary-release");
  release.append(text(recor…17789 tokens truncated… below.":"カタログを取得できなかったか、データ形式が対応するschema v2ではありません。GitHubのCatalogを確認してください。","Catalog unavailable.":"カタログを利用できません。","PostgreSQL lifecycle data is unavailable. Published binary availability is still shown from the catalog, but current maintenance status cannot be determined.":"PostgreSQLのサポート情報を取得できません。公開済みバイナリは引き続き表示しますが、現在の保守状況は判定できません。","Last reviewed":"最終確認日","Formal roadmap":"正式な開発計画","Historical roadmap":"過去の選定履歴","Decision date":"選定日","Stable version":"安定版","Windows build effort":"Windowsでのビルド難易度","PG19 readiness":"PG19の準備状況","Upstream Windows":"上流のWindows対応","Existing source":"既存の入手先","Why consider it":"候補とする理由","Selection rationale":"選定理由","Why not planned":"実装予定がない理由","External Windows binary sources":"外部Windowsバイナリの取得先","Research evidence":"調査の根拠","No generally available Windows binary identified":"一般公開されているWindowsバイナリは未確認です","Formal decision pending":"正式な選定は未決定です。","Acquisition URL unavailable":"取得先URLは利用できません","Loading independent Landscape registry…":"独立した拡張機能一覧を読み込んでいます…","Landscape registry unavailable. Existing pgextwin catalog and downloads remain independent.":"拡張機能の対応状況を取得できません。pgextwinの配布Catalogとダウンロードには影響しません。","Not planned in pgextwin":"pgextwinでの実装予定なし","Official upstream":"上流公式","Community":"コミュニティ","Vendor":"ベンダー","Public":"一般公開","Vendor product users":"ベンダー製品の利用者向け","Support customers only":"サポート契約者限定","Commercial bundle":"商用製品に同梱","Standard PostgreSQL":"通常版PostgreSQL","Vendor PostgreSQL":"ベンダー版PostgreSQL","Conda PostgreSQL environment":"CondaのPostgreSQL環境","Target unknown":"対象不明","Ordinary PostgreSQL":"通常版PostgreSQL向け","Vendor-specific":"ベンダー専用","Manual compatibility verification required":"導入前に互換性の確認が必要","Compatibility unknown":"互換性不明","Decision pending":"選定待ち","Reserve candidate":"次点候補","Further research":"継続調査","supported":"対応","not-supported":"非対応","unknown":"不明","documented":"文書あり","under-review":"調査中","low":"低","medium":"中","high":"高","very-high":"非常に高","none-identified":"確認できず","limited":"限定的","public":"公開","unranked":"順位なし","build-instructions":"ビルド手順あり","native-binary":"ネイティブバイナリあり","source":"取得元"};
  const reasons = {"Useful advisor functionality; isolated issue-attached community DLLs are not an established official Windows release channel.":"仮想インデックスによる性能評価は有益ですが、Issueに個別添付されたコミュニティ製DLLは公式の継続的なWindows配布経路ではありません。","Oracle migration utility warrants further review; EDB Advanced Server's built-in Oracle compatibility is not equivalent to a downloadable orafce DLL for community PostgreSQL.":"Oracleからの移行支援機能として検討価値があります。ただしEDB Advanced Server標準のOracle互換機能は、コミュニティ版PostgreSQL用orafce DLLの配布と同一ではありません。","High demand for partition operations; C background worker and maintenance lifecycle require extra validation.":"パーティション管理への需要は高い一方、C言語製バックグラウンドワーカーと保守ライフサイクルには追加検証が必要です。","Percona publishes PostgreSQL 14–18 Linux packages; public binaries for ordinary Windows PostgreSQL not confirmed.":"PerconaはPostgreSQL 14〜18用のLinuxパッケージを公開していますが、通常のWindows版PostgreSQL向けバイナリは確認できていません。","High-value CDC gap: upstream Visual Studio build exists but the official 2.6 Release has no binary assets; PG18 compile and logical-decoding runtime remain a mandatory pilot gate.":"CDC用途で需要があります。上流にはVisual Studioビルド手順がありますが、公式2.6リリースにバイナリは含まれません。PG18でのビルドと論理デコードの動作検証が必須です。","Upstream officially publishes Windows ZIP assets for PG14–18; no need to duplicate native Oracle SDK dependency handling.":"上流公式がPG14〜18用のWindows ZIPを公開しているため、Oracle SDK依存のビルドをpgextwinで重複実装する必要はありません。","PostGIS Windows bundles now ship pgSphere binaries; niche demand does not justify a duplicate standalone pipeline.":"PostGISのWindowsバンドルにpgSphereが含まれており、専用パイプラインを追加する優先度は高くありません。","Published PostGIS Windows bundles include pgRouting; building overlapping native GIS toolchains adds little value.":"公開されているPostGISのWindowsバンドルにpgRoutingが含まれるため、GISビルド基盤の重複整備は不要です。","Upstream supplies an nmake build path and conda-forge publishes win-64 packages; standard EDB installations are not necessarily ABI-compatible with conda packages.":"上流にnmakeでのビルド手順があり、conda-forgeでもWindows向けパッケージが公開されています。ただし通常のEDB版PostgreSQLとCondaのパッケージはABI互換とは限りません。","Official Windows installers cover PG14–18 including dependencies; duplicating GIS dependency packaging is unnecessary now.":"依存関係を含む公式WindowsインストーラーがPG14〜18に対応しているため、GIS関連の再パッケージ化は現時点では不要です。","Upstream publishes matching Windows ZIPs and installation documentation; complex native build and upgrade surface better handled upstream.":"上流公式がWindows向けZIPとインストール手順を公開しているため、複雑なネイティブビルドとアップグレード対応は上流に委ねます。","Planner advisor with explicit PG18/PG19 upstream fixes and reliable EXPLAIN tests; historical upstream Windows releases cover only PG14–16 and newer issue attachments are not maintained official assets. Pilot planner hooks and imported internal symbols.":"PG18/PG19向けの上流修正と再現性のあるEXPLAINテストがあります。一方、上流公式の過去のWindows配布はPG14〜16のみで、Issue添付DLLは継続保守された公式成果物ではありません。プランナーフックと内部シンボルの取扱いを技術検証します。","Upstream offers MSVC/Meson builds and PG18 path, but ICU/toolchain alignment, very broad SQL/export surface and historical alternative Windows channels warrant further scoping.":"上流にはMSVC/MesonビルドとPG18対応経路がありますが、ICU・ツールチェーンの整合性、広範なSQL関数・エクスポート、既存のWindows配布経路を詳しく調査する必要があります。","High production value and PG18 support, but SQL-only versus optional background worker packaging, secure maintenance-role setup and broad lifecycle coverage need a dedicated Windows design gate.":"実運用での価値とPG18対応は明確ですが、SQL機能と任意のバックグラウンドワーカーの構成、保守ロールの安全な設定、ライフサイクル全体の検証についてWindows固有の設計審査が必要です。","Percona actively maintains PG18 observability; mandatory preload, hooks, shared memory and OS assumptions make reliable Windows delivery more complex than selected pilots.":"PerconaはPG18向け監視機能を積極的に保守していますが、必須の事前読み込み、フック、共有メモリ、OS依存のため、安定したWindows配布の難易度が高くなります。","Useful CDC JSON plugin and substantial standard-Windows availability gap, with upstream Visual Studio project and slot-based test. PG18 compile/runtime, output callback ABI and deterministic logical decoding must pass an explicit pilot gate.":"CDC向けJSONプラグインで、通常版Windows向けの配布が不足しています。上流のVisual Studioプロジェクトとレプリケーションスロットを用いたテストを活用し、PG18でのビルド・実行、出力コールバックのABI、決定的な論理デコードを検証します。","First pilot: documented native MSVC/Meson path, PostgreSQL 14–19 upstream support, deterministic linting scenario and high developer value. Validate PL/pgSQL internal symbol linkage, ABI and DLL exports before any release.":"第1パイロットとして、文書化されたMSVC/Mesonビルド、上流のPG14〜19対応、再現性のある静的解析テスト、開発者への価値を評価しました。リリース前にPL/pgSQL内部シンボルのリンク、ABI、DLLエクスポートを検証します。"};
  const sourceNotes = {"BGW is optional and requires explicit shared_preload_libraries configuration.":"BGWは任意機能です。使用する場合のみshared_preload_librariesを明示的に設定してください。","Independently verified signed Windows x64 PG14-18 release. BGW is optional and requires explicit shared_preload_libraries configuration.":"PostgreSQL 14〜18対応の署名付きWindows x64版を独立検証済み。BGW DLLを同梱し、利用時にはshared_preload_librariesの明示的な設定が必要です。","Independently verified signed Windows x64 PG14-18 release. See Test Contract for feature and preload requirements.":"署名付きのWindows x64版をPostgreSQL 14〜18で独立検証済み。機能範囲と事前ロードの要件はテスト契約を参照してください。","Official 1.4.1 Windows x64 release assets cover PG14–16; there are no official 1.4.3/PG17–18 assets. Not a current alternative for the later majors.":"公式1.4.1のWindows x64成果物はPG14〜16向けです。1.4.3およびPG17〜18向けの公式成果物はなく、新しいPGバージョンの代替入手先にはなりません。","Individually attached PG17/18 DLLs; not an official, maintained release channel. Validate provenance, matching PG build, and runtime safety independently.":"PG17/18用のDLLが個別に添付されていますが、公式の継続保守された配布経路ではありません。出自、ビルドの一致、実行時の安全性を個別に検証してください。","Official release 2.9.0 provides pg14–18 win64 ZIPs; Oracle Instant Client runtime required. Match PostgreSQL build and Oracle client.":"公式2.9.0リリースにはPG14〜18向けwin64 ZIPがあります。Oracle Instant Clientが必要なため、PostgreSQLのビルドとOracleクライアントの整合性をご確認ください。","Windows binaries provided to support-contract customers, not public downloads. Request the exact PostgreSQL major/version from SRA OSS.":"Windowsバイナリはサポート契約者向けに提供され、一般公開されていません。対応するPostgreSQLのメジャーバージョンと詳細はSRA OSSにお問い合わせください。","pgSphere artifacts are under the bundle's extras directories; verify the actual target major and compatible DLLs.":"pgSphereの成果物はバンドルのextrasディレクトリ内にあります。対応するPGメジャーバージョンとDLLの互換性を確認してください。","PostGIS 3.6.2 bundle lists pgRouting 4.0.1; verify exact PG major and included subpackage.":"PostGIS 3.6.2のバンドルにはpgRouting 4.0.1が含まれます。対応するPGメジャーバージョンと同梱パッケージをご確認ください。","win-64 package published; use the matching conda PostgreSQL environment. Not a drop-in EDB/PostgreSQL installer.":"win-64パッケージが公開されています。対応するCondaのPostgreSQL環境で使用してください。通常のEDB/PostgreSQLインストールにそのまま追加できるものではありません。","PostGIS 3.6.2 PG18 x64 installer; choose a matching PostgreSQL major at the official downloads page.":"PostGIS 3.6.2のPG18 x64向けインストーラーです。公式ダウンロードページでPostgreSQLのバージョンに合うものを選択してください。","Release 2.30.2 includes Windows amd64 archives for PostgreSQL 16–18. Check runtime libraries and upstream version matrix.":"2.30.2リリースにはPostgreSQL 16〜18向けのWindows amd64アーカイブがあります。実行時ライブラリと上流の対応バージョン表をご確認ください。"};
  function selectLanguage(preferred) {
    return /^ja(?:[-_]|$)/i.test(String(preferred || "")) ? "ja" : "en";
  }
  function bilingual(value, japanese) {
    return value.split(" — ").map(part => {
      const at = part.lastIndexOf(" / ");
      if (at < 0) return part;
      const last = part.slice(at + 3);
      if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(last)) return part;
      return japanese ? last : part.slice(0, at);
    }).join(" — ");
  }
  function createLocale(language) {
    const japanese = language === "ja";
    function t(value) {
      const original = String(value);
      if (japanese) {
        const direct = descriptions[original] || scenarios[original] || labels[original] || reasons[original] || sourceNotes[original];
        if (direct) return direct;
      }
      if (/[\u3040-\u30ff\u3400-\u9fff]/.test(original) && original.includes(" / ")) return bilingual(original,japanese);
      if (!japanese) return original;
      let match;
      if ((match = /^PostgreSQL (\d+(?:[–-]\d+)?) only$/.exec(original))) return "PostgreSQL " + match[1] + "のみ";
      if ((match = /^Upstream version for PostgreSQL (\d+): (.+)$/.exec(original))) return "PostgreSQL " + match[1] + "の上流バージョン：" + match[2];
      if ((match = /^Available binary · Supported through (\d{4}-\d{2}-\d{2})$/.exec(original))) return "配布中のバイナリ · サポート終了日：" + match[1];
      if ((match = /^Historical binary · PostgreSQL (\d+) reached EOL on (.+)$/.exec(original))) return "過去バージョンのバイナリ · PostgreSQL " + match[1] + "のサポート終了日：" + match[2];
      if ((match = /^Build provenance attestation: (Available|Not published for this release)$/.exec(original))) return "ビルド来歴の証明：" + t(match[1]);
      if ((match = /^SBOM attestation: (Available|Not published for this release)$/.exec(original))) return "SBOMの証明：" + t(match[1]);
      if ((match = /^Client executable: required(.*)$/.exec(original))) return "クライアント実行ファイル：必要" + match[1];
      if ((match = /^Copy ZIP SHA-256 for (.+), PostgreSQL (\d+)$/.exec(original))) return match[1] + " のPostgreSQL " + match[2] + "用ZIPのSHA-256をコピー";
      if ((match = /^(\d+) of (\d+) extensions shown\.$/.exec(original))) return match[2] + "件中" + match[1] + "件の拡張機能を表示しています。";
      if ((match = /^(\d+) of (\d+) Landscape entries shown\.$/.exec(original))) return "対応状況" + match[2] + "件中" + match[1] + "件を表示しています。";
      if ((match = /^(\d+) extension records loaded\.(.*)$/.exec(original))) return match[1] + "件の拡張機能を読み込みました。" + translateSuffix(match[2]);
      if ((match = /^(\d+) Landscape entries loaded\.(.*)$/.exec(original))) return "拡張機能の対応状況を" + match[1] + "件読み込みました。" + translateSuffix(match[2]);
      if ((match = /^ (\d+) catalog records? could not be loaded or validated; other records remain available\.(.*)$/.exec(original))) return " " + match[1] + "件のデータを検証できませんでしたが、他のデータは表示しています。" + translateSuffix(match[2]);
      if ((match = /^ (\d+) entry\/entries failed; valid entries remain visible\.(.*)$/.exec(original))) return " " + match[1] + "件を取得できませんでしたが、有効なデータは表示しています。" + translateSuffix(match[2]);
      if ((match = /^Wave 2 #(\d+)(.*)$/.exec(original))) return "第2弾 #" + match[1] + t(match[2]);
      if (original === " — selection history (now distributed)") return " — 選定履歴（現在配布中）";
      if ((match = /^ Lifecycle status uses the (\d{4}-\d{2}-\d{2}) UTC calendar date\.$/.exec(original))) return " サポート状況はUTCの" + match[1] + "時点で判定しています。";
      if (original === " Lifecycle data unavailable; binary availability and downloads are still shown.") return " サポート情報は取得できませんが、バイナリとダウンロード先は表示しています。";
      if (original === " External source details are point-in-time research, not pgextwin guarantees.") return " 外部配布元の情報は調査時点のもので、pgextwinによる保証ではありません。";
      if (original === "No Landscape entries match the selected filters.") return "条件に一致する拡張機能はありません。";
      if (original === "No valid Landscape entries loaded.") return "有効な対応状況データを取得できません。";
      if (original === "Find pgextwin downloads") return "pgextwinのダウンロードを探す";
      if (original === "Formal decision pending") return "正式選定待ち";
      if ((match = /^Source (\d+)$/.exec(original))) return "根拠資料 " + match[1];
      if ((match = /^(\d{4}-\d{2}-\d{2}) \(recheck before use\)$/.exec(original))) return match[1] + "（利用前に再確認）";
      if (original === "0 extensions shown.") return "拡張機能は0件です。";
      if (original === "PostgreSQL 14") return original;
      return original;
    }
    function translateSuffix(s) {
      return s.replace(/ \d+ catalog records? could not be loaded or validated; other records remain available\./g, m=>t(m))
        .replace(/ \d+ entry\/entries failed; valid entries remain visible\./g, m=>t(m))
        .replace(/ Lifecycle status uses the \d{4}-\d{2}-\d{2} UTC calendar date\./g,m=>t(m))
        .replace(" Lifecycle data unavailable; binary availability and downloads are still shown.",t(" Lifecycle data unavailable; binary availability and downloads are still shown."))
        .replace(" External source details are point-in-time research, not pgextwin guarantees.",t(" External source details are point-in-time research, not pgextwin guarantees."));
    }
    return Object.freeze({language:japanese?"ja":"en",t});
  }
  const api = {selectLanguage,createLocale};
  if (typeof module === "object" && module.exports) module.exports = api;
  root.pgextwinI18n = createLocale(root.document && root.document.documentElement && root.document.documentElement.lang);
})(typeof globalThis !== "undefined" ? globalThis : this);
