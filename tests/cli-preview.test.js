import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sha = 'c2782f46539bd932c9c19105055e45dcf8796d573a8c30ad9844e6ba510ddfb1';
const source = 'd0056b688dc27095d2d7ffd6f8b77aff965def79';

for (const locale of ['en', 'ja']) {
  test('CLI preview ' + locale + ' guide and independent provenance', () => {
    const page = readFileSync(new URL('../' + locale + '/cli.html', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
    assert.match(page, new RegExp('<html lang="' + locale + '"'));
    assert.ok(page.includes('cli-v0.1.0-preview.1'));
    assert.ok(page.includes(sha));
    assert.ok(page.includes(source));
    assert.ok(page.includes('--signer-workflow pgextwin/catalog/.github/workflows/cli-candidate.yml'));
    assert.ok(page.includes('--source-ref refs/heads/main'));
    assert.ok(page.includes('UNVERIFIED'));
    assert.ok(page.includes('INTEGRITY_ONLY'));
    assert.ok(!page.includes('install --apply'));
    assert.ok(home.includes('href="./cli.html"'));
  });
}
