import assert from 'node:assert/strict';
import {elements, hasClass, textContent} from './html-contract.mjs';

export const cliVersion = '0.3.18';
export const cliExeSha = '177d05e24f39efc5327fb6e96444c6c33c0afacac5e89a34432394ddee5faf60';
export const cliExeBytes = 13693197;
const cliExeSize = (Math.floor(cliExeBytes / 10_000) / 100).toFixed(2) + ' MB';

const exe = 'https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/pgextwin.exe';
const sums = 'https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/SHA256SUMS.txt';
const release = 'https://github.com/pgextwin/catalog/releases/tag/cli-v' + cliVersion;
const prohibited = /\b(?:attestation|verify-external-all|DOWNLOAD_DENY|MIRROR_DENY|INTEGRITY_ONLY|UNVERIFIED|Sigstore|SBOM|Grype)\b|--external-(?:admission|bundle)|github\.com\/pgextwin\/(?:build|catalog)\/issues\/|cli-candidate\.yml|source-digest|証明情報|確認用台帳/i;

export function verifyPublishedCli(page, home, locale) {
  assert.ok(['en', 'ja'].includes(locale), 'Unknown CLI locale');
  assert.equal(elements(page, 'html')[0]?.attributes.lang, locale, 'Wrong CLI page language');
  assert.equal(elements(home, 'html')[0]?.attributes.lang, locale, 'Wrong home language');
  for (const [label, html, href] of [
    ['CLI download', page, exe], ['home CLI download', home, exe],
    ['CLI Release', page, release], ['checksum download', page, sums],
    ['back to catalog', page, './'], ['CLI instructions', home, './cli.html']
  ]) assert.ok(elements(html, 'a').some(x => x.attributes.href === href), 'Missing ' + label + ' link (' + locale + ')');
  for (const [label, value] of [
    ['CLI version', 'CLI v' + cliVersion],
    ['CLI executable SHA-256', cliExeSha], ['EXE exact bytes', cliExeBytes.toLocaleString('en-US')],
    ['EXE readable size', cliExeSize],
    ['external all ZIPs', 'download-all --source external'],
    ['external PostgreSQL selection', 'download-all --source external --pg 18'],
    ['extension and version selection', '--extension pgvector --version 0.8.7 --pg 18'],
    ['pgextwin ZIPs', 'download-all --pg all'],
    ['fixed snapshot', 'download-all --pg all --fixed'],
    ['progress option', 'download-all --source external --verbose'],
    ['Windows hash command', 'Get-FileHash .\\pgextwin.exe -Algorithm SHA256'],
    ['ZIP hash command', 'Get-FileHash .\\downloaded-file.zip -Algorithm SHA256']
  ]) assert.ok(page.includes(value), 'Missing ' + label + ' (' + locale + ')');
  for (const value of [
    'CLI v' + cliVersion,
    'download-all --source external', 'cli-home-teaser'
  ]) assert.ok(home.includes(value), 'Missing home content ' + value + ' (' + locale + ')');
  assert.ok(page.includes('oracle_fdw 2.9.0') && page.includes('pgvector 0.8.7') &&
    page.includes('pg_trickle 0.108.3'), 'External ZIP coverage omitted');
  for (const [kind, html] of [['CLI', page], ['home', home]]) {
    assert.ok(!prohibited.test(html), kind + ' exposes internal terminology (' + locale + ')');
  }
  const notes = elements(page, 'article').filter(x => hasClass(x, 'cli-note-block'));
  assert.ok(notes.length > 0, 'Release notes missing');
  assert.ok(notes.every(x => x.attributes.lang === locale), 'Release note language mismatch');
  const steps = elements(page, 'ol').find(x => hasClass(x, 'cli-flow-steps'));
  assert.ok(steps && elements(steps.content, 'li').some(x => textContent(x)), 'CLI usage steps missing');
  const caution = elements(page, 'section').find(x => hasClass(x, 'cli-caution'));
  assert.ok(caution, 'CLI limitations missing');
  const explanations = locale === 'ja'
    ? [/提供元/, /PostgreSQL/, /ライセンス/, /インストール.*行いません/, /設定変更.*行いません/]
    : [/providers?/i, /PostgreSQL/, /licenses?/i, /does not install/i, /change settings/i];
  for (const explanation of explanations) assert.match(textContent(caution), explanation, 'CLI limitation omitted');
  for (const id of ['extensions', 'search', 'pg-filter', 'landscape-grid',
    'landscape-filter', 'landscape-source-filter', 'lifecycle-notice']) {
    assert.ok(home.includes('id="' + id + '"'), 'Dynamic catalog DOM target lost: ' + id);
  }
}
