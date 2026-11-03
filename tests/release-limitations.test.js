const assert = require("node:assert/strict");
const {test} = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");

test("published EN/JA pages show installation cautions in the footer and practical download steps", () => {
  const common = "https://github.com/pgextwin/build/issues/75";
  for (const lang of ["en", "ja"]) {
    const html = readFileSync(join(__dirname, "..", lang, "index.html"), "utf8");
    const marker = 'class="release-limitations" role="note"';
    assert.equal(html.split(marker).length - 1, 1);
    const footer = html.slice(html.indexOf('<footer class="site-footer">'));
    assert.ok(footer.includes(marker));
    assert.ok(footer.includes(common));
    assert.ok(html.includes('class="quickstart-steps"'));
    assert.ok(html.indexOf('id="quickstart-heading"') < html.indexOf('id="extensions-heading"'));
    assert.ok(footer.includes('aria-labelledby="release-limitations-title"'));
    assert.ok(footer.includes('id="release-limitations-title"'));
    assert.ok(footer.includes('href="../styles.css"') === false);
    if (lang === "ja") {
      assert.match(footer, /ご利用前の注意/);
      assert.match(footer, /公開済みの検証済みReleaseのみ/);
      assert.match(footer, /配布物は非公式/);
    } else {
      assert.match(footer, /Before you install/);
      assert.match(footer, /published, verified Release assets/);
      assert.match(footer, /packages are unofficial/);
    }
  }
});
