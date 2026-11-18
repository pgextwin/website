#!/usr/bin/env node
// Public Pages smoke test: validate served HTML/assets and LIVE Landscape records.
// This is intentionally independent of Catalog v2 / Release assets.
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { verifyPublishedCli } from './published-cli-contract.mjs';
import { assertApprovedIndexes, landscapeExpectations } from './published-data-expectations.mjs';
import landscapeView from '../landscape-view.js';

const root = "https://pgextwin.github.io/website/";
const site = root + "en/";
const registry = "https://raw.githubusercontent.com/pgextwin/catalog/main";
async function get(url) {
  const response = await fetch(url, {headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200, `HTTP ${response.status}: ${url}`);
  return response;
}
async function verify() {
  const [html, japanese, entrypoint] = await Promise.all([
    get(site).then(x=>x.text()), get(root+"ja/").then(x=>x.text()), get(root).then(x=>x.text())
  ]);
  assert.ok(entrypoint.includes("navigator.languages"));
  assert.ok(entrypoint.includes('language + "/"'));
  assert.match(html,/<html lang="en">/);
  assert.match(japanese,/<html lang="ja">/);
  assert.ok(japanese.includes("配布中の拡張機能"));
  for (const page of [html,japanese]) {
    assert.ok(page.includes('href="../ja/"') && page.includes('href="../en/"'));
    assert.ok(page.includes('src="../locale.js"'));
    assert.ok(page.includes('hreflang="x-default"'));
    for (const status of Object.keys(landscapeView.distributionLabels)) {
      assert.ok(page.includes(`value="${status}"`), `Missing distribution filter: ${status}`);
    }
  }
  // Verify the current approved public CLI identity and each page's own locale.
  const [cliEnglish,cliJapanese] = await Promise.all([
    get(root+"en/cli.html").then(x=>x.text()),
    get(root+"ja/cli.html").then(x=>x.text())
  ]);
  for (const [page,home,locale] of [
    [cliEnglish,html,"en"],[cliJapanese,japanese,"ja"]
  ]) {
    verifyPublishedCli(page,home,locale);
  }

  assert.equal((await get(root+"locale.js")).status,200);
  for (const phrase of ['id="extensions-heading"','id="landscape-heading"','id="landscape-filter"',
    'id="landscape-source-filter"','id="landscape-search"','landscape-view.js','landscape-app.js',
    'id="pg-filter"','id="extensions"']) {
    assert.ok(html.includes(phrase), `Missing public Pages HTML control: ${phrase}`);
  }
  const [js, app, css, rawIndex, dist] = await Promise.all([
    get(root+"landscape-view.js").then(x=>x.text()),
    get(root+"landscape-app.js").then(x=>x.text()),
    get(root+"styles.css").then(x=>x.text()),
    get(registry+"/landscape/index.json").then(x=>x.json()),
    get(registry+"/index.json").then(x=>x.json())
  ]);
  assert.ok(js.includes("partitionResults") && js.includes("filterRecords"),"Published Landscape logic missing");
  assert.ok(app.includes("landscape-status") && app.includes("External Windows binary sources"),"Published Landscape rendering missing");
  assert.ok(css.includes(".landscape-filters") && css.includes("@media"),"Published responsive Landscape styles missing");
  assertApprovedIndexes(dist, rawIndex);
  const records = await Promise.all(rawIndex.extensions.map(async name => {
    const data = await (await get(registry+"/landscape/extensions/"+encodeURIComponent(name)+".json")).json();
    assert.equal(data.name,name);
    assert.ok(Array.isArray(data.evidenceUrls));
    if (data.status === "implemented") assert.equal(data.pgextwinCatalogName,name);
    if (data.status === "candidate") assert.ok(data.candidateRationale);
    if (data.status === "not-planned") {
      assert.ok(data.notPlannedReason);
      assert.ok(data.windowsBinarySources.length);
    }
    for (const source of data.windowsBinarySources) {
      assert.ok(source.url.startsWith("https://"),name+": non-HTTPS external URL");
      assert.ok(source.type && source.availability && source.compatibility && source.postgresqlDistribution);
    }
    return data;
  }));
  const {counts} = landscapeExpectations(dist, rawIndex, records);
  assert.ok(js.includes("roadmapLabel") && js.includes("sortRecords"));
  assert.ok(app.includes("Selection rationale") && app.includes("landscape-roadmap-label"));
  console.log(JSON.stringify({result:"PASS",liveSite:site,liveHtml:true,liveJs:true,responsiveCss:true,
    catalogSchema:dist.schemaVersion,landscapeSchema:rawIndex.schemaVersion,count:records.length,counts}));
}
let lastError;
for (let attempt=1;attempt<=15;attempt++) {
  try { await verify();process.exit(0); }
  catch(error) {
    lastError=error;console.error(`Public Pages verification ${attempt}/15: ${error.message}`);
    if (attempt<15) await delay(15000);
  }
}
console.error("Public Pages verification FAILED:",lastError);
process.exit(1);
