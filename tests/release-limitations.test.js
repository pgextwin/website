const assert = require("node:assert/strict");
const {test} = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");

test("published EN/JA pages disclose release limitations at the footer only", () => {
  const common = "https://github.com/pgextwin/build/issues/75";
  for (const lang of ["en", "ja"]) {
    const html = readFileSync(join(__dirname, "..", lang, "index.html"), "utf8");
    const marker = 'class="release-limitations" role="note"';
    assert.equal(html.split(marker).length - 1, 1);
    const footer = html.slice(html.indexOf('<footer class="site-footer">'));
    assert.ok(footer.includes(marker));
    assert.ok(footer.includes(common));
    assert.ok(footer.includes('aria-labelledby="release-limitations-title"'));
    assert.ok(footer.includes('id="release-limitations-title"'));
    assert.ok(footer.includes('href="../styles.css"') === false);
    if (lang === "ja") {
      assert.match(footer, /現在の運用上の制約/);
      assert.match(footer, /候補ビルドは正式Releaseではありません/);
      assert.match(footer, /完全無人運用はまだ検証できていません/);
    } else {
      assert.match(footer, /Current operational limitations/);
      assert.match(footer, /Candidate builds are not public Releases/);
      assert.match(footer, /fully hands-off Release-to-Catalog flow is not yet verified/);
    }
  }
});
