const assert = require("node:assert/strict");
const {test} = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {selectLanguage,createLocale} = require("../locale.js");
test("only Japanese primary locales route to Japanese",()=>{
  for(const locale of ["ja","ja-JP","ja_JP","JA-jp"]) assert.equal(selectLanguage(locale),"ja");
  for(const locale of ["en","en-US","fr-FR","zh-CN","ko-KR","de","",null]) assert.equal(selectLanguage(locale),"en");
});
test("localized runtime and content are genuinely separate",()=>{
 const ja=createLocale("ja"),en=createLocale("en");
 assert.equal(ja.t("Download ZIP"),"ZIPをダウンロード");
 assert.equal(en.t("Download ZIP"),"Download ZIP");
 assert.equal(ja.t("Not planned in pgextwin / 他の配布元を案内"),"他の配布元を案内");
 assert.equal(en.t("Not planned in pgextwin / 他の配布元を案内"),"Not planned in pgextwin");
 assert.match(ja.t("10 of 20 Landscape entries shown."),/20件中10件/);
 assert.match(ja.t("PostgreSQL 15–18 only"),/のみ/);
 assert.match(ja.t("2026-10-09 (recheck before use)"),/再確認/);
 assert.match(ja.t("Static analysis and diagnostic checks for PL/pgSQL functions."),/静的解析/);
 assert.match(ja.t("Create a hypothetical index in the same backend, verify EXPLAIN changes from Seq Scan to Index Scan with no physical index, and verify reset restores the baseline."),/仮想インデックス/);
 assert.match(ja.t("Start a logical slot with wal2json format-version 1, commit INSERT, UPDATE and DELETE, decode JSON, assert all three change kinds, and clean up the slot."),/論理レプリケーションスロット/);
});
test("Wave 3 release descriptions, functional scenarios and BGW limitation are localized",()=>{
  const ja=createLocale("ja"), en=createLocale("en");
  const cases=[
    ["Time-based and ID-based partition maintenance; SQL-only (BGW excluded).","BGW"],
    ["Oracle-compatible functions and packages for community PostgreSQL.","Oracle"],
    ["Time-bucketed query statistics for PostgreSQL.","クエリ統計"],
    ["Validate Oracle last_day leap-year date handling","うるう年"],
    ["Confirm preloaded monitor records a real query in query-time buckets","時間区間"],
    ["Independently verified signed Windows x64 PG14-18 release. SQL-only: optional BGW is not included.","BGW"]
  ];
  for(const [original,word] of cases){
    assert.notEqual(ja.t(original),original);
    assert.ok(ja.t(original).includes(word));
    assert.equal(en.t(original),original);
  }
});
test("each route has a language switch and shared data scripts",()=>{
 const root=readFileSync(join(__dirname,"..","index.html"),"utf8");
 assert.match(root,/navigator\.languages/);
 assert.match(root,/window\.location\.replace/);
 for(const language of ["ja","en"]){
  const html=readFileSync(join(__dirname,"..",language,"index.html"),"utf8");
  assert.ok(html.includes('<html lang="'+language+'">'));
  assert.ok(html.includes('href="../ja/"'));
  assert.ok(html.includes('href="../en/"'));
  for(const src of ["../locale.js","../app.js","../landscape-app.js","../catalog-view.js","../landscape-view.js"]) assert.ok(html.includes('src="'+src+'"'));
  assert.ok(html.includes('href="../styles.css"'));
  assert.ok(!html.includes('src="../../'));
  assert.ok(html.includes('href="https://pgextwin.github.io/website/'+language+'/"'));
 }
});
