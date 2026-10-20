import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPublishedCli, cliVersion, cliExeSha} from '../scripts/published-cli-contract.mjs';

for (const locale of ['en', 'ja']) {
  const page = readFileSync(new URL('../' + locale + '/cli.html', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
  test('Published ' + locale + ' CLI contract accepts current full served-page fixtures', () => {
    verifyPublishedCli(page, home, locale);
  });
  test('Published ' + locale + ' CLI contract rejects stale tag/hash/label, missing verbose and mixed locales', () => {
    const opposite = locale === 'en' ? 'ja' : 'en';
    const changes = [
      [page.replaceAll('cli-v' + cliVersion, 'cli-v0.3.1'), home],
      [page.replaceAll(cliExeSha, '0'.repeat(64)), home],
      [page.replaceAll('GitHub Release v' + cliVersion, 'GitHub Release v0.3.1'), home],
      [page.replaceAll('download-all --pg all --verbose', 'download-all --pg all'), home],
      [page.replaceAll('download-verbose.log', 'none.log'), home],
      [page + '<article lang="' + opposite + '" class="cli-note-block">', home],
      [page, home.replaceAll('Windows CLI · v' + cliVersion, 'Windows CLI · v0.3.1')]
    ];
    for (const [modified, modifiedHome] of changes) {
      assert.throws(() => verifyPublishedCli(modified, modifiedHome, locale));
    }
  });
}
