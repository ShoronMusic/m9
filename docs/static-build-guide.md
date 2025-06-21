# 静的HTMLビルドガイド

## 概要
このドキュメントでは、Next.js 14.1以前のプロジェクトの静的HTMLビルドプロセスについて説明します。

## ビルド要件
- すべての静的ファイルを指定フォルダに収納
- Webサーバーにそのままアップロード可能な状態で出力
- ビルドプロセスの詳細なログ記録
- エラー発生時の対応と継続性の確保

## ビルド設定

### 環境設定
```bash
# 必要な環境変数
NODE_ENV=production
NEXT_PUBLIC_API_URL=your_api_url
```

### next.config.js の設定
```javascript
module.exports = {
  images: {
    unoptimized: true  // 画像の最適化を無効化（静的出力用）
  },
  distDir: 'build'  // ビルド出力ディレクトリの指定
}
```

## ビルドスクリプト

以下のスクリプトを `scripts/build.js` として作成することを推奨します：

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ビルドログの保存先
const LOG_DIR = path.join(process.cwd(), 'logs');
const BUILD_LOG = path.join(LOG_DIR, `build-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// ログディレクトリの作成
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ログ書き込み関数
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(BUILD_LOG, logMessage);
  console.log(message);
};

async function build() {
  const startTime = new Date();
  log('ビルド開始');

  try {
    // ビルドディレクトリのクリーン
    log('ビルドディレクトリのクリーン中...');
    execSync('npm run clean', { stdio: 'inherit' });

    // 依存関係のインストール
    log('依存関係のインストール中...');
    execSync('npm install', { stdio: 'inherit' });

    // Next.jsビルドの実行
    log('Next.jsビルドの実行中...');
    execSync('next build', { stdio: 'inherit' });

    // 静的ファイルのエクスポート
    log('静的ファイルのエクスポート中...');
    execSync('next export -o out', { stdio: 'inherit' });

    const endTime = new Date();
    const buildTime = (endTime - startTime) / 1000;
    log(`ビルド完了 (所要時間: ${buildTime}秒)`);

  } catch (error) {
    log('エラーが発生しました:');
    log(error.message);
    process.exit(1);
  }
}

build();
```

## エラーハンドリング

### エラーログの形式
エラーログは以下の情報を含みます：
- タイムスタンプ
- エラーの種類
- エラーメッセージ
- スタックトレース
- 影響を受けたページのパス

### 失敗したページの記録
ビルド失敗時のページは `logs/failed-pages.json` に記録されます：

```json
{
  "timestamp": "2024-03-21T10:00:00Z",
  "failedPages": [
    {
      "path": "/path/to/page",
      "error": "エラーの詳細"
    }
  ]
}
```

## ビルド成果物

### 出力ディレクトリ構造
```
out/
├── _next/      # 静的アセット
├── images/     # 画像ファイル
├── api/        # 静的APIエンドポイント
└── index.html  # メインページ
```

注意：Next.js 14.1以前では、`next build`の後に`next export`コマンドを実行する必要があります。

### デプロイメント
生成された `out` ディレクトリの内容をそのままWebサーバーにアップロードすることで、サイトを公開できます。

## トラブルシューティング

### よくあるエラーと解決方法
1. メモリ不足エラー
   - NODE_OPTIONS="--max-old-space-size=4096" の設定を追加

2. 画像最適化エラー
   - next.config.js の images.unoptimized を true に設定

3. 動的ルートのエラー
   - getStaticPaths の実装を確認
   - fallback の設定を確認

## 注意事項
- ビルド前にキャッシュをクリアすることを推奨
- 大規模サイトの場合、ビルドを分割することを検討
- 定期的なビルドログの整理を実施 