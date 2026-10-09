(function () {
  "use strict";
  const view = globalThis.pgextwinLandscapeView;
  const t = (value) => globalThis.pgextwinI18n ? globalThis.pgextwinI18n.t(value) : String(value);
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
  let failures = 0;
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
    if (!link(actions,source.url,"Get Windows binary / 取得先を開く","inline-link")) {
      actions.append(node("span",null,"Acquisition URL unavailable"));
    }
    li.append(actions);
    return li;
  }
  function card(record) {
    const article = node("article","extension-card landscape-card");
    const heading = node("h3",null,record.displayName);
    article.append(heading,node("p","landscape-status-label",view.statusLabels[record.status]));
    article.append(node("p",null,record.description));
    const meta = node("dl","meta");
    field(meta,"Upstream",record.upstreamRepository);
    field(meta,"Last reviewed / 最終確認",record.lastReviewed + " (recheck before use)");
    if (record.status === "candidate") {
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
    article.append(meta);
    if (record.status === "implemented") {
      if (record.roadmap) {
        article.append(node("p","landscape-roadmap-label",view.roadmapLabel(record)));
        field(meta,"Historical roadmap / 選定履歴",view.roadmapLabel(record));
        field(meta,"Decision date / 選定日",record.roadmap.decisionDate);
        article.append(node("p","landscape-muted",(document.documentElement.lang === "ja" ? "当時の選定理由：" : "Original selection rationale: ") + t(record.roadmap.rationale)));
      }
      article.append(node("p",null,"Published, verified binaries are in the distribution catalog. / 配布中のバイナリは上部の配布カタログをご確認ください。"));
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
    if (record.status === "candidate") {
      article.append(node("h4",null,"Why consider it / 候補理由"));
      article.append(node("p",null,record.candidateRationale));
      article.append(node("h4",null,"Selection rationale / 正式選定の理由"));
      article.append(node("p",null,record.roadmap?.rationale || "Formal decision pending / 正式決定は未登録です。"));
      if (record.windowsBinarySources.length === 0) {
        article.append(node("p","landscape-muted","No generally available Windows binary identified / 一般入手可能なWindowsバイナリは未確認（使用不可という意味ではありません）。"));
      }
    }
    if (record.status === "not-planned") {
      article.append(node("h4",null,"Why not planned / 見送り理由"));
      article.append(node("p",null,(document.documentElement.lang === "ja" && record.notPlannedReasonJa) || record.notPlannedReason));
      
    }
    if (record.windowsBinarySources.length) {
      article.append(node("h4",null,"External Windows binary sources / 外部取得先"));
      const ul = node("ul","landscape-sources");
      for (const source of record.windowsBinarySources) ul.append(sourceItem(source));
      article.append(ul);
    }
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
    return article;
  }
  function render() {
    const selected = view.filterRecords(records,{query:search.value,status:filter.value,sourceType:sourceFilter.value});
    const query=search.value.trim().toLocaleLowerCase();
    if (document.documentElement.lang === "ja" && query) {
      for (const record of records) {
        if (!selected.includes(record) && (!filter.value || record.status === filter.value) &&
            (!sourceFilter.value || record.windowsBinarySources.some(s=>s.type === sourceFilter.value)) &&
            [record.description,record.candidateRationale,record.notPlannedReason,record.roadmap?.rationale,
              ...record.windowsBinarySources.map(s=>s.notes)].some(v=>v && t(v).toLocaleLowerCase().includes(query))) selected.push(record);
      }
    }
    grid.replaceChildren(...selected.map(card));
    empty.hidden = selected.length !== 0;
    count.textContent = t(selected.length + " of " + records.length + " Landscape entries shown.");
    empty.textContent = t(records.length ? "No Landscape entries match the selected filters." : "No valid Landscape entries loaded.");
  }
  async function load() {
    reload.disabled = true;
    status.textContent = t("Loading independent Landscape registry…");
    try {
      const result = await view.load(fetch,BASE);
      records = view.sortRecords(result.records);
      failures = result.failures.length;
      for (const f of result.failures) console.warn("Landscape record unavailable:",f.name,f.reason);
      render();
      status.textContent = t(records.length + " Landscape entries loaded." + (failures ? " " + failures + " entry/entries failed; valid entries remain visible." : "") + " External source details are point-in-time research, not pgextwin guarantees.");
    } catch (error) {
      console.warn("Landscape unavailable (distribution catalog unaffected):",error);
      records = [];
      failures = 0;
      render();
      status.textContent = t("Landscape registry unavailable. Existing pgextwin catalog and downloads remain independent.");
    } finally { reload.disabled = false; }
  }
  for (const input of [search,filter,sourceFilter]) input.addEventListener(input === search ? "input":"change",render);
  reload.addEventListener("click",load);
  load();
})();
