# モバイルエラー監視システム

## 概要

モバイルでの視聴時に発生する様々なエラーを包括的に記録・分析するためのシステムです。スマートフォンでの視聴時の問題を特定し、原因究明と対応を支援します。

## 主な機能

### 1. 包括的なエラー監視
- **JavaScriptエラー**: 未処理のエラーやPromise拒否を自動検出
- **ネットワーク監視**: 接続状態、品質変化、オフライン状態を追跡
- **パフォーマンス監視**: メモリ使用量、リソース数、読み込み時間を監視
- **デバイス監視**: 画面向き、タッチ機能、バッテリー状態を追跡

### 2. リアルタイムログ記録
- エラー発生時の詳細情報を自動記録
- デバイス情報、ネットワーク状態、パフォーマンス指標を含む
- クライアント側とサーバー側の両方にログを保存

### 3. エラー分析ダッシュボード
- エラーの種類別・重要度別の統計表示
- 時間帯別のエラー発生傾向分析
- 自動的な原因分析と推奨対策の提示
- 詳細なログ検索・フィルタリング機能

### 4. ログ管理・エクスポート
- JSON形式でのログエクスポート
- 古いログの自動クリーンアップ（30日以上前）
- ログの手動クリア機能

## 使用方法

### 基本的な統合

```jsx
import MobileErrorSystem from './components/MobileErrorSystem';

function App() {
  return (
    <MobileErrorSystem
      showDashboard={process.env.NODE_ENV === 'development'}
      enablePerformanceMonitoring={true}
      enableNetworkMonitoring={true}
      enableTouchMonitoring={true}
      enableOrientationMonitoring={true}
      enableBatteryMonitoring={true}
      enableMemoryMonitoring={true}
      logToServer={true}
      maxLogEntries={1000}
      logInterval={5000}
    >
      {/* アプリケーションのメインコンテンツ */}
      <YourAppContent />
    </MobileErrorSystem>
  );
}
```

### カスタムフックの使用

```jsx
import { useMobileErrorMonitor } from './components/useMobileErrorMonitor';

function MyComponent() {
  const {
    logs,
    isMonitoring,
    deviceInfo,
    networkStatus,
    performanceMetrics,
    errorCount,
    warningCount,
    infoCount,
    addLogEntry,
    handleError,
    exportLogs,
    clearLogs
  } = useMobileErrorMonitor({
    enablePerformanceMonitoring: true,
    enableNetworkMonitoring: true,
    logInterval: 5000,
    onError: (logEntry) => {
      console.error('Custom error handler:', logEntry);
    }
  });

  // カスタムエラーログの追加
  const handleCustomError = () => {
    addLogEntry({
      level: 'error',
      type: 'custom_error',
      message: 'カスタムエラーが発生しました',
      details: { customData: 'example' },
      severity: 'high'
    });
  };

  return (
    <div>
      <p>エラー数: {errorCount}</p>
      <p>警告数: {warningCount}</p>
      <button onClick={handleCustomError}>カスタムエラーを発生</button>
      <button onClick={exportLogs}>ログをエクスポート</button>
    </div>
  );
}
```

## 設定オプション

### MobileErrorSystem Props

| プロパティ | 型 | デフォルト | 説明 |
|------------|----|------------|------|
| `showDashboard` | boolean | false | 開発環境でダッシュボードを表示するか |
| `enablePerformanceMonitoring` | boolean | true | パフォーマンス監視を有効にするか |
| `enableNetworkMonitoring` | boolean | true | ネットワーク監視を有効にするか |
| `enableTouchMonitoring` | boolean | true | タッチ機能監視を有効にするか |
| `enableOrientationMonitoring` | boolean | true | 画面向き監視を有効にするか |
| `enableBatteryMonitoring` | boolean | true | バッテリー監視を有効にするか |
| `enableMemoryMonitoring` | boolean | true | メモリ監視を有効にするか |
| `logToServer` | boolean | true | サーバーにログを送信するか |
| `maxLogEntries` | number | 1000 | クライアント側の最大ログ数 |
| `logInterval` | number | 5000 | 監視間隔（ミリ秒） |

### useMobileErrorMonitor Options

| オプション | 型 | デフォルト | 説明 |
|-----------|----|------------|------|
| `enablePerformanceMonitoring` | boolean | true | パフォーマンス監視 |
| `enableNetworkMonitoring` | boolean | true | ネットワーク監視 |
| `enableTouchMonitoring` | boolean | true | タッチ監視 |
| `enableOrientationMonitoring` | boolean | true | 画面向き監視 |
| `enableBatteryMonitoring` | boolean | true | バッテリー監視 |
| `enableMemoryMonitoring` | boolean | true | メモリ監視 |
| `enableErrorReporting` | boolean | true | エラー報告 |
| `logInterval` | number | 5000 | 監視間隔 |
| `maxLogEntries` | number | 1000 | 最大ログ数 |
| `onError` | function | undefined | エラー時のコールバック |
| `onWarning` | function | undefined | 警告時のコールバック |
| `onInfo` | function | undefined | 情報時のコールバック |

## ログの構造

### ログエントリの例

