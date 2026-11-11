import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cliVersion,cliExeSha,cliExeBytes,verifyPublishedCli} from '../scripts/published-cli-contract.mjs';

const directExe = 'https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/pgextwin.exe';
for (const lang of ['en','ja']) {
  test('CLI v' + cliVersion + ' ' + lang + ' describes official EXE and all public download choices', () => {
    const page = readFileSync(new URL('../' + lang + '/cli.html', import.meta.url), 'utf8');
    const home = readFileSync(new URL('../' + lang + '/index.html', import.meta.url), 'utf8');
    verifyPublishedCli(page, home, lang);
    assert.ok(page.includes(directExe) && home.includes(directExe));
    assert.ok(page.includes(cliExeSha) && page.includes(cliExeBytes.toLocaleString('en-US')));
    assert.ok(page.includes('download-all --source external --pg 18'));
    assert.ok(page.includes('--extension pgvector --version 0.8.7 --pg 18'));
    assert.ok(page.includes('download-all --pg all'));
    assert.ok(page.includes('download-all --pg all --fixed'));
    assert.ok(page.includes('download-all --source external --verbose'));
    assert.ok(page.includes('href="./"'));
    assert.ok(home.includes('href="./cli.html"'));
    assert.ok(page.includes(lang === 'ja' ? 'リリース' : 'Release'));
  });
}
