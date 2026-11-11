import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPublishedCli,cliVersion,cliExeSha,cliExeBytes} from '../scripts/published-cli-contract.mjs';

for (const locale of ['en','ja']) {
  const page = readFileSync(new URL('../' + locale + '/cli.html', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
  test('Published ' + locale + ' CLI contract accepts stable v' + cliVersion, () => {
    verifyPublishedCli(page, home, locale);
  });
  test('Published ' + locale + ' CLI contract rejects old identity, missing commands and private wording', () => {
    const opposite = locale === 'en' ? 'ja' : 'en';
    const corruptions = [
      [page.replaceAll('cli-v' + cliVersion, 'cli-v0.3.8'), home],
      [page.replaceAll(cliExeSha, '0'.repeat(64)), home],
      [page.replace(cliExeBytes.toLocaleString('en-US'), '12,892,708'), home],
      [page.replaceAll('download-all --source external', 'download-all --source unknown'), home],
      [page.replace('--extension pgvector', '--extension unknown'), home],
      [page.replace('--version 0.8.7', '--version 0.0.0'), home],
      [page.replace('download-all --pg all --fixed', 'download-all --pg all'), home],
      [page.replace('--verbose', '--quiet'), home],
      [page + '<p>DOWNLOAD_DENY</p>', home],
      [page + '<p>Sigstore</p>', home],
      [page + '<p>verify-external-all</p>', home],
      [page + '<article lang="' + opposite + '" class="cli-note-block">', home],
      [page, home.replaceAll('Windows CLI · v' + cliVersion, 'Windows CLI · v0.3.8')],
      [page, home + '<p>SBOM</p>'],
      [page, home.replace('id="landscape-grid"', 'id="removed-grid"')]
    ];
    for (const [p, h] of corruptions) assert.throws(() => verifyPublishedCli(p, h, locale));
  });
}
