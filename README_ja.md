# pgextwin website

[English](README.md) | **日本語**

pgextwinのWindows x64 PostgreSQL Extension binaryを探すための静的Website v2です。Frontend frameworkやbuild stepは導入せず、vanilla HTML/CSS/JavaScript構成を維持します。

## 情報源と責務分離

Browserではruntimeに、役割の異なる2つの正規情報源を結合します。

- `pgextwin/catalog` schema v2: Release identity、binary availability、canonical direct-download URL、ZIP SHA-256、runtime requirements、Test Contract由来capability、immutable capability provenance、Release固有のsupply-chain evidence提供状態
- `pgextwin/build/metadata/postgresql.json`: PostgreSQLコミュニティのLifecycle/EOL日。現在のmaintenance状態をここから導出

`available` と `maintained` は別概念です。PostgreSQLがEOLになっても既存binaryはhistorical artifactとしてdownload可能なまま保持します。EOL当日はmaintained、翌UTC日からhistoricalです。Lifecycle metadataを取得できない場合でもCatalogの検索/downloadは継続し、Lifecycleだけ `Lifecycle unknown` へfallbackします。

## Website v2 UX

Website v2では次を提供します。

- Extension name / display name / description / upstream repositoryを対象にしたcase-insensitive検索
- Catalogの`available: true` recordから動的に導出するPostgreSQL major filter
- search + PostgreSQL filterのAND条件、result count、明示的empty state
- `postgresql.<major>.downloadUrl`をそのまま使うcanonical direct ZIP link
- Catalog CIが公開`SHA256SUMS.txt`と同期確認する64文字すべてのZIP SHA-256
- `runtime.requirements`に基づくCREATE EXTENSION、preload、background worker、required client executable / package pathの表示
- Test Contract v2由来functional scenario / CI coverageと、PostgreSQL major限定scenarioの正確なscope表示
- Extension repositoryのexact commitへ固定された`capabilitiesSource`
- major別のBuild Provenance / SPDX SBOM / SBOM Attestation / vulnerability report提供状態
- 実assetが存在する場合のSPDX SBOMおよびpoint-in-time Grype report direct link

Attestationを架空のRelease assetとして扱いません。CI coverageの`not-covered`を`unsupported`とも表示しません。Vulnerability reportはpoint-in-time evidenceであり、Website側でsecurity verdictを生成しません。

初期8 Extensionの現在のReleaseはStep 6〜10対応release pathより前に公開されたため、追加evidenceは「そのhistorical Releaseでは公開されていない」というneutralな状態で表示します。現在のbuild infrastructureにStep 6〜10機能が未実装という意味ではありません。

## 障害時の継続表示とURL safety

index取得/schema失敗はCatalog全体errorとします。一方、個別Extension recordのfetchまたはdefensive validation失敗では、正常recordを引き続き表示し、取得できなかった件数をstatusへ通知します。Lifecycle取得失敗も分離し、binary availability/downloadは維持します。

Catalog v2の完全なschema validationはCatalog CIが担当します。Website側は軽量なdefensive checkだけを行い、index/recordのschema v2を必須とし、`https:` URLだけをlink化します。Catalog値の挿入はDOM API / `textContent`中心で、`innerHTML`は使用しません。

## Accessibility

Search/filterには明示labelを付け、status/result countはpolite live regionで通知します。Lifecycle/evidence/coverageは色だけで表現せずtextも表示します。情報量の多い部分はnative `<details>` / `<summary>`でkeyboard操作できます。SHA-256は省略せずwrapし、narrow layoutや200% zoomでもsearch/filter/download/checksum/project linkを失わない構成です。Link、form control、summaryにはvisible focusを用意します。

## ローカル確認

任意の静的HTTP serverでこのディレクトリを配信してください。Browserのfetch制限により、`index.html`をfileとして直接開く方法では外部metadataを取得できない場合があります。

## Tests

Catalog表示のpure logicは`catalog-view.js`、PostgreSQL Lifecycle判定は既存`lifecycle.js`へ分離し、Node標準test runnerだけで検証します。

```text
node --test tests/*.test.js
```

Search、dynamic major導出/filter、AND filter、runtime wording、background worker/client executable、PG-major限定scenario、CI coverage wording、historical/future evidence fixture、URL safety、schema rejection、partial record failure、既存PG14 EOL/fallback contractをtestします。

## CI / 公開

`.github/workflows/validate.yml`はPull Requestと`main` pushでJavaScriptの`node --check`と`node --test tests/*.test.js`を実行します。GitHub Actionsは`contents: read`を維持し、公式Actionはfull SHA pinのままです。GitHub Pagesは静的`main` branchを公開し、runtime metadataの正規情報源とは独立しています。
