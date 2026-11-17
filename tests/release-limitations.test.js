import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {elements, hasClass, textContent} from '../scripts/html-contract.mjs';

function verifyHomeGuidance(html, locale) {
  const steps = elements(html, 'ol').find(x => hasClass(x, 'quickstart-steps'));
  assert.ok(steps && elements(steps.content, 'li').some(x => textContent(x)), 'Download steps missing');
  const topics = locale === 'ja'
    ? [/検索/, /PostgreSQL/, /要件/, /ZIP/, /SHA-256/, /導入/]
    : [/search/i, /PostgreSQL/, /requirements/i, /ZIP/, /SHA-256/, /install/i];
  for (const topic of topics) assert.match(textContent(steps), topic, 'Download guidance omitted');
  assert.ok(html.indexOf('id="quickstart-heading"') < html.indexOf('id="extensions-heading"'));
  const footer = elements(html, 'footer')[0];
  assert.ok(footer, 'Footer missing');
  const note = elements(footer.content, 'section').find(x => hasClass(x, 'release-limitations'));
  assert.ok(note, 'Installation limitations missing');
  assert.equal(note.attributes.role, 'note');
  const headingId = note.attributes['aria-labelledby'];
  assert.ok(headingId && elements(note.content, 'h2').some(x => x.attributes.id === headingId && textContent(x)),
    'Installation limitations need an accessible heading');
  assert.doesNotMatch(footer.content, /\/issues\/|build infrastructure/);
  assert.ok(html.includes('Get-FileHash .\\downloaded-file.zip -Algorithm SHA256'));
  const limitations = locale === 'ja'
    ? [/非公式/, /PostgreSQL/, /ライセンス/, /設定/, /インストールされません/, /提供元/]
    : [/unofficial/i, /PostgreSQL/, /licenses?/i, /configuration/i, /does not install/i, /provider/i];
  for (const limitation of limitations) assert.match(textContent(note), limitation, 'Installation caution omitted');
}

for (const locale of ['en', 'ja']) {
  const html = readFileSync(new URL('../' + locale + '/index.html', import.meta.url), 'utf8');
  test(locale + ' home page explains download steps and installation limitations', () => {
    verifyHomeGuidance(html, locale);
  });
  test(locale + ' home guidance allows reworded headings, extra steps and reordered attributes/classes', () => {
    const revised = html
      .replace(/(<h2 id="quickstart-heading">)[^<]+/, '$1Download guide')
      .replace(/(<h2 id="release-limitations-title">)[^<]+/, '$1Installation notes')
      .replace('class="quickstart-steps"', "class='extra quickstart-steps'")
      .replace('</ol>', '<li>Read the upstream documentation.</li></ol>')
      .replace('class="release-limitations" role="note"', "role='note' class='extra release-limitations'");
    verifyHomeGuidance(revised, locale);
  });
  test(locale + ' home guidance rejects missing steps and installation cautions', () => {
    for (const changed of [
      html.replace(/<ol class="quickstart-steps">[\s\S]*?<\/ol>/, ''),
      html.replace(/<section class="release-limitations"[\s\S]*?<\/section>/, ''),
      html.replaceAll(locale === 'ja' ? '非公式' : 'unofficial', ''),
      html.replaceAll(locale === 'ja' ? 'ライセンス' : 'licenses', ''),
      html.replace(locale === 'ja' ? 'インストールされません' : 'does not install it', '')
    ]) assert.throws(() => verifyHomeGuidance(changed, locale));
  });
}
