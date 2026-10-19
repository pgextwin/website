import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const exeSha = 'd4e8f63d402066b21db9d537f7679b51137ec47d9834fa4fd75b5889ad34e6f4';
const originalSource = 'a537f14f39be4b4ffc366cd0fef83f87aa4b9c39';
const directExe = 'https://github.com/pgextwin/catalog/releases/download/cli-v0.3.2/pgextwin.exe';

for (const lang of ['en','ja']) {
  test('CLI v0.3.2 ' + lang + ' feature diagram and signed release identity', () => {
    const page = readFileSync(new URL('../' + lang + '/cli.html', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../' + lang + '/index.html', import.meta.url), 'utf8');
    assert.ok(page.includes('<html lang="' + lang + '">'));
    assert.ok(page.includes(directExe));
    assert.ok(home.includes(directExe) && home.includes('href="./cli.html"'));
    assert.ok(page.includes(exeSha) && page.includes(originalSource));
    assert.ok(page.includes('--signer-workflow pgextwin/catalog/.github/workflows/cli-candidate.yml'));
    assert.ok(page.includes('--source-ref refs/heads/main'));
    assert.ok(page.includes('cli-flow-steps') && page.includes('cli-paths'));
    assert.ok(page.includes('SIGSTORE VERIFIED') && page.includes('INTEGRITY_ONLY'));
    assert.ok(page.includes('UNVERIFIED'));
    assert.ok(page.includes('DOWNLOAD-INFO.json'));
    assert.ok(page.includes('download-all --pg all --fixed'));
    assert.ok(page.includes('download-all --pg all'));
    assert.ok(page.includes('download-all --pg 18'));
    assert.ok(page.includes('download-all --pg all --verbose'));
    assert.ok(page.includes('download-verbose.log'));
    assert.ok(page.includes('verbose-heading'));
    assert.ok(page.includes('39342699236'));
    assert.ok(page.includes('83.83%'));
    assert.ok(page.includes('12,829,662'));
    assert.ok(home.includes('83.83%') && home.includes('CLI v0.3.2'));
    assert.ok(!page.includes('cli-v0.2.2'));
    assert.ok(!home.includes('CLI v0.2.2'));
    assert.ok(!page.includes('install --apply'));
    assert.ok(!page.includes('signatureVerified=true'));
    assert.ok(page.includes('<article lang="' + lang + '" class="cli-note-block"'),
              'Website release details must match its page language');
    assert.ok(!page.includes('<article lang="' + (lang === 'en' ? 'ja' : 'en') + '" class="cli-note-block"'),
              'Website must not duplicate the other locale release details');
    assert.ok(page.includes(lang === 'en' ? 'Release notes' : 'リリースノート'));
  });
}
