# pgextwin website

[日本語](README_ja.md) | English

Static website source for pgextwin.

The site reads extension metadata from the public `pgextwin/catalog` repository. It does not host extension binaries; downloads remain on each extension repository's GitHub Releases page.

## Local preview

Serve this directory with any static HTTP server. Opening `index.html` directly may be restricted by browser fetch policies.

## Deployment

The intended deployment target is GitHub Pages from the `main` branch. Enabling Pages is an administrative repository setting and is intentionally separate from source development.
