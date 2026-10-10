#!/usr/bin/env node
// Fleet-wide public Catalog/Release asset parity audit.
// Existing verify-catalog-release.mjs performs full-byte verification for the signed pilot.
import assert from "node:assert/strict";

const base = "https://raw.githubusercontent.com/pgextwin/catalog/main";
async function json(url) {
  const headers = {"Cache-Control": "no-cache", "User-Agent": "pgextwin-website-fleet-audit"};
  if (new URL(url).hostname === "api.github.com" && process.env.GITHUB_TOKEN) {
    headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(40000)
  });
  assert.equal(response.status, 200, "HTTP audit failed: " + url + " (" + response.status + ")");
  return response.json();
}
function mustMatchAsset(assets, record, asset) {
  assert.ok(asset && typeof asset.asset === "string" && /^[a-f0-9]{64}$/.test(asset.sha256),
    "Catalog asset or digest invalid for " + record.name);
  const released = assets.get(asset.asset);
  assert.ok(released, "Published asset missing: " + record.name + "/" + asset.asset);
  assert.equal(released.state, "uploaded");
  assert.equal(released.browser_download_url, asset.downloadUrl, "Published asset URL mismatch");
  assert.equal(released.digest, "sha256:" + asset.sha256, "GitHub asset digest mismatch");
}
async function verify(name) {
  const record = await json(base + "/extensions/" + encodeURIComponent(name) + ".json");
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.name, name);
  assert.equal(record.repository, "pgextwin/" + name);
  const release = await json("https://api.github.com/repos/" + record.repository + "/releases/latest");
  assert.equal(release.tag_name, record.latest.releaseTag, "Stale Catalog release for " + name);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  assert.equal(release.published_at, record.latest.publishedAt);
  assert.equal(release.html_url, record.latest.releaseUrl);
  const assets = new Map(release.assets.map(x => [x.name, x]));
  assert.equal(assets.size, release.assets.length, "Duplicate Release asset");
  assert.ok(assets.has("SHA256SUMS.txt"), "Release checksums missing");
  assert.equal(record.latest.checksumsAsset, "SHA256SUMS.txt");
  const expected = new Set(["SHA256SUMS.txt"]);
  let zipCount = 0;
  let sbomCount = 0;
  let grypeCount = 0;
  for (const [major, pkg] of Object.entries(record.postgresql)) {
    if (!pkg.available) continue;
    assert.match(major, /^(1[4-9]|2[0-9])$/, "Invalid PostgreSQL major");
    mustMatchAsset(assets, record, pkg);
    expected.add(pkg.asset);
    zipCount++;
    const evidence = pkg.evidence;
    assert.ok(evidence, "Evidence state missing");
    for (const [field, suffix] of [["sbom", ".spdx.json"], ["vulnerabilityReport", ".vulnerabilities.json"]]) {
      const item = evidence[field];
      assert.equal(typeof item?.available, "boolean", "Unknown evidence availability");
      const assetName = pkg.asset.replace(/\.zip$/, suffix);
      if (item.available) {
        assert.equal(item.asset, assetName, "Unexpected evidence filename");
        mustMatchAsset(assets, record, item);
        expected.add(item.asset);
        if (field === "sbom") sbomCount++;
        else grypeCount++;
      } else {
        assert.equal(assets.has(assetName), false, "Published evidence absent from Catalog");
      }
    }
    assert.equal(evidence.buildProvenanceAttestation?.available, true,
      "Latest Release lacks required Build Provenance Attestation");
    assert.equal(evidence.sbomAttestation?.available, true,
      "Latest Release lacks required SBOM Attestation");
    assert.equal(evidence.sbom?.available, true, "Latest Release lacks SPDX SBOM");
    assert.equal(evidence.vulnerabilityReport?.available, true,
      "Latest Release lacks Grype vulnerability report");
    // Release job verifies actual signatures; do not infer cryptographic validity from names.
  }
  assert.deepEqual([...assets.keys()].sort(), [...expected].sort(),
    "Release asset set differs from Catalog (missing or unexpected files)");
  assert.ok(zipCount > 0, "No binary ZIPs for " + name);
  return {name, tag: release.tag_name, zipCount, sbomCount, grypeCount};
}
async function main() {
  const index = await json(base + "/index.json");
  assert.equal(index.schemaVersion, 2);
  assert.ok(index.extensions.length >= 9, "Initial distribution fleet unexpectedly reduced");
  assert.equal(new Set(index.extensions).size, index.extensions.length, "Duplicate Catalog extension");
  // Sequential public requests keep this smoke test inside conservative API rate limits.
  const results = [];
  for (const name of index.extensions) results.push(await verify(name));
  console.log(JSON.stringify({
    status: "PASS", audit: "fleet-release-catalog-parity", extensionCount: results.length,
    zipCount: results.reduce((n, x) => n + x.zipCount, 0),
    sbomCount: results.reduce((n, x) => n + x.sbomCount, 0),
    vulnerabilityCount: results.reduce((n, x) => n + x.grypeCount, 0),
    results
  }));
}
await main();
