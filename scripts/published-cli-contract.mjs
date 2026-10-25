import assert from 'node:assert/strict';

// Public CLI Release 423228906, EXE asset 674428079; source and public
// Windows runtime verified by Run 40174175588.
export const cliVersion = '0.3.5';
export const cliExeSha = 'ee0a0b203d25e054c59999c711c0305f39fb8322a076d00df807cde2a859e327';

export const cliSource = 'ed6c69ca259eee2fb2454d3a1c416cd2766dbb17';
export const cliExeBytes = 12833222;
export const cliAcceptanceRun = '40174175588';

export function verifyPublishedCli(page, home, locale) {
  assert.ok(['en', 'ja'].includes(locale), 'Unknown CLI page language');
  assert.ok(page.includes('<html lang="' + locale + '">') &&
    page.includes('cli-v' + cliVersion) && page.includes(cliExeSha) && page.includes(cliSource) &&
    page.includes('GitHub Release v' + cliVersion) &&
    page.includes('cli-flow-steps') && page.includes('SIGSTORE VERIFIED') &&
    page.includes('INTEGRITY_ONLY') && page.includes('download-all --pg all --fixed') &&
    page.includes('download-all --pg all --verbose') && page.includes('download-verbose.log') &&
    page.includes('83.83%'), 'Published CLI v' + cliVersion + ' incomplete (' + locale + ')');
  assert.ok(page.includes('<article lang="' + locale + '" class="cli-note-block"') &&
    !page.includes('<article lang="' + (locale === 'en' ? 'ja' : 'en') + '" class="cli-note-block"'),
    "Published Website must show only the page's own locale release notes (" + locale + ')');
  assert.ok(home.includes('CLI v' + cliVersion) &&
    home.includes('Windows CLI · v' + cliVersion) && home.includes('cli-home-teaser') &&
    !home.includes('CLI v0.2.2'), 'Homepage still advertises obsolete CLI (' + locale + ')');
}
