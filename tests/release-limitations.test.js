const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

test('EN/JA public pages show four download steps and clear, non-technical installation cautions', () => {
  for (const lang of ['en', 'ja']) {
    const html = readFileSync(join(__dirname, '..', lang, 'index.html'), 'utf8');
    const footer = html.slice(html.indexOf('<footer class="site-footer">'));
    assert.equal(html.split('class="release-limitations" role="note"').length - 1, 1);
    assert.ok(html.includes('class="quickstart-steps"'));
    const steps = html.match(/<li><strong>[^<]+<\/strong>/g) || [];
    assert.equal(steps.length, 4);
    assert.ok(html.indexOf('id="quickstart-heading"') < html.indexOf('id="extensions-heading"'));
    assert.ok(footer.includes('aria-labelledby="release-limitations-title"'));
    assert.ok(footer.includes('id="release-limitations-title"'));
    assert.ok(!footer.includes('/issues/'));
    assert.ok(!footer.includes('build infrastructure'));
    assert.ok(html.includes('Get-FileHash .\\downloaded-file.zip -Algorithm SHA256'));
    if (lang === 'ja') {
      assert.match(footer, /ご利用前の注意/);
      assert.match(footer, /配布物は非公式/);
      assert.match(html, /探す → 選ぶ → ダウンロード → 照合/);
    } else {
      assert.match(footer, /Before you install/);
      assert.match(footer, /packages are unofficial/);
      assert.match(html, /Find → Choose → Download → Verify/);
    }
  }
});
