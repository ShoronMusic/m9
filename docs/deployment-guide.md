# Music8.jp デプロイメントガイド

## 開発環境

### 必要なツール
- Next.js
- Cursor または VS Code
- Git
- Node.js
- npm または yarn

### 開発環境のセットアップ
1. リポジトリのクローン
```bash
git clone [repository-url]
cd [project-directory]
```

2. 依存関係のインストール
```bash
npm install
# または
yarn install
```

3. 開発サーバーの起動
```bash
npm run dev
# または
yarn dev
```
- 開発サーバーは `localhost:3000` で起動
- コードの変更は自動的に反映

## バージョン管理

### GitHubでの管理
1. 変更のコミット
```bash
git add .
git commit -m "変更内容の説明"
```

2. リモートリポジトリへのプッシュ
```bash
git push origin main
```

## ビルドとデプロイ

### 静的ファイルの生成
1. ビルドの実行
```bash
npm run build
npm run export
```
- `out` ディレクトリに静的ファイルが生成

### Xserverへのデプロイ
1. FTP/SFTPクライアントの設定
   - ホスト: [Xserverのホスト名]
   - ユーザー名: [FTPユーザー名]
   - パスワード: [FTPパスワード]

2. ファイルのアップロード
   - `out` ディレクトリの内容を全てアップロード
   - 既存ファイルは上書き

### ドメイン設定
1. DNS設定の変更
   - `www.music8.jp` のAレコードをXserverのIPアドレスに更新
   - 変更の反映には最大48時間かかる場合あり

2. SSL証明書の設定
   - XserverのコントロールパネルでSSL設定
   - Let's Encryptの無料SSL証明書を使用推奨

## 定期更新の仕組み

### WordPressでの更新
1. 通常通りLightsailのWordPressで新曲を登録
2. メタデータや画像のアップロード

### 定期ビルドとデプロイ
1. スケジュール設定
   - 毎日深夜に自動ビルドとデプロイを実行
   - GitHub Actionsを使用して自動化可能

2. 手動での更新が必要な場合
```bash
# ビルド
npm run build
npm run export

# デプロイ
# FTP/SFTPでoutディレクトリの内容をアップロード
```

## 設定ファイル

### .htaccess設定
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    
    # キャッシュ設定
    <FilesMatch "\.(html|css|js|jpg|jpeg|png|gif|webp)$">
        Header set Cache-Control "max-age=31536000, public"
    </FilesMatch>
    
    # 404ページ
    ErrorDocument 404 /404.html
</IfModule>
```

## 注意事項

### バックアップ
- 定期的なバックアップの実施
- 重要なファイルのバックアップコピーの保持

### パフォーマンス最適化
- 画像の最適化
- キャッシュ設定の確認
- CDNの活用

### セキュリティ
- 定期的なセキュリティアップデート
- アクセス権限の適切な設定
- SSL証明書の有効期限管理

### トラブルシューティング
1. ビルドエラー
   - エラーメッセージの確認
   - 依存関係の更新
   - メモリ使用量の確認

2. デプロイエラー
   - FTP接続の確認
   - ファイル権限の確認
   - ディスク容量の確認

## 連絡先
- 技術サポート: [連絡先情報]
- 緊急連絡先: [連絡先情報] 