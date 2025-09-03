'use client';

import { useState, useEffect } from 'react';
import styles from './SpotifyErrorHandler.module.css';

export default function SpotifyErrorHandler({ 
  error, 
  isLoading, 
  retryCount, 
  maxRetries, 
  onRetry, 
  onClearError,
  onReLogin 
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // SpotifyエラーをAxiomに送信
  useEffect(() => {
    if (error) {
      const logSpotifyError = async () => {
        try {
          await fetch('/api/mobile-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              level: 'error',
              type: 'spotify_api_error',
              message: `Spotify APIエラー: ${error}`,
              details: {
                errorMessage: error,
                retryCount,
                maxRetries,
                timestamp: new Date().toISOString(),
                url: typeof window !== 'undefined' ? window.location.href : '',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                isAuthError: error.includes('認証エラー') || error.includes('再ログイン'),
                isRateLimitError: error.includes('レート制限'),
              }
            })
          });
        } catch (logError) {
          console.error('Failed to log Spotify error:', logError);
        }
      };

      logSpotifyError();
    }
  }, [error, retryCount, maxRetries]);

  if (!error) {
    return null;
  }

  const isAuthError = error.includes('認証エラー') || error.includes('再ログイン');
  const isRateLimitError = error.includes('レート制限');
  const isRetryable = !isAuthError && retryCount < maxRetries;

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleClearError = () => {
    if (onClearError) {
      onClearError();
    }
  };

  const handleReLogin = () => {
    if (onReLogin) {
      onReLogin();
    }
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorHeader}>
        <div className={styles.errorIcon}>
          {isAuthError ? '🔐' : isRateLimitError ? '⏰' : '⚠️'}
        </div>
        <div className={styles.errorContent}>
          <div className={styles.errorTitle}>
            {isAuthError ? 'Spotifyログインが必要です' : 'エラーが発生しました'}
          </div>
          <div className={styles.errorMessage}>{error}</div>
          {retryCount > 0 && (
            <div className={styles.retryInfo}>
              リトライ回数: {retryCount}/{maxRetries}
            </div>
          )}
        </div>
        <div className={styles.errorActions}>
          {isRetryable && (
            <button 
              onClick={handleRetry}
              className={styles.retryButton}
              disabled={isLoading}
            >
              {isLoading ? '処理中...' : '再試行'}
            </button>
          )}
          {isAuthError && (
            <button 
              onClick={handleReLogin}
              className={styles.reLoginButton}
            >
              再ログイン
            </button>
          )}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={styles.expandButton}
            aria-label={isExpanded ? '詳細を隠す' : '詳細を表示'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <button 
            onClick={handleClearError}
            className={styles.clearButton}
            aria-label="エラーをクリア"
          >
            ✕
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles.errorDetails}>
          <div className={styles.detailSection}>
            <h4>エラーの詳細</h4>
            <p>{error}</p>
          </div>
          
          {isRetryable && (
            <div className={styles.detailSection}>
              <h4>対処方法</h4>
              <ul>
                <li>ネットワーク接続を確認してください</li>
                <li>しばらく待ってから再試行してください</li>
                <li>問題が続く場合はページを再読み込みしてください</li>
              </ul>
            </div>
          )}
          
          {isAuthError && (
            <div className={styles.detailSection}>
              <h4>認証について</h4>
              <ul>
                <li>Spotifyアカウントにログインしてください</li>
                <li>権限の許可が必要です</li>
                <li>セッションが期限切れの可能性があります</li>
              </ul>
            </div>
          )}
          
          {isRateLimitError && (
            <div className={styles.detailSection}>
              <h4>レート制限について</h4>
              <ul>
                <li>Spotify APIの利用制限に達しています</li>
                <li>しばらく待ってから再試行してください</li>
                <li>通常は数分で回復します</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
