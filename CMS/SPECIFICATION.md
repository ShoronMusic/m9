# Music8 CMS 仕様書

## 1. 概要
Music8のためのモバイルフレンドリーな曲登録CMSシステムの仕様書です。

## 2. システム構成

### 2.1 技術スタック
- フロントエンド: Next.js
- バックエンド: Firebase Functions
- データベース: WordPress MySQL
- 認証: Firebase Authentication

### 2.2 システムアーキテクチャ
```
[クライアント] → [Next.js] → [Firebase Functions] → [WordPress DB]
```

## 3. 機能要件

### 3.1 基本機能
- YouTube動画URLからの曲情報自動取得
- 曲情報入力フォーム
- WordPress DBへの直接保存
- モバイル対応UI

### 3.2 詳細機能

#### 3.2.1 YouTube情報取得機能
1. **動画情報の自動取得**
   - タイトルからアーティストと曲名の分離
   - サブアーティスト（feat., ft., fet.等）の検出
   - 公開日の取得
   - YouTube IDの抽出
   - PVスタイルの判別（Lyric, Visual, Audio, pv, Live, Anime, Cartoon, AI, CG）

2. **タイトル前処理**
   - 公式動画表記の削除（Official Video, Official Music等）
   - レーベル名の削除
   - 特殊文字の処理

#### 3.2.2 アーティスト管理機能
1. **カテゴリー（アーティスト）登録**
   - 既存アーティスト（5000+）の表示と選択
   - 新規アーティストの追加機能
   - アルファベット順インデックス表示
   - メインアーティストの自動判定

#### 3.2.3 タクソノミー管理機能
1. **スタイル登録**
   - WordPress DBからのスタイル一覧取得
   - チェックボックスによる選択

2. **ボーカル登録**
   - 固定選択肢（M/F）の表示
   - チェックボックスによる選択

3. **ジャンル登録**
   - メインアーティストの登録ジャンル表示（使用頻度順）
   - 上位20ジャンルの表示
   - 全ジャンル（500+）のアルファベット順表示
   - 展開/折りたたみ機能

## 4. データ構造

### 4.1 WordPress投稿データ
```json
{
  "post": {
    "post_id": "number",
    "post_type": "post",
    "post_status": "publish",
    "post_name": "string",
    "post_title": "string",
    "post_content": "string",
    "post_date": "datetime",
    "post_modified": "datetime",
    "post_thumbnail": "string"
  },
  "taxonomies": {
    "post_tags": "string[]",
    "post_category": "string[]",
    "tax_genre": "string[]",
    "tax_vocal": "string[]",
    "tax_style": "string[]",
    "tax_soundtrack": "string[]"
  },
  "acf_fields": {
    "ytvideoid": "string",
    "ytreleasedate": "date",
    "pvstyle": "string[]",
    "likecount": "number",
    "spotify_data": {
      "track_id": "string",
      "release_date": "date",
      "name": "string",
      "artists": "string[]",
      "album": "string",
      "images": "string[]",
      "duration_ms": "number",
      "popularity": "number"
    }
  }
}
```

### 4.2 アーティスト情報
```json
{
  "id": "string",
  "name": "string",
  "name_jp": "string",
  "spotify_id": "string",
  "spotify_images": "string[]",
  "genres": "string[]",
  "popularity": "number"
}
```

## 5. セキュリティ要件

### 5.1 認証・認可
- Firebase Authenticationによるユーザー認証
- ロールベースのアクセス制御
- APIキーの安全な管理

### 5.2 データ保護
- データベース接続の暗号化
- 入力値のバリデーション
- XSS対策
- CSRF対策

## 6. 開発フェーズ

### フェーズ1: 基本機能実装
- プロジェクトセットアップ
- 認証システム実装
- 基本UI実装
- YouTube情報取得機能実装

### フェーズ2: コア機能実装
- アーティスト管理機能実装
- タクソノミー管理機能実装
- WordPress DB連携実装

### フェーズ3: 拡張機能実装
- Spotify連携機能
- 検索・フィルタリング機能
- バッチ処理機能

### フェーズ4: テスト・デバッグ
- 単体テスト
- 統合テスト
- セキュリティテスト

## 7. 運用・保守

### 7.1 監視項目
- システムログ
- エラーログ
- パフォーマンスメトリクス

### 7.2 バックアップ
- データベースバックアップ
- 設定ファイルバックアップ

## 8. 今後の拡張性

### 8.1 予定機能
- オフライン対応
- バッチ処理機能
- 自動タグ付け
- アーティスト情報自動補完

### 8.2 将来的な検討事項
- マルチプラットフォーム対応
- API提供
- 外部サービス連携 