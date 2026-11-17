import test from 'node:test';
import assert from 'node:assert/strict';
import {assertApprovedIndexes, landscapeExpectations, assertApprovedNames}
  from '../scripts/published-data-expectations.mjs';

function fixture() {
  const records = [
    {name: 'alpha', status: 'implemented', pgextwinCatalogName: 'alpha',
      roadmap: {decision: 'wave-2', order: 2}, windowsBinarySources: []},
    {name: 'beta', status: 'candidate', roadmap: {decision: 'research'}, windowsBinarySources: [
      {type: 'vendor', availability: 'support-customer', postgresqlDistribution: 'conda-postgresql',
        url: 'https://example.org/beta'}]}
  ];
  return {catalog: {schemaVersion: 2, extensions: ['alpha']},
    landscape: {schemaVersion: 1, extensions: records.map(record => record.name)}, records};
}
const derive = f => landscapeExpectations(f.catalog, f.landscape, f.records);

test('published expectations follow approved membership, roadmap and source data', () => {
  const f = fixture();
  const before = derive(f);
  assert.deepEqual(before.counts, {implemented: 1, candidate: 1, 'not-planned': 0});
  assert.match(before.implementedLabels[0].label, /Wave 2 #2.*selection history/);
  assert.match(before.candidateLabels[0].label, /Further research/);
  assert.deepEqual(before.vendorNames, ['beta']);
  assert.deepEqual(before.sourceUrls, ['https://example.org/beta']);
  assert.equal(before.vendorLabel, true);
  assert.equal(before.condaLabel, true);

  // Promotion, removal and new candidates need no historical roster edits.
  f.catalog.extensions = ['beta'];
  f.records.shift();
  Object.assign(f.records[0], {status: 'implemented', pgextwinCatalogName: 'beta'});
  delete f.records[0].roadmap;
  f.records[0].windowsBinarySources = [];
  f.records.push({name: 'gamma', status: 'candidate', roadmap: {decision: 'wave-2', order: 1},
    windowsBinarySources: []}, {name: 'delta', status: 'candidate', windowsBinarySources: []});
  f.landscape.extensions = f.records.map(record => record.name);
  const after = derive(f);
  assert.deepEqual(after.counts, {implemented: 1, candidate: 2, 'not-planned': 0});
  assert.deepEqual(after.implementedLabels, []);
  assert.deepEqual(after.candidateLabels.map(item => item.name), ['delta', 'gamma']);
  assert.match(after.candidateLabels[0].label, /Decision pending/);
  assert.match(after.candidateLabels[1].label, /Wave 2 #1/);
  assert.deepEqual(after.vendorNames, []);
  assert.deepEqual(after.sourceUrls, []);
  assert.equal(after.vendorLabel, false);
  assert.equal(after.condaLabel, false);
  assert.equal(after.query, 'beta');
  assert.deepEqual(after.searchNames, ['beta']);
});

test('published expectations reject unapproved, missing and misidentified records', () => {
  for (const mutate of [
    f => { f.records[0].name = 'unapproved'; },
    f => { f.records.pop(); },
    f => { f.records[0].pgextwinCatalogName = 'other'; },
    // Same implemented count must not hide a different approved set.
    f => { f.catalog.extensions = ['other']; },
    f => { f.records[1].status = 'unknown'; }
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => derive(f), {name: 'AssertionError'});
  }
});

test('published expectations retain safe identifiers and Catalog resource limits', () => {
  for (const [catalog, landscape] of [
    [{schemaVersion: 2, extensions: ['../unsafe']}, {schemaVersion: 1, extensions: []}],
    [{schemaVersion: 2, extensions: ['alpha']}, {schemaVersion: 1, extensions: ['../unsafe']}],
    [{schemaVersion: 2, extensions: Array.from({length: 129}, (_, i) => 'x' + String(i).padStart(3, '0'))},
      {schemaVersion: 1, extensions: []}]
  ]) assert.throws(() => assertApprovedIndexes(catalog, landscape), {name: 'AssertionError'});
});

test('rendered membership rejects substitutions, extra and missing entries', () => {
  assertApprovedNames(['beta', 'alpha'], ['alpha', 'beta']);
  for (const actual of [['alpha', 'unapproved'], ['alpha', 'beta', 'extra'], ['alpha']]) {
    assert.throws(() => assertApprovedNames(actual, ['alpha', 'beta']), {name: 'AssertionError'});
  }
});
