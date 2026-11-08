import assert from 'node:assert/strict';

// Public CLI Release 438186482, EXE asset 723667038; source and public
// Windows runtime verified by Run 42474871097.
export const cliVersion = '0.3.8';
export const cliExeSha = 'aecb0537622148b46b731b543ce511ee281877f4e6fbc31c77f8346689ce6077';

export const cliSource = '3ce07983ef0a93069b2b0ba850b9dc970e3f373f';
export const cliExeBytes = 12892708;
export const cliAcceptanceRun = '42474871097';

export function verifyPublishedCli(page, home, locale) {
  assert.ok(['en', 'ja'].includes(locale), 'Unknown CLI page language');
  assert.ok(page.includes('<html lang="' + locale + '">') &&
    page.includes('cli-v' + cliVersion) && page.includes(cliExeSha) && page.includes(cliSource) &&
    page.includes('GitHub Release v' + cliVersion) &&
    page.includes('cli-flow-steps') && page.includes('SIGSTORE VERIFIED') &&
    page.includes('INTEGRITY_ONLY') && page.includes('verify-external-all') &&
    page.includes('download-all --source external --pg 18') &&
    page.includes('--external-admission') && page.includes('--external-bundle') &&
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
