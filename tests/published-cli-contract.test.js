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
  test('Published ' + locale + ' CLI contract allows presentation changes and historical mentions', () => {
    const restyled = page
      .replace('<html lang="' + locale + '">', "<html class='public-page' lang='" + locale + "'>")
      .replace('<article lang="' + locale + '" class="cli-note-block">',
        "<article class='extra cli-note-block' lang='" + locale + "'>")
      .replace(/<ol class="cli-flow-steps">[\s\S]*?<\/ol>/,
        '<ol class="extra cli-flow-steps"><li>Download the EXE and run a command.</li><li>Verify your ZIP.</li></ol>');
    verifyPublishedCli(restyled + '<p>Previous CLI v0.3.8</p>', home + '<p>Previous CLI v0.3.8</p>', locale);
  });
  test('Published ' + locale + ' CLI contract rejects incorrect identity, missing guidance and private wording', () => {
    const opposite = locale === 'en' ? 'ja' : 'en';
    const corruptions = [
      [page.replaceAll('cli-v' + cliVersion, 'cli-v0.3.8'), home],
      [page.replaceAll('CLI v' + cliVersion, 'CLI v0.0.0'), home],
      // The correct URL still occurs elsewhere: it must also be an actual link.
      [page.replaceAll('href="https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/pgextwin.exe"', 'href="#wrong"'), home],
      [page.replaceAll(cliExeSha, '0'.repeat(64)), home],
      [page.replaceAll(cliExeBytes.toLocaleString('en-US'), '12,892,708'), home],
      [page.replaceAll('download-all --source external', 'download-all --source unknown'), home],
      [page.replace('--extension pgvector', '--extension unknown'), home],
      [page.replace('--version 0.8.7', '--version 0.0.0'), home],
      [page.replace('download-all --pg all --fixed', 'download-all --pg all'), home],
      [page.replace('--verbose', '--quiet'), home],
      [page + '<p>DOWNLOAD_DENY</p>', home],
      [page + '<p>Sigstore</p>', home],
      [page + '<p>verify-external-all</p>', home],
      [page + '<article class="cli-note-block extra" lang="' + opposite + '">Wrong language</article>', home],
      [page.replace(/<ol class="cli-flow-steps">[\s\S]*?<\/ol>/, ''), home],
      [page.replace(/<section class="cli-caution"[\s\S]*?<\/section>/, ''), home],
      [page.replace(locale === 'ja' ? 'ライセンス' : 'licenses', ''), home],
      [page.replace(locale === 'ja' ? 'インストールや設定変更は行いません' : 'does not install extensions or change settings', ''), home],
      [page, home.replaceAll('CLI v' + cliVersion, 'CLI v0.0.0')],
      [page.replaceAll('href="./"', 'href="#wrong"'), home],
      [page, home.replaceAll('href="./cli.html"', 'href="#wrong"')],
      [page, home + '<p>SBOM</p>'],
      [page, home.replace('id="landscape-grid"', 'id="removed-grid"')]
    ];
    for (const [i, [p, h]] of corruptions.entries()) assert.throws(() => verifyPublishedCli(p, h, locale), 'mutation #' + i);
  });
}
