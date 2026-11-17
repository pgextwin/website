const assert = require("node:assert/strict");
const {test} = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {pathToFileURL} = require("node:url");

const workflow = readFileSync(join(__dirname, "..", ".github", "workflows", "pages-smoke.yml"), "utf8");

test("public Pages audit is available as a cross-repo reusable workflow", () => {
  assert.match(workflow, /on:\s*\n\s*workflow_call:/);
  assert.ok(workflow.includes('repository: ${{ job.workflow_repository }}'));
  assert.ok(workflow.includes('ref: ${{ job.workflow_sha }}'));
  assert.doesNotMatch(workflow, /ref:\s*main\b/);
  assert.match(workflow, /persist-credentials:\s*false/);
});

test("reusable audit keeps the same public-supply-chain and browser checks", () => {
  for (const file of ["verify-published-pages.mjs", "verify-catalog-release.mjs",
                      "verify-fleet-releases.mjs", "verify-published-ui.mjs"]) {
    assert.ok(workflow.includes("node scripts/" + file), file);
  }
  assert.ok(!workflow.includes("pull_request_target"));
  assert.ok(!workflow.includes("contents: write"));
});

const approvedTag = "v1.0.0-windows.1";
const newerTag = "v2.0.0-windows.1";
let auditRun = 0;

async function runFleetAudit(t, mutate = () => {}) {
  // Satisfy the audit's current minimum fleet size; roster policy is outside this tranche.
  const names = Array.from({length: 9}, (_, i) => "example_" + String.fromCharCode(97 + i));
  const responses = new Map();
  const base = "https://raw.githubusercontent.com/pgextwin/catalog/main";
  responses.set(base + "/index.json", {schemaVersion: 2, extensions: names});
  for (const name of names) {
    const repository = "pgextwin/" + name;
    const releaseUrl = "https://github.com/" + repository + "/releases/tag/" + approvedTag;
    const asset = filename => ({
      available: true, asset: filename, sha256: "a".repeat(64),
      downloadUrl: "https://github.com/" + repository + "/releases/download/" + approvedTag + "/" + filename
    });
    const pkg = {...asset(name + ".zip"), evidence: {
      sbom: asset(name + ".spdx.json"),
      vulnerabilityReport: asset(name + ".vulnerabilities.json"),
      buildProvenanceAttestation: {available: true}, sbomAttestation: {available: true}
    }};
    const record = {schemaVersion: 2, name, repository,
      latest: {releaseTag: approvedTag, publishedAt: "2026-11-01T00:00:00Z",
        releaseUrl, checksumsAsset: "SHA256SUMS.txt"}, postgresql: {18: pkg}};
    const release = {tag_name: approvedTag, draft: false, prerelease: false,
      published_at: record.latest.publishedAt, html_url: releaseUrl,
      assets: [{name: "SHA256SUMS.txt"}, ...[pkg, pkg.evidence.sbom, pkg.evidence.vulnerabilityReport]
        .map(x => ({name: x.asset, state: "uploaded", browser_download_url: x.downloadUrl,
          digest: "sha256:" + x.sha256}))]};
    mutate(record, release);
    responses.set(base + "/extensions/" + name + ".json", record);
    const api = "https://api.github.com/repos/" + repository + "/releases/";
    responses.set(api + "tags/" + approvedTag, release);
    // A newer public Release exists, but has not been approved by the Catalog.
    responses.set(api + "latest", {...release, tag_name: newerTag,
      published_at: "2026-11-02T00:00:00Z"});
  }
  t.mock.method(globalThis, "fetch", async url => {
    if (!responses.has(url)) throw new Error("Unexpected audit request: " + url);
    return {status: 200, json: async () => structuredClone(responses.get(url))};
  });
  const output = [];
  t.mock.method(console, "log", value => output.push(JSON.parse(value)));
  // Execute the real, unchanged audit with offline HTTP fixtures, including its main().
  const script = pathToFileURL(join(__dirname, "..", "scripts", "verify-fleet-releases.mjs"));
  await import(script.href + "?testRun=" + auditRun++);
  assert.equal(output.length, 1);
  return output[0];
}

test("fleet audit selects Catalog-approved tags when newer unapproved Releases exist", async t => {
  const result = await runFleetAudit(t);
  assert.equal(result.status, "PASS");
  assert.equal(result.extensionCount, 9);
  assert.ok(result.results.every(x => x.tag === approvedTag));
  assert.equal(result.zipCount, 9);
  assert.equal(result.sbomCount, 9);
  assert.equal(result.vulnerabilityCount, 9);
});

for (const [label, mutate] of [
  ["a different Release tag", (_, release) => { release.tag_name = newerTag; }],
  ["a draft Release", (_, release) => { release.draft = true; }],
  ["a prerelease", (_, release) => { release.prerelease = true; }],
  ["a different publication date", (_, release) => { release.published_at = "2026-11-02T00:00:00Z"; }],
  ["a different Release URL", (_, release) => { release.html_url += "-other"; }],
  ["an unsafe Catalog tag", record => { record.latest.releaseTag = "../unapproved"; }],
  ["missing checksums", (_, release) => { release.assets.shift(); }],
  ["a missing ZIP", (_, release) => { release.assets.splice(1, 1); }],
  ["an incomplete upload", (_, release) => { release.assets[1].state = "new"; }],
  ["a different asset URL", (_, release) => { release.assets[1].browser_download_url += "-other"; }],
  ["a different asset digest", (_, release) => { release.assets[1].digest = "sha256:" + "b".repeat(64); }],
  ["duplicate assets", (_, release) => { release.assets.push(release.assets[1]); }]
]) {
  test("fleet audit rejects " + label, async t => {
    await assert.rejects(() => runFleetAudit(t, mutate), {name: "AssertionError"});
  });
}
