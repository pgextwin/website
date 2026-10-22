import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {cliVersion,cliExeSha as exeSha,cliSource as originalSource,cliExeBytes,cliAcceptanceRun} from '../scripts/published-cli-contract.mjs';
const directExe = 'https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/pgextwin.exe';

for (const lang of ['en','ja']) {
  test('CLI v' + cliVersion + ' ' + lang + ' feature diagram and signed release identity', () => {
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
    assert.ok(page.includes(cliAcceptanceRun));
    assert.ok(page.includes('83.83%'));
    assert.ok(page.includes(cliExeBytes.toLocaleString('en-US')));
    assert.ok(home.includes('83.83%') && home.includes('CLI v' + cliVersion));
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
