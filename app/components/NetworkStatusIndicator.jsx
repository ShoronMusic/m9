'use client';

import { useState, useEffect } from 'react';
import styles from './NetworkStatusIndicator.module.css';

export default function NetworkStatusIndicator({ 
  isOnline, 
  onRetry,
  showOfflineMessage = true 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // ネットワーク状態が変更されたときに表示/非表示を制御
  useEffect(() => {
    if (!isOnline) {
      setIsVisible(true);
      // オフライン状態が続く場合は5秒後に詳細表示を有効化
      const timer = setTimeout(() => {
        setShowDetails(true);
      }, 5000);
      
      return () => clearTimeout(timer);
    } else {
      // オンラインに戻った場合は少し待ってから非表示
      const timer = setTimeout(() => {
        setIsVisible(false);
        setShowDetails(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // 手動で非表示にする
  const handleDismiss = () => {
    setIsVisible(false);
    setShowDetails(false);
  };

  // 再試行を実行
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      // デフォルトの再試行処理
      window.location.reload();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`${styles.container} ${isOnline ? styles.online : styles.offline}`}>
      <div className={styles.content}>
        <div className={styles.icon}>
          {isOnline ? '🌐' : '📡'}
        </div>
        <div className={styles.message}>
          <div className={styles.title}>
            {isOnline ? 'ネットワーク接続が復旧しました' : 'ネットワーク接続がありません'}
          </div>
          <div className={styles.description}>
            {isOnline 
              ? 'インターネット接続が正常に復旧しました。' 
              : 'インターネット接続を確認してください。'
            }
          </div>
        </div>
        <div className={styles.actions}>
          {!isOnline && (
            <button 
              onClick={handleRetry}
              className={styles.retryButton}
            >
              再試行
            </button>
          )}
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className={styles.detailsButton}
            aria-label={showDetails ? '詳細を隠す' : '詳細を表示'}
          >
            {showDetails ? '▼' : '▶'}
          </button>
          <button 
            onClick={handleDismiss}
            className={styles.dismissButton}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      </div>
      
      {showDetails && !isOnline && (
        <div className={styles.details}>
          <div className={styles.detailSection}>
            <h4>対処方法</h4>
            <ul>
              <li>Wi-Fi接続を確認してください</li>
              <li>モバイルデータの設定を確認してください</li>
              <li>ルーターの電源を確認してください</li>
              <li>しばらく待ってから再試行してください</li>
            </ul>
          </div>
          
          <div className={styles.detailSection}>
            <h4>現在の状態</h4>
            <div className={styles.statusInfo}>
              <div className={styles.statusItem}>
                <span className={styles.label}>接続状態:</span>
                <span className={`${styles.value} ${styles.offline}`}>オフライン</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.label}>最終確認:</span>
                <span className={styles.value}>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
