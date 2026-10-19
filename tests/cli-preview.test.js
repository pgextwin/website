import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sha = '78de25e4ac3b8d40ba173f3369a12cf92e97ee0e2a65695820390231e3d08aca';
const source = '79db0018cd930847330c024770328892eb46cf3c';

for (const locale of ['en', 'ja']) {
  test('CLI preview ' + locale + ' guide and independent provenance', () => {
    const page = readFileSync(new URL('../' + locale + '/cli.html', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
    assert.match(page, new RegExp('<html lang="' + locale + '"'));
    assert.ok(page.includes('cli-v0.2.1'));
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
