'use client';

import React from 'react';
import styles from './ErrorBoundary.module.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    };
  }

  static getDerivedStateFromError(error) {
    // エラーが発生した場合、状態を更新
    return { 
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // エラー情報を状態に保存
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // エラーログを記録
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 本番環境では外部のエラー監視サービスに送信
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error, errorInfo) => {
    try {
      // エラー情報を構造化
      const errorData = {
        id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        // 必要に応じてユーザー情報も含める
      };

      // エラー監視サービスに送信（例：Sentry、LogRocket等）
      // 現在はコンソールに出力
      console.group('Error Report');
      console.log('Error ID:', errorData.id);
      console.log('Error Data:', errorData);
      console.groupEnd();

      // 実際の実装では、APIエンドポイントにPOSTリクエストを送信
      // fetch('/api/error-log', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData)
      // });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  };

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    });
  };

  handleReportError = () => {
    if (this.state.error) {
      // エラー報告のためのモーダル表示やフォーム送信
      const errorReport = {
        id: this.state.errorId,
        message: this.state.error.message,
        stack: this.state.error.stack,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };
      
      // エラー報告をクリップボードにコピー
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
        .then(() => {
          alert('エラー情報がクリップボードにコピーされました。サポートチームにお送りください。');
        })
        .catch(() => {
          alert('エラー情報のコピーに失敗しました。');
        });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>⚠️</div>
            <h1 className={styles.errorTitle}>予期しないエラーが発生しました</h1>
            <p className={styles.errorMessage}>
              申し訳ございません。アプリケーションで予期しないエラーが発生しました。
            </p>
            
            <div className={styles.errorDetails}>
              <details>
                <summary>エラーの詳細</summary>
                <div className={styles.errorStack}>
                  <p><strong>エラーメッセージ:</strong> {this.state.error?.message}</p>
                  <p><strong>エラーID:</strong> {this.state.errorId}</p>
                  {process.env.NODE_ENV === 'development' && (
                    <pre className={styles.stackTrace}>
                      {this.state.error?.stack}
                    </pre>
                  )}
                </div>
              </details>
            </div>

            <div className={styles.errorActions}>
              <button 
                onClick={this.handleRetry}
                className={styles.retryButton}
              >
                再試行
              </button>
              <button 
                onClick={this.handleReportError}
                className={styles.reportButton}
              >
                エラーを報告
              </button>
              <button 
                onClick={() => window.location.reload()}
                className={styles.reloadButton}
              >
                ページを再読み込み
              </button>
            </div>

            <div className={styles.errorHelp}>
              <p>問題が解決しない場合は、以下をお試しください：</p>
              <ul>
                <li>ブラウザを再起動する</li>
                <li>キャッシュとクッキーをクリアする</li>
                <li>別のブラウザでアクセスする</li>
                <li>しばらく時間をおいてから再試行する</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
