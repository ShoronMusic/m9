# Music8 アプリケーション仕様書

## 更新履歴
- 2024-05-03: 初版作成
- 2024-05-03: デプロイエラー情報を追加

## 1. 基本情報
- フレームワーク: Next.js 13.5.6
- ルーティング方式: App Router
- デプロイ環境: Vercel

## 2. アプリケーション構造
### 2.1 ディレクトリ構成
```
app/
├── components/     # 共通コンポーネント
├── config/        # 設定ファイル
├── css/          # スタイルシート
├── lib/          # ユーティリティ
├── services/     # サービス層
├── styles/       # スタイルページ
├── [slug]/      # 動的ルート
├── page.jsx      # トップページ
├── layout.js     # ルートレイアウト
└── globals.css   # グローバルスタイル
```

### 2.2 主要コンポーネント
- `Layout`: ページレイアウト
- `SongList`: 曲リスト表示（※デプロイ時にエラー発生）
- `YouTubePlayer`: 動画プレーヤー
- `ScrollToTopButton`: ページトップへ戻るボタン

## 3. データ管理
### 3.1 データ取得方式
- 静的JSONファイルを使用
- 配置場所: `public/data/`
- 取得方法: クライアントサイドで`axios`を使用

### 3.2 データ処理
- アーティスト情報の整形
- スタイル情報の抽出
- プレイリストの管理

## 4. スタイル管理
### 4.1 CSS構成
- CSS Modulesを使用
- グローバルスタイル: `app/globals.css`
- コンポーネント固有のスタイル: `*.module.css`

## 5. エラーハンドリング
- `not-found.tsx`: 404ページ
- エラーメッセージコンポーネント

## 6. 設定管理
### 6.1 アプリケーション設定
- `app/config.js`: アプリケーション設定
- `next.config.js`: Next.js設定

## 7. ページ構成
### 7.1 主要ページ
- トップページ: `app/page.jsx`
- クライアントコンポーネント: `app/TopPageClient.jsx`
- スタイルページ: `app/styles/page.js`
- 動的ページ: `app/[slug]/page.jsx`

## 8. 依存関係
### 8.1 主要パッケージ
- `react`: 18.2.0
- `next`: 13.5.6
- `axios`: データ取得
- `@emotion/react`: スタイリング
- `@mui/material`: UIコンポーネント
- `firebase`: バックエンドサービス

## 9. 開発環境
### 9.1 開発ツール
- Node.js
- npm
- Git

### 9.2 開発コマンド
```bash
npm run dev    # 開発サーバー起動
npm run build  # ビルド
npm run start  # 本番サーバー起動
```

## 10. 既知の問題
### 10.1 デプロイエラー
- プリレンダリングエラー:
  - パス: `/styles/alternative/[id]`
  - エラー内容: コンポーネントの型が無効
  - 影響コンポーネント: `SongList`
  - エラーメッセージ: `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object`

### 10.2 修正が必要な箇所
1. `SongList`コンポーネントの実装
2. `onPageEnd`関数の型定義
3. プリレンダリング時のコンポーネント初期化処理 