#!/usr/bin/env node
// Actual published GitHub Pages/browser smoke tests, without npm dependencies.
// Uses the runner's installed Google Chrome and the Chrome DevTools Protocol.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const site = "https://pgextwin.github.io/website/en/";
const catalogResponse = await fetch("https://raw.githubusercontent.com/pgextwin/catalog/main/index.json", {signal: AbortSignal.timeout(40000)});
assert.equal(catalogResponse.status, 200, "Public Catalog unavailable");
const catalogIndex = await catalogResponse.json();
assert.equal(catalogIndex.schemaVersion, 2);
const catalogCount = catalogIndex.extensions.length;
assert.ok(catalogCount >= 9 && catalogCount <= 14, "Unexpected distribution Catalog size");
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
  for (let i=0;i<100;i++) {
    try {
      const file = await readFile(join(dir,"DevToolsActivePort"),"utf8");
      port = Number(file.split("\n")[0]);
      if (port > 0) break;
    } catch {}
    if (chrome.exitCode !== null) throw new Error("Chrome terminated before opening DevTools");
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
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate",{url:site});
  await until(`document.getElementById("landscape-count")?.textContent.includes("20 of 20") && document.getElementById("results-count")?.textContent.includes("${catalogCount} of ${catalogCount}")`,
    "public catalog and landscape data loaded");
  assert.equal(await evaluate('document.querySelectorAll("#extensions article").length'),catalogCount);
  assert.equal(await evaluate('document.querySelectorAll("#landscape-grid article").length'),20);
  assert.equal(await evaluate('document.querySelectorAll("#extensions details.extension-collapse:not([open])").length'),catalogCount);
  assert.equal(await evaluate('document.querySelectorAll("#landscape-grid details.landscape-collapse:not([open])").length'),20);
  const catalogDisclosure = await evaluate(`(() => {
    const rows=[...document.querySelectorAll("#extensions .extension-collapse")];
    rows[0].querySelector("summary").click();
    const hasTable=rows[0].querySelectorAll(".binary-table tbody tr").length>=1;
    const zip=rows[0].querySelector(".binary-table .download-link");
    const validZip=zip && zip.href.startsWith("https://") && zip.href.includes(".zip");
    rows[1].querySelector("summary").click();
    return {hasTable,validZip,exclusive:!rows[0].open && rows[1].open};
  })()`);
  assert.ok(catalogDisclosure.hasTable && catalogDisclosure.validZip && catalogDisclosure.exclusive,
    "Original ZIP table and single-open catalog disclosure");
  const landscapeDisclosure = await evaluate(`(() => {
    const row=document.querySelector("#landscape-grid .landscape-collapse");
    row.querySelector("summary").click();
    return row.open && !!row.querySelector(".landscape-detail-body");
  })()`);
  assert.ok(landscapeDisclosure,"Landscape details expand on click");
  const counts={};
  for(const [status,expected] of [["implemented",catalogCount],["candidate",14-catalogCount],["not-planned",6]]) {
    counts[status]=await evaluate(`(() => {
      const s=document.getElementById("landscape-filter");
      s.value="${status}";
      s.dispatchEvent(new Event("change",{bubbles:true}));
      return document.querySelectorAll("#landscape-grid article").length;
    })()`);
    assert.equal(counts[status],expected);
  }
  const waveLabels=await evaluate(`(() => {
    const s=document.getElementById("landscape-filter");
    s.value="candidate";s.dispatchEvent(new Event("change",{bubbles:true}));
    return [...document.querySelectorAll("#landscape-grid article")].map(x=>({
      name:x.querySelector("h3")?.textContent,
      label:x.querySelector(".landscape-roadmap-label")?.textContent
    }));
  })()`);
  assert.ok(waveLabels.every(x=>!x.label?.startsWith("Wave 2 #")), "Completed Wave 2 must no longer be a candidate");
  const distributedWaveLabels = await evaluate(`(() => {
    const s=document.getElementById("landscape-filter");
    s.value="implemented"; s.dispatchEvent(new Event("change",{bubbles:true}));
    return [...document.querySelectorAll("#landscape-grid .landscape-roadmap-label")].map(x=>x.textContent);
  })()`);
  assert.equal(distributedWaveLabels.filter(x=>x?.startsWith("Wave 2 #")).length,3,
    "All three Wave 2 selection history labels must remain visible");
  assert.ok(waveLabels.some(x=>x.label?.includes("Reserve candidate")));
  assert.ok(waveLabels.some(x=>x.label?.includes("Further research")));
  assert.equal(await evaluate(`(() => {
    document.getElementById("landscape-filter").value="";
    document.getElementById("landscape-filter").dispatchEvent(new Event("change",{bubbles:true}));
    const s=document.getElementById("landscape-search");
    s.value="oracle_fdw";
    s.dispatchEvent(new Event("input",{bubbles:true}));
    return document.querySelectorAll("#landscape-grid article").length;
  })()`),1);
  assert.ok((await evaluate(`(() => {
    const s=document.getElementById("landscape-search");s.value="";s.dispatchEvent(new Event("input",{bubbles:true}));
    const t=document.getElementById("landscape-source-filter");t.value="vendor";t.dispatchEvent(new Event("change",{bubbles:true}));
    return document.querySelectorAll("#landscape-grid article").length;
  })()`))>=3,"Vendor-only source filter did not find SRA OSS entries");
  const linkSafety=await evaluate(`(() => {
    document.getElementById("landscape-source-filter").value="";
    document.getElementById("landscape-source-filter").dispatchEvent(new Event("change",{bubbles:true}));
    const urls=[...document.querySelectorAll("#landscape-grid .landscape-sources a")].map(x=>x.href);
    return {count:urls.length,allHttps:urls.every(x=>x.startsWith("https://")),
      vendorLabel:document.querySelector("#landscape-grid")?.textContent.includes("Support customers only"),
      condaLabel:document.querySelector("#landscape-grid")?.textContent.includes("Conda PostgreSQL environment")};
  })()`);
  assert.ok(linkSafety.count>=10 && linkSafety.allHttps);
  assert.ok(linkSafety.vendorLabel && linkSafety.condaLabel);
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
  await until(`document.getElementById("landscape-count")?.textContent.includes("20件中20件") && document.getElementById("results-count")?.textContent.includes("${catalogCount}件中${catalogCount}件")`,
    "Japanese catalog and landscape data loaded");
  assert.equal(await evaluate('document.documentElement.lang'),"ja");
  assert.equal(await evaluate('document.querySelectorAll("#extensions article").length'),9);
  assert.equal(await evaluate('document.querySelectorAll("#landscape-grid article").length'),20);
  assert.ok((await evaluate('document.querySelector("#extensions article")?.textContent'))?.includes("ZIPをダウンロード"));
  assert.equal(await evaluate('document.querySelector("nav.language-nav [aria-current=page]")?.getAttribute("lang")'),"ja");
  assert.ok((await evaluate('document.querySelector("#landscape-grid")?.textContent'))?.includes("配布中"));
  console.log(JSON.stringify({result:"PASS",site,realBrowser:"Chrome headless",japanesePage:true,catalogCards:catalogCount,
    landscapeCards:20,statusFilterCounts:counts,search:true,sourceFilter:true,
    externalHttpsLinks:linkSafety.count,vendorAndCondaLabels:true,mobile}));
} finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
