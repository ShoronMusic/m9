'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import styles from './SessionRecoveryIndicator.module.css';

export default function SessionRecoveryIndicator({ 
  isRecovering, 
  onManualRecovery, 
  onDismiss,
  onReLogin
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [showManualOption, setShowManualOption] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [timeoutId, setTimeoutId] = useState(null);

  // 自動復旧のタイムアウト処理（30秒）
  useEffect(() => {
    if (isRecovering && !showManualOption) {
      const timeout = setTimeout(() => {
        setShowManualOption(true);
      }, 30000); // 30秒でタイムアウト
      
      setTimeoutId(timeout);
      
      return () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    }
  }, [isRecovering, showManualOption]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  if (!isRecovering || !isVisible) {
    return null;
  }

  const handleManualRecovery = async () => {
    if (onManualRecovery && !isRetrying) {
      setIsRetrying(true);
      setRetryCount(prev => prev + 1);
      
      try {
        const success = await onManualRecovery();
        if (success) {
          setIsVisible(false);
        } else {
          setShowManualOption(true);
        }
      } catch (error) {
        console.error('Manual recovery failed:', error);
        setShowManualOption(true);
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const handleReLogin = () => {
    if (onReLogin) {
      onReLogin();
    } else {
      // デフォルトの再ログイン処理
      signIn('spotify', { callbackUrl: window.location.href });
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>🔄</div>
        <div className={styles.message}>
          <div className={styles.title}>セッションを復旧中...</div>
          <div className={styles.description}>
            Spotifyログインの状態を確認しています。しばらくお待ちください。
          </div>
        </div>
        <div className={styles.actions}>
          {!showManualOption && (
            <button 
              onClick={handleManualRecovery}
              className={styles.manualRecoveryButton}
            >
              手動復旧
            </button>
          )}
          <button 
            onClick={handleDismiss}
            className={styles.dismissButton}
          >
            ✕
          </button>
        </div>
      </div>
      
      {showManualOption && (
        <div className={styles.manualOption}>
          <div className={styles.manualMessage}>
            自動復旧に失敗しました。手動で復旧を試行するか、再ログインしてください。
            {retryCount > 0 && (
              <div className={styles.retryInfo}>
                （再試行回数: {retryCount}回）
              </div>
            )}
          </div>
          <div className={styles.manualActions}>
            <button 
              onClick={handleManualRecovery}
              className={styles.retryButton}
              disabled={isRetrying}
            >
              {isRetrying ? '復旧中...' : '再試行'}
            </button>
            <button 
              onClick={handleReLogin}
              className={styles.reLoginButton}
            >
              Spotifyログイン
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
