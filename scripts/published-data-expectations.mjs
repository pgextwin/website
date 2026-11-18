// Expectations for published-page audits come only from the protected Catalog
// and its Landscape registry, never from the currently rendered DOM.
// Labels are modelled as the published EN page renders them: the locale layer
// (locale.js bilingual()) keeps only the English part of a bilingual
// "English / 日本語" label, so the raw bilingual roadmapLabel() output would
// mismatch every rendered label. See Run 44136863239 (http/pgroonga).
import assert from "node:assert/strict";
import catalogView from "../catalog-view.js";
import landscapeView from "../landscape-view.js";

export function assertApprovedIndexes(catalogIndex, landscapeIndex) {
  for (const validation of [catalogView.validateCatalogIndex(catalogIndex),
    landscapeView.validateIndex(landscapeIndex)]) {
    assert.ok(validation.valid, validation.reason);
  }
}

// Mirror locale.js bilingual(value, /* japanese */ false): on the EN page a
// bilingual "English / 日本語" label renders as its English part only.
function englishLabel(label) {
  return String(label).split(" — ").map(part => {
    const at = part.lastIndexOf(" / ");
    if (at < 0) return part;
    const last = part.slice(at + 3);
    if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(last)) return part;
    return part.slice(0, at);
  }).join(" — ");
}

export function landscapeExpectations(catalogIndex, landscapeIndex, records) {
  assertApprovedIndexes(catalogIndex, landscapeIndex);
  assert.deepEqual(records.map(record => record.name), landscapeIndex.extensions,
    "Landscape records differ from the approved index");
  const counts = Object.fromEntries(["implemented", "candidate", "not-planned"]
    .map(status => [status, records.filter(record => record.status === status).length]));
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), records.length,
    "Unknown Landscape status");
  const implemented = records.filter(record => record.status === "implemented");
  for (const record of implemented) assert.equal(record.pgextwinCatalogName, record.name,
    "Implemented Landscape entry has a different Catalog identity");
  assert.deepEqual(implemented.map(record => record.name).sort(), catalogIndex.extensions,
    "Catalog/Landscape implemented membership mismatch");
  const labels = status => records.filter(record => record.status === status)
    .filter(record => status === "candidate" || record.roadmap)
    .map(record => ({name: record.name, label: englishLabel(landscapeView.roadmapLabel(record))}))
    .sort((a, b) => a.name.localeCompare(b.name));
  const query = records[0]?.name || "";
  const sources = records.flatMap(record => record.windowsBinarySources);
  return {
    counts, candidateLabels: labels("candidate"), implementedLabels: labels("implemented"),
    query, searchNames: landscapeView.filterRecords(records, {query}).map(record => record.name).sort(),
    vendorNames: landscapeView.filterRecords(records, {sourceType: "vendor"}).map(record => record.name).sort(),
    sourceUrls: sources.map(source => source.url).sort(),
    vendorLabel: sources.some(source => source.availability === "support-customer"),
    condaLabel: sources.some(source => source.postgresqlDistribution === "conda-postgresql")
  };
}

export function assertApprovedNames(actual, expected, message) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}
