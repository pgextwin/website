#!/usr/bin/env node
// Step 21 public HTTP + SHA audit. Separate from the real-browser UX smoke.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";

const base="https://raw.githubusercontent.com/pgextwin/catalog/main";
const root="https://pgextwin.github.io/website/";
const site=root+"en/";
const extension="plpgsql_check";

async function get(url) {
  const response=await fetch(url,{headers:{"Cache-Control":"no-cache"},
    signal:AbortSignal.timeout(40000)});
  assert.equal(response.status,200,"Public HTTP check failed: "+url+" status="+response.status);
  return response;
}
async function json(url) {return (await get(url)).json();}
async function sha(url) {
  const bytes=Buffer.from(await (await get(url)).arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex");
}
async function audit() {
  const [index,rec,landscape,html,app] = await Promise.all([
    json(base+"/index.json"),
    json(base+"/extensions/"+extension+".json"),
    json(base+"/landscape/extensions/"+extension+".json"),
    get(site).then(r=>r.text()),
    get(root+"app.js").then(r=>r.text())
  ]);
  assert.equal(index.schemaVersion,2);
  assert.equal(index.extensions.length,9,"unexpected current Catalog count");
  assert.ok(index.extensions.includes(extension));
  assert.equal(rec.schemaVersion,2);
  assert.equal(rec.name,extension);
  assert.equal(landscape.status,"implemented");
  assert.equal(landscape.pgextwinCatalogName,extension);
  assert.ok(html.includes('id="extensions"') && html.includes('id="pg-filter"'));
  assert.ok(app.includes(base) && app.includes("capabilitiesSource"),
    "Website no longer loads Catalog as the distribution source");

  const release=await json("https://api.github.com/repos/pgextwin/plpgsql_check/releases/tags/"
    +encodeURIComponent(rec.latest.releaseTag));
  assert.equal(release.tag_name,rec.latest.releaseTag);
  assert.equal(release.draft,false);
  assert.equal(release.prerelease,false);
  assert.equal(release.published_at,rec.latest.publishedAt);
  assert.equal(rec.latest.releaseUrl,release.html_url);
  const assets=new Map(release.assets.map(x=>[x.name,x]));
  const checksums=await (await get(
    "https://github.com/pgextwin/plpgsql_check/releases/download/"
      +encodeURIComponent(rec.latest.releaseTag)+"/SHA256SUMS.txt")).text();
  const listed=new Map(checksums.trim().split("\n").map(line=>{
    const match=/^([a-f0-9]{64})  (?:\.\/)?([A-Za-z0-9_.-]+)$/.exec(line.trim());
    assert.ok(match,"invalid SHA256SUMS entry");
    return [match[2],match[1]];
  }));
  const expectedMajors=["15","16","17","18"];
  assert.deepEqual(Object.keys(rec.postgresql).sort(),expectedMajors);
  const names=[];
  for (const major of expectedMajors) {
    const pkg=rec.postgresql[major];
    assert.equal(pkg.available,true);
    assert.match(pkg.sha256,/^[a-f0-9]{64}$/);
    assert.ok(pkg.downloadUrl.startsWith("https://github.com/pgextwin/plpgsql_check/releases/download/"));
    const evidence=pkg.evidence;
    assert.equal(evidence.buildProvenanceAttestation.available,true);
    assert.equal(evidence.sbomAttestation.available,true);
    for (const entry of [
      {asset:pkg.asset,downloadUrl:pkg.downloadUrl,sha256:pkg.sha256},
      evidence.sbom,evidence.vulnerabilityReport
    ]) {
      assert.equal(entry.available ?? true,true);
      assert.equal(assets.has(entry.asset),true,"Catalog asset missing from public Release");
      assert.equal(listed.get(entry.asset),entry.sha256,
        "Catalog digest differs from published SHA256SUMS");
      assert.equal(await sha(entry.downloadUrl),entry.sha256,"HTTP bytes SHA mismatch");
      names.push(entry.asset);
    }
    assert.deepEqual(Object.keys(rec.capabilities.coverage).sort(),
      ["backgroundWorker","clientExecutable","createExtension","serverLogAssertions","upgrade"].sort());
  }
  assert.deepEqual([...listed.keys()].sort(),names.sort(),"Release contains different major assets");
  assert.equal(rec.capabilities.testContractVersion,2);
  assert.match(rec.capabilitiesSource.commit,/^[a-f0-9]{40}$/);
  const tc=await json("https://raw.githubusercontent.com/"+rec.capabilitiesSource.repository+"/"
    +rec.capabilitiesSource.commit+"/"+rec.capabilitiesSource.path);
  assert.deepEqual(rec.runtime.requirements,tc.runtimeRequirements);
  assert.deepEqual(rec.capabilities.coverage,tc.coverage);
  assert.deepEqual(rec.capabilities.functionalScenarios,tc.functionalScenarios);
  console.log(JSON.stringify({status:"PASS",site,extension,releaseTag:rec.latest.releaseTag,
    majors:expectedMajors,bytesVerifiedAssets:names.length,catalogSource:"main",
    signedAvailabilityReported:true,landscapeStatus:landscape.status}));
}
await audit();
