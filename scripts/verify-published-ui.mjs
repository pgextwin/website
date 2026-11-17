#!/usr/bin/env node
// Actual published GitHub Pages/browser smoke tests, without npm dependencies.
// Uses the runner's installed Google Chrome and the Chrome DevTools Protocol.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { assertApprovedIndexes, landscapeExpectations, assertApprovedNames } from "./published-data-expectations.mjs";

const site = "https://pgextwin.github.io/website/en/";
const catalogResponse = await fetch("https://raw.githubusercontent.com/pgextwin/catalog/main/index.json", {signal: AbortSignal.timeout(40000)});
assert.equal(catalogResponse.status, 200, "Public Catalog unavailable");
const catalogIndex = await catalogResponse.json();
const landscapeResponse = await fetch("https://raw.githubusercontent.com/pgextwin/catalog/main/landscape/index.json", {signal: AbortSignal.timeout(40000)});
assert.equal(landscapeResponse.status,200,"Public Landscape unavailable");
const landscapeIndex=await landscapeResponse.json();
assertApprovedIndexes(catalogIndex, landscapeIndex);
const catalogCount=catalogIndex.extensions.length;
const landscapeRecords=await Promise.all(landscapeIndex.extensions.map(async name=>{
  const response=await fetch(`https://raw.githubusercontent.com/pgextwin/catalog/main/landscape/extensions/${encodeURIComponent(name)}.json`,{signal:AbortSignal.timeout(40000)});
  assert.equal(response.status,200,`Landscape record unavailable: ${name}`);
  const record=await response.json();
  assert.equal(record.name,name);
  return record;
}));
const landscapeCount=landscapeRecords.length;
const expected=landscapeExpectations(catalogIndex, landscapeIndex, landscapeRecords);
const expectedStatusCounts=expected.counts;
// Keep the existing bilingual ZIP/version/SHA/evidence checks, selecting records
// from the approved index instead of requiring two historical extension names.
// Sequential requests stay bounded by the Catalog index's existing resource cap.
const catalogRecords=[];
for (const name of catalogIndex.extensions) {
  const response=await fetch(`https://raw.githubusercontent.com/pgextwin/catalog/main/extensions/${encodeURIComponent(name)}.json`,
    {signal:AbortSignal.timeout(40000)});
  assert.equal(response.status,200,`Signed Catalog record unavailable: ${name}`);
  const record=await response.json();
  assert.equal(record.name,name);
  // Use the same bounded safe-tag grammar as the fleet audit: approved versions
  // may include a date or prerelease component, not just dotted numbers.
  assert.match(record.latest.releaseTag,/^v[A-Za-z0-9][A-Za-z0-9._-]{0,110}-windows\.[1-9][0-9]*$/);
  assert.ok(Object.values(record.postgresql).some(item=>item.available===true),
    `No verified binaries: ${name}`);
  catalogRecords.push(record);
}
const chromeBin = process.env.CHROME_BIN || "google-chrome";
execFileSync("which", [chromeBin]);
const dir = await mkdtemp(join(tmpdir(), "pgextwin-browser-"));
const chrome = spawn(chromeBin, [
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
  "--remote-debugging-port=0","--remote-allow-origins=*",
  "--no-first-run","--no-default-browser-check","--user-data-dir="+dir,
  "--window-size=1280,800","about:blank"
], {stdio:"ignore"});
let ws;
try {
  let port = null;
  // Cold GitHub runners may need longer than 10s to bring up Chrome/CDP.
  // This is only bounded startup tolerance; every page assertion is unchanged.
  for (let i=0;i<300;i++) {
    try {
      const file = await readFile(join(dir,"DevToolsActivePort"),"utf8");
      port = Number(file.split("\n")[0]);
      if (port > 0) break;
    } catch {}
    if (chrome.exitCode !== null || chrome.signalCode !== null)
      throw new Error("Chrome terminated before opening DevTools (exit=" + chrome.exitCode + ", signal=" + chrome.signalCode + ")");
    await delay(100);
  }
  assert.ok(port,"Chrome DevTools port unavailable");
  const targets = await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
  const tab = targets.find(x=>x.type==="page" && x.webSocketDebuggerUrl);
  assert.ok(tab,"No inspectable browser tab");
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener("open",resolve,{once:true});
    ws.addEventListener("error",reject,{once:true});
  });
  let seq=0;
  const pending=new Map();
  ws.addEventListener("message",event=>{
    const message=JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const {resolve,reject}=pending.get(message.id);
    pending.delete(message.id);
    if(message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  function send(method,params={}) {
    const id=++seq;
    return new Promise((resolve,reject)=>{
      pending.set(id,{resolve,reject});
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression) {
    const out=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
    return out.result.value;
  }
  async function until(condition,what) {
    for(let i=0;i<100;i++) {
      try { if (await evaluate(condition)) return; } catch {}
      await delay(300);
    }
    throw new Error("Browser did not reach: "+what);
  }
  async function assertBilingualAssets(locale, record) {
    const expectedMajors=Object.entries(record.postgresql)
      .filter(([,entry])=>entry.available===true)
      .map(([major])=>Number(major)).sort((a,b)=>a-b);
    // Real, published DOM in Chrome: do not mistake correct JSON for correct visible UI.
    const displayed=await evaluate(`(() => {
      const card=document.getElementById(${JSON.stringify("extension-"+record.name)});
      if (!card) return null;
      const rows=[...card.querySelectorAll(".binary-table tbody tr")].map(row=>({
        major:Number(row.querySelector("th")?.textContent.match(/[0-9]+/)?.[0]),
        asset:row.querySelector("code.asset-name")?.textContent?.trim(),
        zip:row.querySelector("a.download-link")?.href,
        evidenceLinks:[...row.querySelectorAll(".supporting-links a")].map(a=>a.href).sort()
      }));
      const perPg=[...card.querySelectorAll(".pg-version")].map(row=>({
        major:Number(row.querySelector(".pg-version-summary strong")?.textContent.match(/[0-9]+/)?.[0]),
        zip:row.querySelector(".download-row a.download-link")?.href,
        sha256:row.querySelector("code.checksum")?.textContent?.trim(),
        evidenceText:[...row.querySelectorAll(".evidence-list li")].map(li=>li.textContent.trim()),
        evidenceLinks:[...row.querySelectorAll(".evidence-list a")].map(a=>a.href).sort()
      }));
      return {releaseTag:card.querySelector(".summary-release")?.textContent?.trim(),rows,perPg};
    })()`);
    assert.ok(displayed,"Published signed extension card missing ("+locale+")");
    assert.equal(displayed.releaseTag,record.latest.releaseTag,"Stale release shown ("+locale+")");
    assert.deepEqual(displayed.rows.map(r=>r.major).sort((a,b)=>a-b),expectedMajors,
      "Missing PG binary download rows ("+locale+")");
    assert.deepEqual(displayed.perPg.map(r=>r.major).sort((a,b)=>a-b),expectedMajors,
      "Missing per-PG checksum/evidence disclosures ("+locale+")");
    for(const major of expectedMajors) {
      const item=record.postgresql[String(major)];
      const row=displayed.rows.find(r=>r.major===major);
      const pg=displayed.perPg.find(r=>r.major===major);
      const links=[item.evidence.sbom.downloadUrl,item.evidence.vulnerabilityReport.downloadUrl].sort();
      for(const [surface,entry] of [["binary table",row],["expanded PG detail",pg]]) {
        assert.equal(entry.zip,item.downloadUrl,`Wrong ${surface} ZIP URL PG${major} (${locale})`);
        assert.deepEqual(entry.evidenceLinks,links,`Wrong ${surface} SBOM/Grype links PG${major} (${locale})`);
      }
      assert.equal(row.asset,item.asset,`Wrong ZIP filename PG${major} (${locale})`);
      assert.equal(pg.sha256,item.sha256,`Wrong rendered SHA256 PG${major} (${locale})`);
      assert.equal(pg.evidenceText.length,4,`Missing attestation status rows PG${major} (${locale})`);
      assert.equal(item.evidence.buildProvenanceAttestation.available,true);
      assert.equal(item.evidence.sbomAttestation.available,true);
      const yes=locale==="ja"?"あり":"Available";
      assert.ok(pg.evidenceText[0].includes(yes),`Build attestation invisible PG${major} (${locale})`);
      assert.ok(pg.evidenceText[2].includes(yes),`SBOM attestation invisible PG${major} (${locale})`);
    }
    return {locale,extension:record.name,releaseTag:displayed.releaseTag,majors:expectedMajors,
      renderedDirectZipShaSbomGrypeAttestations:true};
  }
  async function assertApprovedCards() {
    assertApprovedNames(await evaluate('[...document.querySelectorAll("#extensions .extension-collapse")].map(card=>card.id.slice("extension-".length))'),
      catalogIndex.extensions,"Published Catalog cards differ from approved index");
    assertApprovedNames(await evaluate('[...document.querySelectorAll("#landscape-grid .landscape-collapse")].map(row=>row.id.slice("landscape-".length))'),
      landscapeIndex.extensions,"Published Landscape cards differ from approved index");
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate",{url:site});
  await until(`document.getElementById("landscape-count")?.textContent.includes("${landscapeCount} of ${landscapeCount}") && document.getElementById("results-count")?.textContent.includes("${catalogCount} of ${catalogCount}")`,
    "public catalog and landscape data loaded");
  assert.equal(await evaluate('document.querySelectorAll("#extensions article").length'),catalogCount);
  assert.equal(await evaluate('document.querySelectorAll("#landscape-grid article").length'),landscapeCount);
  await assertApprovedCards();
  assert.equal(await evaluate('document.querySelectorAll("#extensions details.extension-collapse:not([open])").length'),catalogCount);
  assert.equal(await evaluate('document.querySelectorAll("#landscape-grid details.landscape-collapse:not([open])").length'),landscapeCount);
  const catalogDisclosure = await evaluate(`(() => {
    const rows=[...document.querySelectorAll("#extensions .extension-collapse")];
    rows[0].querySelector("summary").click();
    const hasTable=rows[0].querySelectorAll(".binary-table tbody tr").length>=1;
    const zip=rows[0].querySelector(".binary-table .download-link");
    const validZip=zip && zip.href.startsWith("https://") && zip.href.includes(".zip");
    const second=rows[1];
    if (second) second.querySelector("summary").click();
    return {hasTable,validZip,exclusive:second ? !rows[0].open && second.open : rows[0].open};
  })()`);
  assert.ok(catalogDisclosure.hasTable && catalogDisclosure.validZip && catalogDisclosure.exclusive,
    "Original ZIP table and single-open catalog disclosure");
  const signedReleaseVisuals=[];
  for (const record of catalogRecords) signedReleaseVisuals.push(await assertBilingualAssets("en",record));
  const landscapeDisclosure = await evaluate(`(() => {
    const row=document.querySelector("#landscape-grid .landscape-collapse");
    row.querySelector("summary").click();
    return row.open && !!row.querySelector(".landscape-detail-body");
  })()`);
  assert.ok(landscapeDisclosure,"Landscape details expand on click");
  const counts={};
  for(const [status,expected] of Object.entries(expectedStatusCounts)) {
    counts[status]=await evaluate(`(() => {
      const s=document.getElementById("landscape-filter");
      s.value="${status}";
      s.dispatchEvent(new Event("change",{bubbles:true}));
      return document.querySelectorAll("#landscape-grid article").length;
    })()`);
    assert.equal(counts[status],expected);
  }
  // Compare each record's label and identity, including candidate Wave 2 and
  // decision-pending entries when they are present in the approved registry.
  for (const [status, labels] of [["candidate",expected.candidateLabels],
    ["implemented",expected.implementedLabels]]) {
    const displayed=await evaluate(`(() => {
      const s=document.getElementById("landscape-filter");
      s.value=${JSON.stringify(status)};s.dispatchEvent(new Event("change",{bubbles:true}));
      return [...document.querySelectorAll("#landscape-grid article")].flatMap(card=>{
        const label=card.querySelector(".landscape-roadmap-label");
        return label ? [{name:card.querySelector(".landscape-collapse").id.slice("landscape-".length),
          label:label.textContent}] : [];
      });
    })()`);
    assert.deepEqual(displayed.sort((a,b)=>a.name.localeCompare(b.name)),labels,
      `Published ${status} roadmap labels differ from approved Landscape data`);
  }
  const searchNames=await evaluate(`(() => {
    document.getElementById("landscape-filter").value="";
    document.getElementById("landscape-filter").dispatchEvent(new Event("change",{bubbles:true}));
    const s=document.getElementById("landscape-search");
    s.value=${JSON.stringify(expected.query)};
    s.dispatchEvent(new Event("input",{bubbles:true}));
    return [...document.querySelectorAll("#landscape-grid .landscape-collapse")]
      .map(row=>row.id.slice("landscape-".length));
  })()`);
  assertApprovedNames(searchNames,expected.searchNames,"Landscape search differs from approved records");
  const vendorNames=await evaluate(`(() => {
    const s=document.getElementById("landscape-search");s.value="";s.dispatchEvent(new Event("input",{bubbles:true}));
    const t=document.getElementById("landscape-source-filter");t.value="vendor";t.dispatchEvent(new Event("change",{bubbles:true}));
    return [...document.querySelectorAll("#landscape-grid .landscape-collapse")]
      .map(row=>row.id.slice("landscape-".length));
  })()`);
  assertApprovedNames(vendorNames,expected.vendorNames,"Vendor filter differs from approved records");
  const linkSafety=await evaluate(`(() => {
    document.getElementById("landscape-source-filter").value="";
    document.getElementById("landscape-source-filter").dispatchEvent(new Event("change",{bubbles:true}));
    const urls=[...document.querySelectorAll("#landscape-grid .landscape-sources a")].map(x=>x.href);
    return {urls,allHttps:urls.every(x=>x.startsWith("https://")),
      vendorLabel:document.querySelector("#landscape-grid")?.textContent.includes("Support customers only"),
      condaLabel:document.querySelector("#landscape-grid")?.textContent.includes("Conda PostgreSQL environment")};
  })()`);
  assert.ok(linkSafety.allHttps);
  assertApprovedNames(linkSafety.urls,expected.sourceUrls.map(url=>new URL(url).href),
    "Published source links differ from approved Landscape data");
  assert.equal(linkSafety.vendorLabel,expected.vendorLabel);
  assert.equal(linkSafety.condaLabel,expected.condaLabel);
  await send("Emulation.setDeviceMetricsOverride",{width:375,height:812,deviceScaleFactor:1,mobile:true});
  const mobile=await evaluate(`(() => ({
    width:window.innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    singleColumn:matchMedia("(max-width: 800px)").matches,
    catalogVisible:!!document.getElementById("extensions-heading"),
    landscapeVisible:!!document.getElementById("landscape-heading"),
    inputVisible:!!document.getElementById("landscape-search"),
    focusCss:getComputedStyle(document.getElementById("landscape-search")).display!=="none"
  }))()`);
  assert.ok(mobile.singleColumn && mobile.catalogVisible && mobile.landscapeVisible &&
    mobile.inputVisible && mobile.focusCss);
  assert.ok(mobile.scrollWidth<=mobile.width+2,`Mobile horizontal overflow: ${JSON.stringify(mobile)}`);
  await send("Page.navigate",{url:"https://pgextwin.github.io/website/ja/"});
  await until(`document.getElementById("landscape-count")?.textContent.includes("${landscapeCount}件中${landscapeCount}件") && document.getElementById("results-count")?.textContent.includes("${catalogCount}件中${catalogCount}件")`,
    "Japanese catalog and landscape data loaded");
  assert.equal(await evaluate('document.documentElement.lang'),"ja");
  assert.equal(await evaluate('document.querySelectorAll("#extensions article").length'),catalogCount);
  assert.equal(await evaluate('document.querySelectorAll("#landscape-grid article").length'),landscapeCount);
  await assertApprovedCards();
  assert.ok((await evaluate('document.querySelector("#extensions article")?.textContent'))?.includes("ZIPをダウンロード"));
  assert.equal(await evaluate('document.querySelector("nav.language-nav [aria-current=page]")?.getAttribute("lang")'),"ja");
  assert.ok((await evaluate('document.querySelector("#landscape-grid")?.textContent'))?.includes("配布中"));
  for (const record of catalogRecords) signedReleaseVisuals.push(await assertBilingualAssets("ja",record));
  console.log(JSON.stringify({result:"PASS",site,realBrowser:"Chrome headless",japanesePage:true,catalogCards:catalogCount,
    landscapeCards:landscapeCount,statusFilterCounts:counts,search:true,sourceFilter:true,
    externalHttpsLinks:linkSafety.urls.length,vendorAndCondaLabels:true,mobile,signedReleaseVisuals}));
} finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
