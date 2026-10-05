# pgextwin website

[English](README.md) | **日本語**

pgextwinの静的Websiteソースです。

Extension情報は公開リポジトリ `pgextwin/catalog` のメタデータを読み込みます。Extensionバイナリ自体はWebsiteには置かず、各Extension repositoryのGitHub Releasesを正規の配布元とします。

## ローカル確認

任意の静的HTTP serverでこのディレクトリを配信してください。ブラウザのfetch制限により、`index.html` をファイルとして直接開く方法ではcatalogを取得できない場合があります。

## 公開

GitHub Pagesで `main` branchを公開する構成を想定しています。Pagesの有効化はRepository管理設定なので、ソース実装とは分離します。
