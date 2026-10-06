const CATALOG_BASE = "https://raw.githubusercontent.com/pgextwin/catalog/main";
const POSTGRESQL_LIFECYCLE_URL = "https://raw.githubusercontent.com/pgextwin/build/main/metadata/postgresql.json";

const statusElement = document.getElementById("status");
const gridElement = document.getElementById("extensions");
const reloadButton = document.getElementById("reload");
const lifecycleNoticeElement = document.getElementById("lifecycle-notice");

const lifecycle = globalThis.pgextwinLifecycle;
const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function text(value) {
  return document.createTextNode(String(value));
}

function element(name, className) {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

function githubUrl(repository) {
  return `https://github.com/${repository}`;
}

function releaseUrl(repository, tag) {
  return `${githubUrl(repository)}/releases/tag/${encodeURIComponent(tag)}`;
}

function upstreamUrl(repository) {
  return `https://github.com/${repository}`;
}

function upstreamVersionLabel(record) {
  if (record.upstream && record.upstream.version) return record.upstream.version;
  if (record.upstream && record.upstream.perPostgresql) return "Per PostgreSQL";
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

function renderPostgresqlMajor(record, major, lifecycleByMajor, effectiveDate) {
  const item = element("li", "pg-version");
  const heading = element("div", "pg-version-heading");
  const name = element("strong");
  name.append(text(`PostgreSQL ${major}`));
  heading.append(name);

  const { entry, status } = lifecycleView(lifecycleByMajor, major, effectiveDate);
  const badge = element("span", `lifecycle-badge lifecycle-badge--${status}`);
  const detail = element("span", "pg-version-detail");

  if (status === "maintained") {
    badge.append(text("Maintained"));
    detail.append(text(`Available · Supported through ${entry.eol}`));
  } else if (status === "historical") {
    badge.append(text("EOL / Historical"));
    detail.append(text(`Historical binary · PostgreSQL ${major} reached EOL on ${entry.eol}`));
  } else {
    badge.append(text("Lifecycle unknown"));
    detail.append(text("Available · Lifecycle data unavailable"));
  }

  heading.append(badge);
  item.append(heading, detail);

  const version = upstreamVersionForMajor(record, major);
  if (version) {
    const upstreamVersion = element("span", "pg-version-upstream");
    upstreamVersion.append(text(`Upstream ${version}`));
    item.append(upstreamVersion);
  }

  return item;
}

function renderExtension(record, lifecycleByMajor, effectiveDate) {
  const card = element("article", "extension-card");

  const title = element("h3");
  title.append(text(record.displayName));
  card.append(title);

  const description = element("p");
  description.append(text(record.description));
  card.append(description);

  const meta = element("dl", "meta");
  const pairs = [
    ["Upstream", upstreamVersionLabel(record)],
    ["Build", record.latest.releaseTag],
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

  const pgHeading = element("p", "pg-heading");
  pgHeading.append(text("PostgreSQL binaries"));
  card.append(pgHeading);

  const pgList = element("ul", "pg-list");
  const majors = Object.entries(record.postgresql)
    .filter(([, info]) => info.available)
    .map(([major]) => Number(major))
    .sort((a, b) => a - b);

  for (const major of majors) {
    pgList.append(renderPostgresqlMajor(record, major, lifecycleByMajor, effectiveDate));
  }
  card.append(pgList);

  const actions = element("div", "card-actions");

  const release = element("a");
  release.href = releaseUrl(record.repository, record.latest.releaseTag);
  release.append(text("Release"));
  actions.append(release);

  const repo = element("a");
  repo.href = githubUrl(record.repository);
  repo.append(text("Repository"));
  actions.append(repo);

  const upstream = element("a");
  upstream.href = upstreamUrl(record.upstream.repository);
  upstream.append(text("Upstream"));
  actions.append(upstream);

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
      `EOL後も既存バイナリは保持しますが、${formatJapaneseCalendarDate(nextDate)}以降の通常の新規build対象からは除外します。`
    ));
  } else if (status === "historical") {
    const nextDate = lifecycle.nextCalendarDate(entry.eol);
    english.append(text(
      `PostgreSQL 14 reached EOL on ${formatEnglishCalendarDate(entry.eol)}. ` +
      `Existing binaries remain available as historical downloads; normal new builds have excluded PG14 since ${formatEnglishCalendarDate(nextDate)}.`
    ));
    japanese.append(text(
      `PostgreSQL 14は${formatJapaneseCalendarDate(entry.eol)}にEOLを迎えました。` +
      `既存バイナリはhistorical downloadとして保持し、通常の新規buildでは${formatJapaneseCalendarDate(nextDate)}以降PG14を対象外としています。`
    ));
  } else {
    english.append(text(
      "PostgreSQL lifecycle data is unavailable. Published binary availability is still shown from the catalog, but current maintenance status cannot be determined."
    ));
    japanese.append(text(
      "PostgreSQL Lifecycle metadataを取得できません。Catalogに基づく公開済みバイナリの表示は継続しますが、現在のmaintenance状態は判定できません。"
    ));
  }

  lifecycleNoticeElement.append(english, japanese);
}

async function loadCatalogRecords() {
  const indexResponse = await fetch(`${CATALOG_BASE}/index.json`, { cache: "no-store" });
  if (!indexResponse.ok) throw new Error(`Catalog index: HTTP ${indexResponse.status}`);

  const index = await indexResponse.json();
  const names = Array.isArray(index.extensions) ? index.extensions : [];

  if (names.length === 0) return [];

  return Promise.all(
    names.map(async (name) => {
      const response = await fetch(`${CATALOG_BASE}/extensions/${encodeURIComponent(name)}.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return response.json();
    })
  );
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
  statusElement.textContent = "Loading catalog…";
  gridElement.replaceChildren();

  try {
    const [records, lifecycleResult] = await Promise.all([
      loadCatalogRecords(),
      loadLifecycleMetadata().then(
        (metadata) => ({ ok: true, metadata }),
        (error) => ({ ok: false, error })
      )
    ]);

    if (records.length === 0) {
      statusElement.textContent = "No verified extension releases are listed yet.";
      lifecycleNoticeElement.textContent = "";
      return;
    }

    const effectiveDate = lifecycle.getUtcCalendarDate(new Date());
    const lifecycleByMajor = lifecycleResult.ok
      ? lifecycle.indexPostgresqlLifecycleMetadata(lifecycleResult.metadata)
      : new Map();

    if (!lifecycleResult.ok) console.warn(lifecycleResult.error);

    records.sort((a, b) => a.displayName.localeCompare(b.displayName));
    gridElement.replaceChildren(
      ...records.map((record) => renderExtension(record, lifecycleByMajor, effectiveDate))
    );
    renderLifecycleNotice(lifecycleByMajor, effectiveDate);

    const lifecycleSuffix = lifecycleResult.ok
      ? ` Lifecycle status uses the ${effectiveDate} UTC calendar date.`
      : " Lifecycle data unavailable; binary availability is still shown.";
    statusElement.textContent = `${records.length} verified extensions listed.${lifecycleSuffix}`;
  } catch (error) {
    console.error(error);
    statusElement.textContent = "The catalog could not be loaded. Please use the GitHub catalog link below.";
    lifecycleNoticeElement.textContent = "";
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener("click", loadCatalog);
loadCatalog();
