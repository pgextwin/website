import assert from 'node:assert/strict';

// Public CLI Release 437323712, EXE asset 719567215; source and public
// Windows runtime verified by Run 42337357425.
export const cliVersion = '0.3.6';
export const cliExeSha = '88fe6c95205e5b98790e98b5a083cced9564de5d42d422df5b2f80f2b86efe9d';

export const cliSource = 'c8d5de5b44535b9f21b4b8fd5ea86a4c33da1baa';
export const cliExeBytes = 12883093;
export const cliAcceptanceRun = '42337357425';

export function verifyPublishedCli(page, home, locale) {
  assert.ok(['en', 'ja'].includes(locale), 'Unknown CLI page language');
  assert.ok(page.includes('<html lang="' + locale + '">') &&
    page.includes('cli-v' + cliVersion) && page.includes(cliExeSha) && page.includes(cliSource) &&
    page.includes('GitHub Release v' + cliVersion) &&
    page.includes('cli-flow-steps') && page.includes('SIGSTORE VERIFIED') &&
    page.includes('INTEGRITY_ONLY') && page.includes('verify-external-all') &&
    page.includes('DOWNLOAD_DENY') && page.includes('download-all --pg all --fixed') &&
    page.includes('download-all --pg all --verbose') && page.includes('download-verbose.log') &&
    page.includes('83.83%'), 'Published CLI v' + cliVersion + ' incomplete (' + locale + ')');
  assert.ok(page.includes('<article lang="' + locale + '" class="cli-note-block"') &&
    !page.includes('<article lang="' + (locale === 'en' ? 'ja' : 'en') + '" class="cli-note-block"'),
    "Published Website must show only the page's own locale release notes (" + locale + ')');
  assert.ok(home.includes('CLI v' + cliVersion) &&
    home.includes('Windows CLI · v' + cliVersion) && home.includes('cli-home-teaser') &&
    !home.includes('CLI v0.2.2'), 'Homepage still advertises obsolete CLI (' + locale + ')');
}
