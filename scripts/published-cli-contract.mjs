import assert from 'node:assert/strict';

export const cliVersion = '0.3.15';
export const cliExeSha = '2f573a33765c1c0103ac898674b11e849a643f174844c8caeddf15afd64ebb9f';
export const cliExeBytes = 12904699;

const exe = 'https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/pgextwin.exe';
const sums = 'https://github.com/pgextwin/catalog/releases/download/cli-v' + cliVersion + '/SHA256SUMS.txt';
const release = 'https://github.com/pgextwin/catalog/releases/tag/cli-v' + cliVersion;
const prohibited = /\b(?:attestation|verify-external-all|DOWNLOAD_DENY|MIRROR_DENY|INTEGRITY_ONLY|UNVERIFIED|Sigstore|SBOM|Grype)\b|--external-(?:admission|bundle)|github\.com\/pgextwin\/(?:build|catalog)\/issues\/|cli-candidate\.yml|source-digest|証明情報|確認用台帳/i;

export function verifyPublishedCli(page, home, locale) {
  assert.ok(['en', 'ja'].includes(locale), 'Unknown CLI locale');
  assert.ok(page.includes('<html lang="' + locale + '">'), 'Wrong CLI page language');
  assert.ok(home.includes('<html lang="' + locale + '">'), 'Wrong home language');
  for (const [label, value] of [
    ['CLI download URL', exe], ['CLI Release URL', release], ['checksum download URL', sums],
    ['CLI executable SHA-256', cliExeSha], ['EXE exact bytes', cliExeBytes.toLocaleString('en-US')],
    ['EXE readable size', '12.90 MB'],
    ['external all ZIPs', 'download-all --source external'],
    ['single extension flag', '--extension pgvector'],
    ['exact version flag', '--version 0.8.7'],
    ['PostgreSQL version flag', '--pg 18'],
    ['fixed snapshot', 'download-all --pg all --fixed'],
    ['progress option', '--verbose'],
    ['Windows hash command', 'Get-FileHash .\\pgextwin.exe -Algorithm SHA256'],
    ['ZIP hash command', 'Get-FileHash .\\downloaded-file.zip -Algorithm SHA256'],
    ['release notes', '<article lang="' + locale + '" class="cli-note-block"']
  ]) assert.ok(page.includes(value), 'Missing ' + label + ' (' + locale + ')');
  for (const value of [
    exe, 'CLI v' + cliVersion, 'Windows CLI · v' + cliVersion,
    'download-all --source external', 'cli-home-teaser'
  ]) assert.ok(home.includes(value), 'Missing home content ' + value + ' (' + locale + ')');
  assert.ok(page.includes('oracle_fdw 2.9.0') && page.includes('pgvector 0.8.7') &&
    page.includes('pg_trickle 0.108.3'), 'External ZIP coverage omitted');
  for (const [kind, html] of [['CLI', page], ['home', home]]) {
    assert.ok(!prohibited.test(html), kind + ' exposes internal terminology (' + locale + ')');
    assert.ok(!html.includes('v0.3.8') && !html.includes('cli-v0.3.8'), 'Obsolete CLI reference');
  }
  assert.ok(!page.includes('<article lang="' + (locale === 'en' ? 'ja' : 'en') + '" class="cli-note-block"'),
    'Release note language mismatch');
  for (const id of ['extensions', 'search', 'pg-filter', 'landscape-grid',
    'landscape-filter', 'landscape-source-filter', 'lifecycle-notice']) {
    assert.ok(home.includes('id="' + id + '"'), 'Dynamic catalog DOM target lost: ' + id);
  }
}
