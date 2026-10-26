const assert = require("node:assert/strict");
const {test} = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");

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

test("fleet parity checks each authorized Catalog tag without admitting a newer denied Release", () => {
  const script = readFileSync(join(__dirname, "..", "scripts", "verify-fleet-releases.mjs"), "utf8");
  assert.ok(script.includes(' + '"/releases/tags/"' + '));
  assert.ok(!script.includes(' + '"/releases/latest"' + '));
  assert.ok(script.includes("record.latest.releaseTag"));
  assert.ok(script.includes("encodeURIComponent(tag)"));
  assert.ok(script.includes("assert.equal(release.tag_name, tag"));
  assert.ok(script.includes("assert.equal(release.draft, false)"));
  assert.ok(script.includes("assert.equal(release.prerelease, false)"));
  assert.ok(script.includes("assert.equal(release.published_at, record.latest.publishedAt)"));
  assert.ok(script.includes("SHA256SUMS.txt"));
  assert.ok(script.includes("mustMatchAsset(assets, record"));
});
