const assert = require("node:assert/strict");
const {test} = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");

const workflow = readFileSync(join(__dirname, "..", ".github", "workflows", "pages-smoke.yml"), "utf8");

test("public Pages audit is available as a cross-repo reusable workflow", () => {
  assert.match(workflow, /on:\s*\n\s*workflow_call:/);
  assert.match(workflow, /repository:\s*pgextwin\/website/);
  assert.match(workflow, /ref:\s*main/);
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
