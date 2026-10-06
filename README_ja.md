# pgextwin website

[English](README.md) | **日本語**

pgextwinの静的Websiteソースです。

Extension情報は公開リポジトリ `pgextwin/catalog` のメタデータを読み込みます。Extensionバイナリ自体はWebsiteには置かず、各Extension repositoryのGitHub Releasesを正規の配布元とします。

## ローカル確認

任意の静的HTTP serverでこのディレクトリを配信してください。ブラウザのfetch制限により、`index.html` をファイルとして直接開く方法ではcatalogを取得できない場合があります。

## 公開

WebsiteはGitHub Pagesで `main` branchから公開しています。PagesのdeployはGitHub側で実行され、直近のdeploymentも成功しています。

## 現在のmilestone

公開Websiteは `pgextwin/catalog` の現行schema v1を読み込み、初期8 Extensionを表示します。初期8 ExtensionのRelease公開・catalog登録はすべて完了しており、**Initial extension roadmap: 完了**です。

Website v2は後続の独立した作業であり、このmilestoneでは着手しません。
