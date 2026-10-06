# pgextwin website

[English](README.md) | **日本語**

pgextwinの静的Websiteソースです。

Extensionの配布情報は公開リポジトリ `pgextwin/catalog` から、PostgreSQL Lifecycle情報は `pgextwin/build/metadata/postgresql.json` から取得します。Extensionバイナリ自体はWebsiteには置かず、各Extension repositoryのGitHub Releasesを正規の配布元とします。

## データモデル

Websiteでは、役割の異なる2つの情報源を組み合わせます。

- `pgextwin/catalog`: Extension/PostgreSQL majorごとに検証済みWindows x64バイナリが公開済みかどうか（`postgresql.<major>.available`）
- `pgextwin/build/metadata/postgresql.json`: PostgreSQLコミュニティのLifecycle/EOL日。現在のmaintenance状態はここから導出

`available` と `maintained` は同義ではありません。PostgreSQL majorがEOLになっても既存Release assetはhistorical downloadとして残るため、`available: true` を維持できます。Website側に日付依存の静的 `maintained` booleanは保存しません。

Lifecycle判定は `yyyy-MM-dd` のcalendar date同士で行います。Productionでは現在のUTC日付を使用し、EOL当日はinclusive、翌日からhistorical扱いです。Lifecycle metadataを取得できない場合、またはmajor/EOL値が不明・不正な場合でもCatalog表示は継続し、Lifecycle状態だけを `Lifecycle unknown` / `Lifecycle data unavailable` にfallbackします。

## ローカル確認

任意の静的HTTP serverでこのディレクトリを配信してください。ブラウザのfetch制限により、`index.html` をファイルとして直接開く方法では外部metadataを取得できない場合があります。

## テスト

Lifecycle判定は `lifecycle.js` のテスト可能な関数へ分離し、Node標準test runnerだけで検証します。

```text
node --test tests/*.test.js
```

PostgreSQL 14のEOL境界、将来EOLのmajor、unknown major、不正EOL、UTC calendar date処理をテストします。

## CI

`.github/workflows/validate.yml` がPull Requestと `main` push時にLifecycleテストを実行します。Frontend frameworkや追加runtime dependencyのinstallは不要です。

## 公開

WebsiteはGitHub Pagesで `main` branchから公開します。Pages deploymentとLifecycle情報源は分離されており、公開Websiteはruntimeに正規情報源 `pgextwin/build` のmetadataを取得します。

## 現在のmilestone

公開Websiteはcatalog schema v1を維持したまま初期8 Extensionを表示し、公開済みバイナリのavailabilityと現在のPostgreSQL maintenance状態を区別して表示します。Catalog schema v2やWebsite v2の本格的な検索・filterは後続milestoneです。
