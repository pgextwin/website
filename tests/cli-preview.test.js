import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sha = '3567e34cf9f7347cfab7a1292f58965b7bd15e2d8a2bb5b1f0479685633862a0';
const source = '594df3d703d983d5978b640a03c64d498765035a';

for (const locale of ['en', 'ja']) {
  test('CLI preview ' + locale + ' guide and independent provenance', () => {
    const page = readFileSync(new URL('../' + locale + '/cli.html', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
    assert.match(page, new RegExp('<html lang="' + locale + '"'));
    assert.ok(page.includes('cli-v0.2.2'));
    assert.ok(page.includes(sha));
    assert.ok(page.includes(source));
    assert.ok(page.includes('--signer-workflow pgextwin/catalog/.github/workflows/cli-candidate.yml'));
    assert.ok(page.includes('--source-ref refs/heads/main'));
    assert.ok(page.includes('UNVERIFIED'));
    assert.ok(page.includes('INTEGRITY_ONLY'));
    assert.ok(page.includes('download-all'));
    assert.ok(page.includes('\\pgextwin.exe download-all --pg all'));
    assert.ok(page.includes('INTEGRITY_ONLY'));
    assert.ok(page.includes('--pg all'));
    assert.ok(!page.includes('install --apply'));
    assert.ok(home.includes('href="./cli.html"'));
  });
}
