(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.pgextwinLandscapeView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const statuses = ["implemented", "candidate", "not-planned"];
  const types = ["upstream-official", "community", "vendor", "package-manager"];
  const availability = ["public", "vendor-product", "support-customer", "commercial-bundled"];
  const distributions = ["standard-postgresql", "vendor-postgresql", "conda-postgresql", "unknown"];
  const compatibility = ["standard-postgresql", "vendor-specific", "manual-verification-required", "unknown"];
  const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
  const namePattern = /^[a-z][a-z0-9_]*$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const nonempty = value => typeof value === "string" && value.trim().length > 0;
  function safeHttpsUrl(url) {
    if (!nonempty(url)) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password ? parsed.href : null;
    } catch { return null; }
  }
  function validDate(value) {
    if (!datePattern.test(value || "")) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
  }
  function validateIndex(index) {
    if (!index || index.schemaVersion !== 1 || !Array.isArray(index.extensions) ||
      !index.extensions.every(name => typeof name === "string" && namePattern.test(name)) ||
      new Set(index.extensions).size !== index.extensions.length) return {valid:false,reason:"Landscape index invalid"};
    return {valid:true,reason:null};
  }
  function validateSource(source) {
    return !!source && nonempty(source.provider) && types.includes(source.type) &&
      !!safeHttpsUrl(source.url) && availability.includes(source.availability) &&
      distributions.includes(source.postgresqlDistribution) && compatibility.includes(source.compatibility) &&
      nonempty(source.notes);
  }
  function validateRoadmap(roadmap) {
    if (!roadmap || typeof roadmap !== "object" || Array.isArray(roadmap)) return false;
    if (!["wave-2","reserve","research"].includes(roadmap.decision) ||
        !validDate(roadmap.decisionDate) || !nonempty(roadmap.rationale)) return false;
    const keys=Object.keys(roadmap);
    if (keys.some(k=>!["decision","order","decisionDate","rationale"].includes(k))) return false;
    return roadmap.decision === "wave-2"
      ? Number.isInteger(roadmap.order) && roadmap.order>=1 && roadmap.order<=3
      : !Object.hasOwn(roadmap,"order");
  }
  function roadmapLabel(record) {
    const r=record && record.roadmap;
    if (!r) return "Decision pending / 正式選定待ち";
    if (r.decision === "wave-2") return "Wave 2 #" + r.order + " / 第2弾 #" + r.order;
    if (r.decision === "reserve") return "Reserve candidate / 次点候補";
    if (r.decision === "research") return "Further research / 継続調査";
    return "Decision pending / 正式選定待ち";
  }
  function sortRecords(records) {
    // Keep the historical alphabetical positions of implemented/not-planned entries.
    const alphabetical=[...(Array.isArray(records)?records:[])].sort((a,b)=>a.displayName.localeCompare(b.displayName));
    const candidateOrder={ "wave-2":0, reserve:1, research:2 };
    const candidates=alphabetical.filter(r=>r.status==="candidate").sort((a,b)=>{
      const da=a.roadmap?.decision,db=b.roadmap?.decision;
      const ka=Object.hasOwn(candidateOrder,da)?candidateOrder[da]:3;
      const kb=Object.hasOwn(candidateOrder,db)?candidateOrder[db]:3;
      return ka-kb || (ka===0?(a.roadmap.order-b.roadmap.order):0) || a.displayName.localeCompare(b.displayName);
    });
    let i=0;
    return alphabetical.map(r=>r.status==="candidate"?candidates[i++]:r);
  }
  function validateRecord(record, expectedName) {
    if (!record || record.schemaVersion !== 1 || !namePattern.test(record.name || "") ||
      (expectedName && record.name !== expectedName) || !nonempty(record.displayName) ||
      !nonempty(record.description) || !repoPattern.test(record.upstreamRepository || "") ||
      !statuses.includes(record.status) || !validDate(record.lastReviewed) ||
      !Array.isArray(record.evidenceUrls) || !record.evidenceUrls.length ||
      !record.evidenceUrls.every(u => !!safeHttpsUrl(u)) ||
      !Array.isArray(record.windowsBinarySources) || !record.windowsBinarySources.every(validateSource)) {
      return {valid:false,reason:"Landscape record invalid"};
    }
    if (record.status === "implemented" && record.pgextwinCatalogName !== record.name) {
      return {valid:false,reason:"Invalid distribution catalog reference"};
    }
    if (record.status === "candidate" && (!nonempty(record.candidateRationale) ||
      !nonempty(record.license) || !nonempty(record.currentStableVersion) ||
      !["supported","not-supported","unknown"].includes(record.pg18Support) ||
      !["documented","upstream-ci-probe","under-review","unknown","known-incompatible"].includes(record.pg19Readiness) ||
      !["build-instructions","native-binary","unknown","not-supported"].includes(record.windowsUpstreamSupport) ||
      !["none-identified","limited","public","unknown"].includes(record.knownWindowsBinaryAvailability) ||
      !["low","medium","high","very-high","unknown"].includes(record.estimatedWindowsEffort) ||
      !["high","medium","low","unranked"].includes(record.preliminaryPriority))) {
      return {valid:false,reason:"Candidate metadata invalid"};
    }
    if (record.roadmap !== undefined && (record.status !== "candidate" || !validateRoadmap(record.roadmap))) {
      return {valid:false,reason:"Invalid candidate roadmap"};
    }
    if (record.status === "not-planned" && (!nonempty(record.notPlannedReason) ||
      !nonempty(record.reasonCode) || record.windowsBinarySources.length === 0)) {
      return {valid:false,reason:"Not-planned reason or acquisition source missing"};
    }
    return {valid:true,reason:null};
  }
  function partitionResults(results, names) {
    const records = [], failures = [];
    (Array.isArray(results) ? results : []).forEach((result, index) => {
      if (!result || result.status !== "fulfilled") {
        failures.push({name:names[index],reason:String(result && result.reason || "Fetch failed")});
      } else {
        const validation = validateRecord(result.value, names[index]);
        if (validation.valid) records.push(result.value);
        else failures.push({name:names[index],reason:validation.reason});
      }
    });
    return {records,failures};
  }
  function matches(record, options = {}) {
    const q = String(options.query || "").trim().toLowerCase();
    if (options.status && record.status !== options.status) return false;
    if (options.sourceType && !record.windowsBinarySources.some(s => s.type === options.sourceType)) return false;
    return !q || [record.name,record.displayName,record.description,record.upstreamRepository,
      record.candidateRationale,record.notPlannedReason,record.roadmap?.rationale,record.roadmap?.decision,...record.windowsBinarySources.map(s => s.provider)]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  }
  function filterRecords(records, options) {
    return (Array.isArray(records) ? records : []).filter(x => matches(x, options));
  }
  const statusLabels = {
    implemented:"Available in pgextwin / pgextwinで配布中",
    candidate:"Future candidate / 今後の候補",
    "not-planned":"Not planned in pgextwin / 他の配布元を案内"
  };
  const typeLabels = {
    "upstream-official":"Official upstream / 公式",
    community:"Community / コミュニティ",
    vendor:"Vendor / ベンダー",
    "package-manager":"Package manager / パッケージ管理"
  };
  const accessLabels = {
    public:"Public / 公開",
    "vendor-product":"Vendor product users / ベンダー製品向け",
    "support-customer":"Support customers only / サポート契約者限定",
    "commercial-bundled":"Commercial bundle / 商用製品同梱"
  };
  const targetLabels = {
    "standard-postgresql":"Standard PostgreSQL / 通常版",
    "vendor-postgresql":"Vendor PostgreSQL / ベンダー版",
    "conda-postgresql":"Conda PostgreSQL environment / Conda環境",
    unknown:"Target unknown / 対象不明"
  };
  const compatibilityLabels = {
    "standard-postgresql":"Ordinary PostgreSQL / 通常版向け",
    "vendor-specific":"Vendor-specific / ベンダー専用",
    "manual-verification-required":"Manual compatibility verification required / 導入前に互換性要確認",
    unknown:"Compatibility unknown / 互換性未確認"
  };
  function sourceLabel(source) {
    return [typeLabels[source.type],accessLabels[source.availability],targetLabels[source.postgresqlDistribution],
      compatibilityLabels[source.compatibility]].join(" — ");
  }
  async function load(fetcher, base) {
    const response = await fetcher(base + "/landscape/index.json", {cache:"no-store"});
    if (!response.ok) throw new Error("Landscape index HTTP " + response.status);
    const index = await response.json();
    const validation = validateIndex(index);
    if (!validation.valid) throw new Error(validation.reason);
    const results = await Promise.allSettled(index.extensions.map(async name => {
      const r = await fetcher(base + "/landscape/extensions/" + encodeURIComponent(name) + ".json", {cache:"no-store"});
      if (!r.ok) throw new Error("Landscape record HTTP " + r.status);
      return await r.json();
    }));
    return partitionResults(results,index.extensions);
  }
  return {safeHttpsUrl,validDate,validateIndex,validateRecord,validateRoadmap,roadmapLabel,sortRecords,partitionResults,filterRecords,sourceLabel,
    statusLabels,typeLabels,accessLabels,targetLabels,compatibilityLabels,load};
});
