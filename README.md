# pgextwin website

[日本語](README_ja.md) | English

Static website source for pgextwin.

The site reads extension metadata from the public `pgextwin/catalog` repository. It does not host extension binaries; downloads remain on each extension repository's GitHub Releases page.

## Local preview

Serve this directory with any static HTTP server. Opening `index.html` directly may be restricted by browser fetch policies.

## Deployment

The website is deployed with GitHub Pages from the `main` branch. Pages deployment is handled by GitHub, and the latest deployment is successful.

## Current milestone

The published website consumes the current `pgextwin/catalog` schema v1 and renders the initial eight extensions. All eight have published Releases and catalog entries, so the **initial extension roadmap is complete**.

Website v2 is a separate future milestone and is not implemented here.
