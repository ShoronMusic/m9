# エラーログ設定ガイド

## 概要
Vercelサーバーを利用している場合のスマホ利用時のエラーログ保存方法について説明します。

## 推奨される方法

### 1. 外部ログサービスとの連携

#### LogRocket（推奨）
- **特徴**: セッションリプレイ、エラートラッキング、パフォーマンス監視
- **料金**: 無料プランあり、月額$99から
- **設定**:
  ```bash
  npm install logrocket
  ```
  ```javascript
  import LogRocket from 'logrocket';
  LogRocket.init('your_app_id');
  ```

#### Sentry（推奨）
- **特徴**: エラートラッキング、パフォーマンス監視、リリース管理
- **料金**: 無料プランあり、月額$26から
- **設定**:
  ```bash
  npm install @sentry/nextjs
  ```

#### Axiom
- **特徴**: 高速ログ分析、SQLクエリ対応
- **料金**: 無料プランあり、月額$25から

### 2. 実装済みの機能

#### エラーログAPI (`/api/log-error`)
- クライアントからのエラーログを受信
- 複数のログサービスに同時送信
- オフライン対応（キューイング）

#### エラーロガー (`/lib/errorLogger.js`)
- クライアントサイドのエラーログ収集
- デバイス情報の自動取得
- オフライン時のキューイング
- セッション管理

#### 統合エラーハンドラー
- 既存の`useErrorHandler`に自動ログ送信機能を追加
- エラータイプ別の分類
- 重要度別の処理

## 設定手順

### 1. 環境変数の設定
```bash
# .env.local に追加
LOGROCKET_APP_ID=your_logrocket_app_id
LOGROCKET_API_KEY=your_logrocket_api_key
SENTRY_DSN=your_sentry_dsn
AXIOM_DATASET=your_axiom_dataset
AXIOM_API_TOKEN=your_axiom_api_token
```

### 2. ログサービスのアカウント作成
1. LogRocket: https://logrocket.com/
2. Sentry: https://sentry.io/
3. Axiom: https://axiom.co/

### 3. デプロイ
```bash
vercel env add LOGROCKET_APP_ID
vercel env add LOGROCKET_API_KEY
vercel env add SENTRY_DSN
vercel env add AXIOM_DATASET
vercel env add AXIOM_API_TOKEN
```

## 使用方法

### 基本的な使用方法
```javascript
import errorLogger from '@/lib/errorLogger';

// エラーログの送信
try {
  // 何らかの処理
} catch (error) {
  errorLogger.logError(error, {
    errorType: 'user_action_error',
    severity: 'error',
    context: { action: 'like_toggle' }
  });
}
```

### 認証エラーのログ
```javascript
errorLogger.logAuthError(error, {
  context: { action: 'token_refresh' }
});
```

### ネットワークエラーのログ
```javascript
errorLogger.logNetworkError(error, {
  context: { endpoint: '/api/spotify/likes' }
});
```

## ログデータの構造

```javascript
{
  timestamp: "2024-01-01T00:00:00.000Z",
  message: "Error message",
  stack: "Error stack trace",
  url: "https://example.com/page",
  userId: "user123",
  sessionId: "session_1234567890_abc123",
  deviceInfo: {
    userAgent: "Mozilla/5.0...",
    isMobile: true,
    isTablet: false,
    screenWidth: 375,
    screenHeight: 667,
    viewportWidth: 375,
    viewportHeight: 667,
    language: "ja-JP",
    platform: "iPhone",
    cookieEnabled: true,
    onLine: true
  },
  errorType: "auth_error",
  severity: "warning",
  context: {
    action: "token_refresh",
    pageTitle: "TuneDive - Music Discovery",
    referrer: "https://example.com/previous"
  }
}
```

## 注意事項

1. **プライバシー**: ユーザー情報を含むログは適切に匿名化する
2. **料金**: ログサービスの料金プランを確認する
3. **データ保持**: ログデータの保持期間を設定する
4. **GDPR対応**: 欧州ユーザーのデータ保護に注意する

## トラブルシューティング

### ログが送信されない場合
1. ネットワーク接続を確認
2. 環境変数が正しく設定されているか確認
3. ログサービスのAPIキーが有効か確認
4. ブラウザのコンソールでエラーを確認

### オフライン時の動作
- エラーログはローカルストレージに保存される
- オンライン復帰時に自動送信される
- 送信失敗時は再試行される
