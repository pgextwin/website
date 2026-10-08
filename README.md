# pgextwin website

[Japanese](README_ja.md) | English

Static Website v2 for discovering pgextwin Windows x64 PostgreSQL extension binaries. The site remains vanilla HTML/CSS/JavaScript with no frontend framework or build step.

## Data sources and responsibilities

The browser combines two independent canonical sources at runtime:

- `pgextwin/catalog` schema v2: release identity, binary availability, canonical direct-download URLs, ZIP SHA-256 values, runtime requirements, Test Contract-derived capabilities, immutable capability provenance, and release-specific supply-chain evidence availability.
- `pgextwin/build/metadata/postgresql.json`: PostgreSQL community lifecycle/EOL dates used to derive the current maintenance state.

`available` and `maintained` are deliberately different. Existing binaries remain downloadable as historical artifacts after PostgreSQL EOL. The EOL date itself is maintained; historical status begins on the following UTC calendar day. If lifecycle metadata cannot be fetched, catalog discovery/downloads continue and only lifecycle status falls back to `Lifecycle unknown`.

## Website v2 UX

Website v2 provides:

- case-insensitive search across extension name, display name, description, and upstream repository,
- a PostgreSQL-major filter dynamically derived from currently available catalog records,
- AND-combined search + PostgreSQL filtering, result counts, and an explicit empty state,
- canonical direct ZIP links from `postgresql.<major>.downloadUrl`,
- the complete 64-character ZIP SHA-256 synchronized by Catalog CI with the published `SHA256SUMS.txt`,
- user-facing `runtime.requirements` including CREATE EXTENSION, preload semantics, background-worker use, and required client executables/package paths,
- functional scenarios and CI coverage from Test Contract v2, including PostgreSQL-major-specific scenario scoping,
- immutable `capabilitiesSource` links pinned to the exact extension-repository commit,
- per-major build provenance / SPDX SBOM / SBOM attestation / vulnerability-report availability,
- direct SPDX SBOM and point-in-time Grype-report links when those release assets exist.

Attestations are shown as attestations, not fictional Release assets. `not-covered` CI coverage is never presented as unsupported. Vulnerability reports are point-in-time evidence and the Website does not generate security verdicts.

The current initial-eight Releases predate the Step 6-10-enabled release path. Their evidence fields are therefore displayed neutrally as additional evidence not published for that historical Release. This does not imply that the current build infrastructure lacks those capabilities.

## Failure handling and URL safety

An index fetch/schema failure is a catalog-level error. Individual extension-record fetch or defensive-validation failures do not blank the entire catalog: valid records still render and the status reports the unavailable-record count. Lifecycle fetch failures are isolated in the same way.

Catalog v2 is fully validated in Catalog CI. The Website performs only lightweight defensive checks, requires schema v2 for the index/records, and only turns `https:` URLs into links. Catalog values are inserted with DOM APIs / `textContent`, not `innerHTML`.

## Accessibility

The filter controls have explicit labels, status/result counts use polite live regions, lifecycle/evidence/coverage states include text rather than relying on color, and native `<details>` / `<summary>` controls keep dense information keyboard-operable. SHA-256 values remain visible and wrap rather than being truncated. Layouts reflow for narrow screens and 200% zoom without hiding the primary search, filter, download, checksum, or project-link actions. Visible focus styles are provided for links, controls, and summaries.

## Local preview

Serve this directory with any static HTTP server. Opening `index.html` directly may be restricted by browser fetch policies.

## Tests

Pure catalog-view logic is isolated in `catalog-view.js`; PostgreSQL lifecycle logic remains in `lifecycle.js`. Both use only Node's standard test runner:

```text
node --test tests/*.test.js
```

Tests cover search, dynamic major derivation/filtering, combined filters, runtime wording, background-worker/client-executable presentation, PostgreSQL-major-specific scenarios, CI coverage wording, historical/future evidence fixtures, URL safety, schema rejection, partial record failures, and the existing PostgreSQL 14 EOL/fallback lifecycle contract.

## CI and deployment

`.github/workflows/validate.yml` runs `node --check` for the JavaScript entry points and `node --test tests/*.test.js` for pull requests and pushes to `main`. GitHub Actions keep `contents: read` and use full-SHA-pinned official actions. GitHub Pages deploys the static `main` branch independently of the runtime data sources.

## Windows Extension Landscape (Step 14)

Three independent runtime data sources now coexist: distribution Catalog v2 (published pgextwin binaries and downloads), build lifecycle metadata (PostgreSQL EOL), and Landscape Registry v1 (`catalog/landscape/index.json`, candidates and alternative acquisition sources). Failure of the Landscape fetch never blocks the published download Catalog; record-level Landscape failures preserve valid records.

The second section provides search, status and source-type filters, separate last-reviewed dates, rationale, license, tentative effort/priority, and provider-specific acquisition links. Public vs commercial availability and ordinary PostgreSQL vs vendor/conda-specific compatibility are explicit. External source URLs must be HTTPS and are rendered via DOM/textContent without innerHTML. Unavailable candidate binary evidence never implies Windows incompatibility. External binaries are not validated or supported by pgextwin. Native semantic controls, keyboard focus and responsive narrow layout remain in place.

`node --test tests/*.test.js` includes Landscape validation, filters, source presentation, partial failure, and HTTPS tests in addition to the preexisting Catalog/Lifecycle suites.