```json
{
  "id": "log_1703123456789_abc123def",
  "level": "error",
  "type": "javascript_error",
  "message": "TypeError: Cannot read property 'length' of undefined",
  "stack": "TypeError: Cannot read property 'length' of undefined\n    at MyComponent (MyComponent.jsx:25:15)",
  "errorInfo": {
    "source": "MyComponent.jsx",
    "lineno": 25,
    "colno": 15
  },
  "severity": "high",
  "timestamp": "2023-12-21T10:30:56.789Z",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X)...",
    "platform": "iPhone",
    "screen": {
      "width": 390,
      "height": 844,
      "orientation": "portrait-primary"
    },
    "window": {
      "innerWidth": 390,
      "innerHeight": 844,
      "devicePixelRatio": 3
    }
  },
  "networkStatus": {
    "online": true,
    "effectiveType": "4g",
    "downlink": 10,
    "rtt": 50
  },
  "performanceMetrics": {
    "memory": {
      "usedJSHeapSize": 52428800,
      "totalJSHeapSize": 104857600,
      "jsHeapSizeLimit": 2147483648
    },
    "resourceCount": 45
  }
}
```

## エラーの種類

### 自動検出されるエラー

1. **JavaScriptエラー**
   - 未処理のエラー
   - Promise拒否
   - 構文エラー

2. **ネットワークエラー**
   - 接続切断
   - 接続品質変化
   - オフライン状態

3. **パフォーマンス警告**
   - メモリ使用量過多
   - リソース数急増
   - 読み込み時間遅延

4. **デバイス警告**
   - バッテリー残量不足
   - 画面向き変化
   - タッチ機能問題

### カスタムエラーの追加

```jsx
// カスタムエラーログの追加
addLogEntry({
  level: 'error',
  type: 'spotify_api_error',
  message: 'Spotify API呼び出しに失敗しました',
  details: {
    endpoint: '/v1/me/playlists',
    statusCode: 401,
    response: 'Unauthorized'
  },
  severity: 'high'
});

// 警告ログの追加
addLogEntry({
  level: 'warning',
  type: 'slow_network',
  message: 'ネットワーク接続が遅いです',
  details: {
    effectiveType: '2g',
    downlink: 0.5,
    rtt: 200
  },
  severity: 'medium'
});

// 情報ログの追加
addLogEntry({
  level: 'info',
  type: 'user_action',
  message: 'ユーザーがプレイリストを作成しました',
  details: {
    playlistName: 'お気に入り',
    trackCount: 15
  },
  severity: 'low'
});
```

## ダッシュボードの使用方法

### 1. 統計サマリー
- 総ログ数、エラー数、警告数、情報数の表示
- エラー率の計算と表示

### 2. エラー分析
- エラーの種類別の分類（ネットワーク、パフォーマンス、認証、デバイス、その他）
- 各カテゴリの発生件数表示

### 3. 推奨対策
- エラーの原因に基づく自動的な対策提案
- 優先度別の対策表示（高、中、低）

### 4. ログ検索・フィルタリング
- レベル別フィルタリング（エラー、警告、情報）
- タイプ別フィルタリング
- キーワード検索
- 時刻順ソート

### 5. ログ詳細表示
- 各ログエントリの詳細情報
- スタックトレース表示
- デバイス情報・パフォーマンス指標の表示

## API エンドポイント

### POST /api/mobile-logs
新しいログエントリを保存

### GET /api/mobile-logs
保存されたログを取得（フィルタリング・ページネーション対応）

### DELETE /api/mobile-logs?action=clear
すべてのログをクリア

### DELETE /api/mobile-logs?action=cleanup
30日以上前の古いログをクリーンアップ

## 開発環境での使用

開発環境では、以下の機能が自動的に有効になります：

1. **コントロールパネル**: 左上に表示される監視状態と操作ボタン
2. **ダッシュボード**: エラー分析とログ表示
3. **デバッグ情報**: コンソールへの詳細ログ出力

## 本番環境での設定

本番環境では、以下の設定を推奨します：

```jsx
<MobileErrorSystem
  showDashboard={false}
  logToServer={true}
  maxLogEntries={500}
  logInterval={10000}
  enableBatteryMonitoring={false} // プライバシー配慮
>
  {/* アプリケーション */}
</MobileErrorSystem>
```

## トラブルシューティング

### よくある問題

1. **ログが記録されない**
   - ブラウザのコンソールでエラーメッセージを確認
   - ネットワーク接続を確認
   - APIエンドポイントの動作確認

2. **パフォーマンスが低下する**
   - `logInterval`を増加（例：10000ms）
   - 不要な監視機能を無効化
   - `maxLogEntries`を減少

3. **メモリ使用量が増加する**
   - 定期的なログクリアを実行
   - 古いログの自動クリーンアップを有効化

### デバッグ方法

```jsx
// デバッグモードの有効化
const {
  logs,
  isMonitoring,
  deviceInfo
} = useMobileErrorMonitor({
  onError: (logEntry) => {
    console.group('🔴 Mobile Error');
    console.log('Entry:', logEntry);
    console.log('Device Info:', logEntry.deviceInfo);
    console.log('Network Status:', logEntry.networkStatus);
    console.groupEnd();
  }
});

// ログの手動確認
console.log('Current logs:', logs);
console.log('Monitoring status:', isMonitoring);
console.log('Device info:', deviceInfo);
```

## 今後の拡張予定

1. **リアルタイム通知**: 重要なエラーのSlack/Teams通知
2. **エラー予測**: 機械学習によるエラー発生予測
3. **自動復旧**: 一部のエラーの自動復旧機能
4. **パフォーマンス最適化**: 監視のオーバーヘッド削減
5. **多言語対応**: 英語・中国語等の多言語サポート

## サポート

システムに関する質問や問題がございましたら、開発チームまでお問い合わせください。

