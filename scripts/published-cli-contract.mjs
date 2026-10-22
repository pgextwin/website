import assert from 'node:assert/strict';

// Public CLI Release 420259388, EXE asset 664488215; source and public
// Windows runtime verified by Run 39713885339.
export const cliVersion = '0.3.4';
export const cliExeSha = 'dd6d8fa928da6134efd598677196b896f7f968fdae61f3d72cc40c19dec74fd8';

export const cliSource = 'a6c894c53f5c42333abae7875f1fb5569578c765';
export const cliExeBytes = 12830477;
export const cliAcceptanceRun = '39713885339';

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
