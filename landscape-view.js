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
  const distributionLabels = {
    implemented: "CLI download · pgextwin builds (signed feed) / CLI取得可・pgextwinビルド（署名付きフィード）",
    "external-direct": "CLI download · External binaries / CLI取得可・外部バイナリ",
    "external-standalone": "CLI download · Standalone packages / CLI取得可・単体パッケージ",
    candidate: "Candidate · CLI unavailable / 候補・CLI未対応",
    "license-excluded": "License exclusion · CLI unavailable / ライセンス上の理由で対象外・CLI未対応",
    "not-planned": "No plans · CLI unavailable / 対応予定なし・CLI未対応"
  };
  const packageRoutes = {
    "external-direct": "external/direct-get.json",
    "external-standalone": "external/standalone-get.json"
  };
  const packageDetails = {
    pg_trickle: ["pg_trickle", "Incrementally maintained stream tables / 差分更新によるストリームテーブル"],
    pglogical: ["pglogical", "Logical replication / 論理レプリケーション"],
    pg_crash: ["pg_crash", "Crash simulation for PostgreSQL tests / PostgreSQLの障害テスト用の拡張機能"],
    pgbouncer: ["PgBouncer", "Connection pooler / コネクションプーラー"],
    psqlodbc: ["psqlODBC", "PostgreSQL ODBC driver / PostgreSQLのODBCドライバー"]
  };
  // These decisions concern the named packages. They do not grant download rights.
  const decisions = {
    pgroonga: {
      reason: "Waiting for signed evidence linking the Windows package to its upstream build. / Windowsパッケージと上流ビルドの対応を示す署名付きの証明を待っています。"
    },
    pg_lockout: {
      type: "candidate", displayName: "pg_lockout",
      reason: "License evidence for the exact Windows package is still unavailable. / 対象のWindowsパッケージのライセンス根拠を確認できていません。"
    },
    pg_prohibit_commands: {
      type: "candidate", displayName: "pg_prohibit_commands",
      reason: "License evidence for the exact Windows package is still unavailable. / 対象のWindowsパッケージのライセンス根拠を確認できていません。"
    },
    pgagent: {
      type: "license-excluded", displayName: "pgAgent 4.2.3-1",
      reason: "The source uses the PostgreSQL License. The installer has no package-wide terms, and three bundled helper EXEs could not be traced to a licensed source revision. / ソースにはPostgreSQL Licenseが適用されます。インストーラー全体の利用条件が確認できず、同梱の補助EXE 3本もライセンスを確認できるソースの版に紐づけられませんでした。"
    },
    edb_language_pack: {
      type: "license-excluded", displayName: "EDB Language Pack 3.13-1 / 4.12-1",
      reason: "Package-wide terms are missing. The third-party notice omits OpenSSL, SQLite, the MSVC runtime and libraries bundled with pip. / パッケージ全体の利用条件が確認できず、第三者ライセンスの通知にもOpenSSL、SQLite、MSVCランタイム、pip同梱ライブラリの記載がありません。"
    },
    asp_bluefin: {
      type: "license-excluded", displayName: "ASP Bluefin 1.7.0-1",
      reason: "The bundled EnterpriseDB Limited Use License 2.10 limits use to internal, non-commercial evaluation and prohibits distribution. / 同梱のEnterpriseDB Limited Use License 2.10は社内での非商用評価に利用を限り、配布を禁止しています。"
    },
    timescaledb: {
      type: "license-excluded", displayName: "TimescaleDB",
      reason: "The reviewed Windows builds include Timescale-licensed (-tsl) components and did not pass pgextwin's license review. / 確認したWindowsビルドにはTimescale Licenseが適用されるコンポーネント（-tsl）が含まれており、pgextwinのライセンス審査では対象外となりました。"
    },
    postgresql_minor_updates: {
      type: "not-planned", displayName: "PostgreSQL minor-update installers / PostgreSQLのマイナーアップデート用インストーラー",
      reason: "pgextwin does not plan to add PostgreSQL server updates. / PostgreSQLサーバーの更新用インストーラーはpgextwinの対象外です。"
    },
    edb_commercial_tools: {
      type: "not-planned", displayName: "EDB commercial tools / EDBの商用ツール",
      reason: "PEM, Migration Toolkit and other registration-required tools are outside pgextwin's download scope. / PEM、Migration Toolkitなど、EDBへの登録が必要なツールはpgextwinの取得対象外です。"
    }
  };

  function browseRecords(records, packageLists) {
    const byName = new Map(records.map(record => [record.name, {...record}]));
    for (const [name, {displayName}] of Object.entries(decisions)) {
      if (displayName && !byName.has(name)) {
        byName.set(name, {name, displayName, windowsBinarySources: []});
      }
    }
    const addPackage = (name, route, pkg) => {
      if (!byName.has(name)) {
        const [displayName, description] = packageDetails[name] || [name];
        byName.set(name, {name, displayName, description, windowsBinarySources: []});
      }
      const record = byName.get(name);
      record.packages ??= {};
      (record.packages[route] ??= []).push(pkg);
    };
    for (const route of Object.keys(packageRoutes)) {
      for (const pkg of packageLists[route] || []) {
        const name = pkg.extension || pkg.item;
        addPackage(name, route, pkg);
        // The CLI selects the same PostGIS package when asked for pgRouting.
        if (name === "postgis") addPackage("pgrouting", route, pkg);
      }
    }
    const packagesAvailable = Object.values(packageLists).every(list => list !== null);
    for (const record of byName.values()) {
      const decision = decisions[record.name];
      record.reason = decision?.reason;
      record.distributions = [
        ...(record.status === "implemented" ? ["implemented"] : []),
        ...Object.keys(record.packages || {})
      ];
      if (decision?.type === "license-excluded") {
        record.distributions = [decision.type];
        delete record.packages;
        record.evidenceUrls = [];
        record.windowsBinarySources = [];
      } else {
        if (!record.distributions.length) {
          const fallback = decision?.type || record.status;
          if (decision?.type || packagesAvailable) record.distributions = [fallback];
        }
        // The older GIS source notes describe pre-admission packages.
        if (record.name === "postgis" || record.name === "pgrouting") record.windowsBinarySources = [];
      }
    }
    return sortRecords([...byName.values()]);
  }
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
    if (r.decision === "wave-2") return "Wave 2 #" + r.order + " / 第2弾 #" + r.order + (record.status === "implemented" ? " — selection history (now distributed) / 選定履歴（現在は配布中）" : "");
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
    if (record.roadmap !== undefined && (!validateRoadmap(record.roadmap) ||
      (record.status !== "candidate" && !(record.status === "implemented" && record.roadmap.decision === "wave-2")))) {
      return {valid:false,reason:"Invalid roadmap for distribution status"};
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
    if (options.status && !(record.distributions || [record.status]).includes(options.status)) return false;
    if (options.sourceType && !record.windowsBinarySources.some(s => s.type === options.sourceType)) return false;
    return !q || [record.name,record.displayName,record.description,record.upstreamRepository,
      record.reason,record.candidateRationale,record.notPlannedReason,record.notPlannedReasonJa,
      record.roadmap?.rationale,record.roadmap?.decision,
      ...record.windowsBinarySources.flatMap(s => [s.provider, s.notes]),
      ...Object.values(record.packages || {}).flatMap(packages => packages.map(pkg => pkg.sourceRepo))]
      .filter(Boolean).some(value => value.toLowerCase().includes(q) ||
        options.translate?.(value).toLowerCase().includes(q));
  }
  function filterRecords(records, options) {
    return (Array.isArray(records) ? records : []).filter(x => matches(x, options));
  }
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
  async function loadPackages(fetcher, base, path) {
    const response = await fetcher(base + "/" + path, {cache:"no-store"});
    if (!response.ok) throw new Error("External catalog HTTP " + response.status);
    const {records} = await response.json();
    if (!Array.isArray(records)) throw new Error("External catalog records unavailable");
    return records;
  }
  return {safeHttpsUrl,validDate,validateIndex,validateRecord,validateRoadmap,roadmapLabel,sortRecords,partitionResults,filterRecords,sourceLabel,
    distributionLabels,packageRoutes,browseRecords,typeLabels,accessLabels,targetLabels,compatibilityLabels,load,loadPackages};
});
