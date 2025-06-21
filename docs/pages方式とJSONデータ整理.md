# Music8 各ページ方式・JSONデータ整理

## トップページ（/）

- **方式**: SSG（静的サイト生成）
- **使用JSON**: `/public/data/top_songs_by_style.json`
  - 容量: 約134KB
  - 内容: 各スタイルごとの代表曲リスト
- **備考**: artists.jsonは空または未使用

---

## スタイル一覧ページ（/styles）

- **方式**: SSG（静的サイト生成）
- **使用JSON**: `/public/data/styles_summary.json`
  - 容量: 約1.1KB
  - 内容: 各スタイル（Pop, Dance, Alternative, ...）のサマリー情報（曲数、最終更新日、スタイル名など）
- **備考**: 並び順はSTYLE_CONFIG.listのid順に揃えている

---

## スタイル別曲一覧ページ（/styles/[style]/[page]）

- **方式**: SSG（静的サイト生成）+ SSR（サーバーサイドレンダリング）
  - 各スタイルごとに**最大5ページまでSSG**（ビルド時静的生成）
  - 6ページ目以降はSSR（リクエストごとにサーバーで生成）
- **使用JSON**: `/public/data/styles/[style]/[page].json`
  - 例: `/public/data/styles/pop/1.json`, `/public/data/styles/pop/2.json`, ...
  - 各ファイルは1ページ分（20曲程度）の曲データを格納
- **全スタイル合計容量**:
  - **SSG用（1～5ページ）合計**: 約3.8MB
  - **SSR用（6ページ以降）合計**: 約73.3MB

| スタイル        | SSGファイル数 | SSG容量(MB) | SSRファイル数 | SSR容量(MB) |
|:---------------|-------------:|------------:|--------------:|------------:|
| pop            | 5            | 0.46        | 298           | 27.08       |
| alternative    | 5            | 0.44        | 181           | 16.05       |
| dance          | 5            | 0.49        | 62            | 6.14        |
| electronica    | 5            | 0.49        | 48            | 4.68        |
| hip-hop        | 5            | 0.47        | 38            | 3.67        |
| metal          | 5            | 0.43        | 52            | 4.53        |
| others         | 1            | 0.09        | 0             | 0.00        |
| rb             | 5            | 0.44        | 60            | 5.66        |
| rock           | 5            | 0.44        | 19            | 1.77        |

- **備考**: サーバー側で該当JSONを読み込み、クライアントにpropsで渡す。ファイルが存在しない場合は404。

---

## アーティスト一覧ページ

### /artists（アルファベット索引ページ）
- **方式**: SSG（静的サイト生成）
- **使用JSON**: `/public/data/artists.json`（全アーティストメタ情報, サジェスト・全体検索用）
  - 全アーティストのメタ情報（名前・スラッグ・国・曲数など）を格納

### /artists/[letter], /artists/0-9（アルファベット・数字別ページ）
- **方式**: ISR（インクリメンタル静的再生成, 12時間ごと）
  - 各アルファベットごと・ページごとに分割したJSONを使用
  - 1ページ分（例：50件）のみを格納
  - **ローカル開発時は`public/data`配下のJSON、本番環境ではリモート（例: https://xs867261.xsrv.jp/data/data/）のJSONを自動参照**
- **使用JSON**: `/public/data/artistlist/[A-Z]/[page].json`, `/public/data/artistlist/0-9/[page].json`
  - 例: `/public/data/artistlist/A/1.json`, `/public/data/artistlist/B/2.json`, ...
  - 各artistlist配下のファイルは1ページ分（約50件）のアーティストデータを格納

## アーティスト詳細ページ（/アーティストスラッグ/[ページ番号]）

- **方式**: ISR（インクリメンタル静的再生成, 12時間ごと）
  - 各アーティストごと・ページごとに分割したJSONを使用
  - **ローカル開発時は`public/data`配下のJSON、本番環境ではリモート（例: https://xs867261.xsrv.jp/data/data/）のJSONを自動参照**
- **使用JSON**:
  - `/public/data/artists/[slug].json`（アーティスト基本情報）
  - `/public/data/artists/[slug]/[page].json`（1ページ分の曲リスト）
