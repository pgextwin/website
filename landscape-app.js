(function () {
  "use strict";
  const view = globalThis.pgextwinLandscapeView;
  const t = (value) => globalThis.pgextwinI18n ? globalThis.pgextwinI18n.t(value) : String(value);
  const describe = (value) => globalThis.pgextwinI18n?.describe(value) ?? String(value);
  const BASE = "https://raw.githubusercontent.com/pgextwin/catalog/main";
  const status = document.getElementById("landscape-status");
  const count = document.getElementById("landscape-count");
  const grid = document.getElementById("landscape-grid");
  const empty = document.getElementById("landscape-empty");
  const search = document.getElementById("landscape-search");
  const filter = document.getElementById("landscape-filter");
  const sourceFilter = document.getElementById("landscape-source-filter");
  const reload = document.getElementById("landscape-reload");
  let records = [];
  function node(tag,className,value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = t(value);
    return el;
  }
  function link(parent,url,label,cls) {
    const href = view.safeHttpsUrl(url);
    if (!href) return false;
    const a = node("a",cls,label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    parent.append(a);
    return true;
  }
  function field(parent,label,value) {
    parent.append(node("dt",null,label),node("dd",null,value));
  }
  function sourceItem(source) {
    const li = node("li","landscape-source");
    li.append(node("p","source-provider",source.provider));
    li.append(node("p",null,view.sourceLabel(source)));
    li.append(node("p",null,source.notes));
    const actions = node("p");
    if (!link(actions,source.url,"Open provider page / 提供元のページを開く","inline-link")) {
      actions.append(node("span",null,"Acquisition URL unavailable"));
    }
    li.append(actions);
    return li;
  }
  function packageSection(record, route, packages) {
    const section = node("section");
    section.append(node("h4",null,view.distributionLabels[route]));
    if (record.name === "pgrouting") {
      section.append(node("p",null,"Available in the same package as PostGIS. / PostGISと同じパッケージに同梱されています。"));
    }
    const list = node("ul","landscape-packages");
    for (const pkg of [...packages].sort((a,b) => Number(a.pgMajor) - Number(b.pgMajor))) {
      const target = pkg.pgMajor ? "PostgreSQL " + pkg.pgMajor :
        t("Independent of PostgreSQL major / PostgreSQLのメジャーバージョン指定なし");
      const entry = node("li");
      const version = (record.name === "pgrouting" ? "PostGIS " : "") + pkg.upstreamVersion;
      entry.append(version + " · " + target + " · ", node("code",null,pkg.assetName));
      if (pkg.pgroutingVersion) entry.append(" · pgRouting " + pkg.pgroutingVersion);
      if (pkg.sourceRepo) entry.append(" · " + pkg.sourceRepo);
      list.append(entry);
    }
    section.append(list);
    return section;
  }
  function distributionBadge(route) {
    return node("span","landscape-status-label landscape-status-label--" + route,view.distributionLabels[route]);
  }
  function card(record) {
    const article = node("article","extension-card landscape-card");
    article.append(node("h3",null,record.displayName));
    if (record.description) article.append(node("p",null,describe(record.description)));
    const candidate = record.distributions.includes("candidate");
    const meta = node("dl","meta");
    if (record.upstreamRepository) field(meta,"Upstream",record.upstreamRepository);
    if (record.lastReviewed) field(meta,"Last reviewed / 最終確認",record.lastReviewed + " (recheck before use)");
    if (candidate && record.status === "candidate") {
      article.append(node("p","landscape-roadmap-label",view.roadmapLabel(record)));
      field(meta,"Formal roadmap / 正式選定",view.roadmapLabel(record));
      if (record.roadmap) field(meta,"Decision date / 決定日",record.roadmap.decisionDate);
      field(meta,"Stable version",record.currentStableVersion);
      field(meta,"License",record.license);
      field(meta,"Windows build effort",record.estimatedWindowsEffort);
      field(meta,"PG18",record.pg18Support);
      field(meta,"PG19 readiness",record.pg19Readiness);
      field(meta,"Upstream Windows",record.windowsUpstreamSupport);
      field(meta,"Existing source",record.knownWindowsBinaryAvailability);
    }
    if (meta.childElementCount) article.append(meta);
    if (record.distributions.includes("implemented")) {
      if (record.roadmap) {
        article.append(node("p","landscape-roadmap-label",view.roadmapLabel(record)));
        field(meta,"Historical roadmap / 選定履歴",view.roadmapLabel(record));
        field(meta,"Decision date / 選定日",record.roadmap.decisionDate);
        article.append(node("p","landscape-muted",(document.documentElement.lang === "ja" ? "当時の選定理由：" : "Original selection rationale: ") + t(record.roadmap.rationale)));
      }
      article.append(node("p",null,"Published, verified binaries are in the distribution catalog. / 公開・検証済みのバイナリは、ページ上部の配布Catalogで確認できます。"));
      const actions = node("p");
      const a = node("a","download-link","Find pgextwin downloads / 配布一覧へ");
      a.href = "#extensions-heading";
      a.addEventListener("click",() => {
        const catalogSearch = document.getElementById("search");
        if (catalogSearch) { catalogSearch.value = record.pgextwinCatalogName; catalogSearch.dispatchEvent(new Event("input",{bubbles:true})); }
      });
      actions.append(a);
      article.append(actions);
    }
    if (record.reason) {
      article.append(node("h4",null,"Distribution decision / 配布区分の理由"));
      article.append(node("p",null,record.reason));
    }
    for (const [route, packages] of Object.entries(record.packages || {})) {
      article.append(packageSection(record, route, packages));
    }
    if (record.packages) {
      const guide = node("a","inline-link","See CLI download instructions / CLIでの取得方法");
      guide.href = "./cli.html";
      article.append(guide);
    }
    if (candidate && record.status === "candidate") {
      if (!record.reason) {
        article.append(node("h4",null,"Why consider it / 候補理由"));
        article.append(node("p",null,record.candidateRationale));
      }
      article.append(node("h4",null,"Selection rationale / 正式選定の理由"));
      article.append(node("p",null,record.roadmap?.rationale || "Formal decision pending / 正式決定は未登録です。"));
      if (record.windowsBinarySources.length === 0) {
        article.append(node("p","landscape-muted","No generally available Windows binary identified / 一般に入手できるWindowsバイナリは確認できていません（使用できないという意味ではありません）。"));
      }
    }
    if (record.distributions.includes("not-planned") && !record.reason) {
      article.append(node("h4",null,"Why not planned / 見送り理由"));
      article.append(node("p",null,(document.documentElement.lang === "ja" && record.notPlannedReasonJa) || record.notPlannedReason));
    }
    if (record.windowsBinarySources.length) {
      article.append(node("h4",null,"External Windows binary sources / 外部取得先"));
      const ul = node("ul","landscape-sources");
      for (const source of record.windowsBinarySources) ul.append(sourceItem(source));
      article.append(ul);
    }
    if (record.evidenceUrls?.length) {
      const evidence = node("details");
      evidence.append(node("summary",null,"Research evidence / 判定根拠"));
      const list = node("ul");
      record.evidenceUrls.forEach((url,i) => {
        const li = node("li");
        link(li,url,"Source " + (i+1));
        list.append(li);
      });
      evidence.append(list);
      article.append(evidence);
    }
    const content = node("div", "landscape-detail-body");
    while (article.firstChild) content.append(article.firstChild);
    const details = node("details", "landscape-collapse");
    details.name = "pgextwin-landscape";
    details.id = "landscape-" + record.name;
    const summary = node("summary", "landscape-summary");
    const identity = node("span", "extension-identity");
    identity.append(node("span", "extension-title", record.displayName));
    if (record.description) identity.append(node("span", "extension-description", describe(record.description)));
    const badges = node("span", "extension-summary-badges");
    badges.append(...record.distributions.map(distributionBadge));
    if (!record.distributions.length) {
      badges.append(node("span","landscape-status-label","CLI status unavailable / CLI対応状況を取得できません"));
    }
    if (record.roadmap) badges.append(node("span", "summary-roadmap", view.roadmapLabel(record)));
    summary.append(identity, badges, node("span", "summary-affordance", "View details"));
    details.append(summary, content);
    details.addEventListener("toggle", () => {
      const url = new URL(window.location.href);
      if (details.open) {
        for (const other of grid.querySelectorAll(".landscape-collapse"))
          if (other !== details && other.open) other.open = false;
        url.searchParams.set("landscape", record.name);
        window.history.replaceState(null, "", url);
      } else if (url.searchParams.get("landscape") === record.name) {
        url.searchParams.delete("landscape");
        window.history.replaceState(null, "", url);
      }
    });
    article.append(details);
    return article;
  }
  function render() {
    const selected = view.filterRecords(records,{
      query: search.value, status: filter.value, sourceType: sourceFilter.value, translate: t
    });
    grid.replaceChildren(...selected.map(card));
    const requested = new URL(window.location.href).searchParams.get("landscape");
    if (requested) {
      const found = [...grid.querySelectorAll(".landscape-collapse")]
        .find((item) => item.id === "landscape-" + requested);
      if (found) found.open = true;
    }
    empty.hidden = selected.length !== 0;
    count.textContent = t(selected.length + " of " + records.length + " Landscape entries shown.");
    empty.textContent = t(records.length ? "No Landscape entries match the selected filters." : "No valid Landscape entries loaded.");
  }
  async function load() {
    reload.disabled = true;
    status.textContent = t("Loading independent Landscape registry…");
    try {
      const routes = Object.entries(view.packageRoutes);
      const [landscape, ...packages] = await Promise.allSettled([
        view.load(fetch,BASE),
        ...routes.map(([,path]) => view.loadPackages(fetch,BASE,path))
      ]);
      const packageLists = Object.fromEntries(routes.map(([route], index) => {
        const result = packages[index];
        if (result.status === "fulfilled") return [route, result.value];
        console.warn("External catalog unavailable:", route, result.reason);
        return [route, null];
      }));
      const {records: entries, failures} = landscape.status === "fulfilled" ? landscape.value : {records: [], failures: []};
      for (const failure of failures) console.warn("Landscape record unavailable:",failure.name,failure.reason);
      records = view.browseRecords(entries, packageLists);
      render();
      const messages = [t(records.length + " Landscape entries loaded." +
        (failures.length ? " " + failures.length + " entry/entries failed; valid entries remain visible." : ""))];
      if (landscape.status === "rejected") {
        console.warn("Landscape registry unavailable:",landscape.reason);
        messages.push(t("The Landscape registry is unavailable. Catalog ZIPs remain listed above. / 対応状況の一覧を取得できません。pgextwinのZIPは上の配布カタログで確認できます。"));
      }
      if (Object.values(packageLists).includes(null)) {
        messages.push(t("Some external CLI packages could not be listed. / 外部パッケージのCLI対応状況を一部取得できませんでした。"));
      }
      status.textContent = messages.join(" ");
    } catch (error) {
      console.warn("Landscape unavailable (distribution catalog unaffected):",error);
      records = [];
      render();
      status.textContent = t("Landscape registry unavailable. Existing pgextwin catalog and downloads remain independent.");
    } finally { reload.disabled = false; }
  }
  for (const option of filter.querySelectorAll("optgroup option")) {
    option.textContent = t(view.distributionLabels[option.value]);
  }
  for (const input of [search,filter,sourceFilter]) input.addEventListener(input === search ? "input":"change",render);
  reload.addEventListener("click",load);
  load();
})();
