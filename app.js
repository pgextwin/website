const CATALOG_BASE = "https://raw.githubusercontent.com/pgextwin/catalog/main";
const statusElement = document.getElementById("status");
const gridElement = document.getElementById("extensions");
const reloadButton = document.getElementById("reload");

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

function renderExtension(record) {
  const card = element("article", "extension-card");

  const title = element("h3");
  title.append(text(record.displayName));
  card.append(title);

  const description = element("p");
  description.append(text(record.description));
  card.append(description);

  const meta = element("dl", "meta");
  const pairs = [
    ["Upstream", record.upstream.version],
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

  const pgHeading = element("p");
  pgHeading.append(text("PostgreSQL"));
  card.append(pgHeading);

  const pgList = element("ul", "pg-list");
  const majors = Object.entries(record.postgresql)
    .filter(([, info]) => info.available)
    .map(([major]) => Number(major))
    .sort((a, b) => a - b);

  for (const major of majors) {
    const item = element("li");
    item.append(text(`PG ${major}`));
    pgList.append(item);
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

async function loadCatalog() {
  reloadButton.disabled = true;
  statusElement.textContent = "Loading catalog…";
  gridElement.replaceChildren();

  try {
    const indexResponse = await fetch(`${CATALOG_BASE}/index.json`, { cache: "no-store" });
    if (!indexResponse.ok) throw new Error(`Catalog index: HTTP ${indexResponse.status}`);

    const index = await indexResponse.json();
    const names = Array.isArray(index.extensions) ? index.extensions : [];

    if (names.length === 0) {
      statusElement.textContent = "No verified extension releases are listed yet.";
      return;
    }

    const records = await Promise.all(
      names.map(async (name) => {
        const response = await fetch(`${CATALOG_BASE}/extensions/${encodeURIComponent(name)}.json`, { cache: "no-store" });
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        return response.json();
      })
    );

    records.sort((a, b) => a.displayName.localeCompare(b.displayName));
    gridElement.replaceChildren(...records.map(renderExtension));
    statusElement.textContent = `${records.length} verified extension${records.length === 1 ? "" : "s"} listed.`;
  } catch (error) {
    console.error(error);
    statusElement.textContent = "The catalog could not be loaded. Please use the GitHub catalog link below.";
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener("click", loadCatalog);
loadCatalog();