- **ISRのrevalidateは12時間（43,200秒）に設定**
- **ローカル・リモートの自動切り替えはprocess.env.NODE_ENVやDATA_BASE_URLで制御**
- **容量の目安**:
  - 基本情報JSON: 10～30KB程度
  - 曲リストJSON: 1ファイルあたり15～130KB（曲数による）
- **総アーティスト数**: 約6,700
- **総容量（実測値）**: 約137MB
  - artists.json（全アーティストメタ情報）: 約6.7MB
  - 各アーティスト詳細JSON＋各アーティスト曲リストJSON: 約130MB
- **備考**:
  - 全曲分を集計してスタイル・ジャンル分布を算出
  - ページごとに曲リストを分割し、パフォーマンスと容量を最適化
  - 実際の容量はアーティスト数・曲数・データ内容により変動

---

## ジャンル一覧ページ（/genres）

- **方式**: SSG（静的サイト生成）のみ
- **使用JSON**: `/public/data/genres-summary.json`（ローカル開発時）
  - 容量: 約51KB
  - 内容: 全ジャンル（509件）のサマリー情報（id, name, slug, totalSongs）
- **備考**: 本番環境ではリモート（例: https://xs867261.xsrv.jp/data/data/genres-summary.json）のJSONも参照可能
  - ローカル・リモート自動切り替えはprocess.env.NODE_ENVやDATA_BASE_URLで制御

---

## ジャンル別曲一覧ページ（/genres/[genre]/[page]）

- **方式**: CSR（Client Side Rendering）＋fetch
  - 容量制限・Vercelビルド制限対策のため、ジャンル別曲一覧はCSRで実装
  - 必要なデータはクライアント側でfetchして動的に表示
- **使用JSON**: `/public/data/genres/[genre].json`
  - 例: `/public/data/genres/dance-pop.json`
- **容量目安**:
  - 1ジャンルあたり: 数百KB～数MB（曲数・フィールド数による）
- **運用・最適化方針**:
  - ジャンルごとにJSONを分割し、必要な分だけfetch
  - クライアント側で全件取得後、ページネーション表示
  - fetch時にCDNキャッシュやブラウザキャッシュを活用
  - 容量がさらに増える場合は、S3等の外部ストレージ＋API経由fetchも検討
- **備考**:
  - fetch失敗時のエラーハンドリング・ローディングUIも実装推奨
  - データ構造・容量の見直しは定期的に行う

### 【現時点の集計】
- 総ページ数: **1,835ページ**
- ジャンル数: **492ジャンル**
- 合計ファイルサイズ: **約104MB**
- 備考: 各ジャンルごとにページ分割されたJSON（例: `/public/data/genres/[genre]/1.json`, `2.json`, ...）を使用


## 曲詳細ページ（/アーティスト名/songs/曲スラッグ）

- **方式**: SSR（サーバーサイドレンダリング）
  - リクエストごとにサーバーでデータ（JSON）を読み込み、ページを生成
  - Vercelのビルドタイムアウトや容量制限の心配なし
  - SEOやSNSシェアにも強い
- **データ格納場所**: `public/data/songs/`（ローカル開発時）
  - 本番環境ではリモート（例: https://xs867261.xsrv.jp/data/data/songs/）のJSONも参照可能
  - ローカル・リモート自動切り替えはprocess.env.NODE_ENVやDATA_BASE_URLで制御
- **曲数**: 16,726曲（2024年6月時点）
- **総容量**: 約76MB（2024年6月時点）
- **ファイル名例**: `public/data/songs/ed-sheeran_old-phone.json`
- **運用方針**:
  - 曲ごとに1ファイル（1 JSON）で管理
  - SSRのため、データ追加・修正も即時反映
  - 静的ビルド容量やビルド時間を気にせず運用可能

## Aboutページ（/info）

- **方式**: SSG（静的サイト生成）
  - ※常に最新の件数を表示したい場合はSSR（dynamic = 'force-dynamic'）に切り替え可能
- **データ取得**: サーバーサイドでファイルシステム（fs/promises, path）を使い、
  - 曲数（public/data/songs内のjsonファイル数）
  - アーティスト数（public/data/artists.jsonの配列長）
  - ジャンル数（public/data/genres/genres.jsonの配列長）
  を集計し、ページ内で動的に表示
- **特徴**: サイトの規模感・特徴・問い合わせ先などを案内するインフォメーションページ

※今後、他のコンテンツページについても同様に「方式・JSON種別・容量」を追記してください。 