import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sha = '1764d2f5a54b9fa715a2bba1d068493ef1d5dcb159b895e3f24becf2dee6fdc0';
const source = '529718ac8ff829c8a98b57d26adb1d74971588c1';

for (const locale of ['en', 'ja']) {
  test('CLI preview ' + locale + ' guide and independent provenance', () => {
    const page = readFileSync(new URL('../' + locale + '/cli.html', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
    assert.match(page, new RegExp('<html lang="' + locale + '"'));
    assert.ok(page.includes('cli-v0.2.0'));
    assert.ok(page.includes(sha));
    assert.ok(page.includes(source));
    assert.ok(page.includes('--signer-workflow pgextwin/catalog/.github/workflows/cli-candidate.yml'));
    assert.ok(page.includes('--source-ref refs/heads/main'));
    assert.ok(page.includes('UNVERIFIED'));
    assert.ok(page.includes('INTEGRITY_ONLY'));
    assert.ok(page.includes('download-all'));
    assert.ok(page.includes('--pg all'));
    assert.ok(!page.includes('install --apply'));
    assert.ok(home.includes('href="./cli.html"'));
  });
}
