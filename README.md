# pgextwin website

[日本語](README_ja.md) | English

Static website source for pgextwin.

The site reads extension distribution metadata from the public `pgextwin/catalog` repository and PostgreSQL lifecycle metadata from `pgextwin/build/metadata/postgresql.json`. It does not host extension binaries; downloads remain on each extension repository's GitHub Releases page.

## Data model

The website deliberately combines two independent sources:

- `pgextwin/catalog`: whether a published and verified Windows x64 binary exists for an extension/PostgreSQL-major pair (`postgresql.<major>.available`),
- `pgextwin/build/metadata/postgresql.json`: PostgreSQL community lifecycle/EOL dates used to derive the current maintenance state.

`available` and `maintained` are not synonyms. An EOL PostgreSQL major can remain `available` because its existing release assets are historical downloads. The website does not store a separate static `maintained` boolean.

Lifecycle comparisons use `yyyy-MM-dd` calendar dates. Production uses the current UTC calendar date, the EOL date is inclusive, and historical status begins on the following day. If lifecycle metadata cannot be fetched or a major/EOL value is unknown, the catalog still renders and only lifecycle status falls back to `Lifecycle unknown` / `Lifecycle data unavailable`.

## Local preview

Serve this directory with any static HTTP server. Opening `index.html` directly may be restricted by browser fetch policies.

## Tests

Lifecycle logic is kept in `lifecycle.js` as testable functions and uses only Node's standard test runner:

```text
node --test tests/*.test.js
```

The tests cover the PostgreSQL 14 EOL boundary, future EOL dates, unknown majors, malformed EOL data, and UTC calendar-date handling.

## CI

`.github/workflows/validate.yml` runs the lifecycle tests for pull requests and pushes to `main`. No frontend framework or runtime dependency installation is required.

## Deployment

The website is deployed with GitHub Pages from the `main` branch. Pages deployment remains independent from the lifecycle data source; runtime lifecycle metadata is fetched from the canonical `pgextwin/build` repository.

## Current milestone

The published website consumes catalog schema v1 and displays the initial eight extensions while distinguishing published binary availability from current PostgreSQL maintenance status. Catalog schema v2 and broader Website v2 search/filter work remain separate future milestones.
