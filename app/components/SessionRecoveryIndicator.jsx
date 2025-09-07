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
    console.log('🔄 SessionRecoveryIndicator: handleManualRecovery called', {
      hasOnManualRecovery: !!onManualRecovery,
      isRetrying,
      retryCount
    });

    if (onManualRecovery && !isRetrying) {
      setIsRetrying(true);
      setRetryCount(prev => prev + 1);
      
      try {
        console.log('🔄 SessionRecoveryIndicator: calling onManualRecovery...');
        const success = await onManualRecovery();
        console.log('🔄 SessionRecoveryIndicator: onManualRecovery result:', success);
        
        if (success) {
          console.log('✅ SessionRecoveryIndicator: Manual recovery successful, hiding banner');
          setIsVisible(false);
        } else {
          console.log('❌ SessionRecoveryIndicator: Manual recovery failed, showing manual option');
          setShowManualOption(true);
        }
      } catch (error) {
        console.error('❌ SessionRecoveryIndicator: Manual recovery error:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setShowManualOption(true);
      } finally {
        setIsRetrying(false);
      }
    } else {
      console.log('⏭️ SessionRecoveryIndicator: Manual recovery skipped', {
        reason: !onManualRecovery ? 'no callback' : 'already retrying'
      });
    }
  };

  const handleReLogin = () => {
    console.log('🔄 SessionRecoveryIndicator: handleReLogin called', {
      hasOnReLogin: !!onReLogin,
      currentUrl: typeof window !== 'undefined' ? window.location.href : 'unknown'
    });

    try {
      if (onReLogin) {
        console.log('🔄 SessionRecoveryIndicator: calling onReLogin callback...');
        onReLogin();
        console.log('✅ SessionRecoveryIndicator: onReLogin callback called successfully');
      } else {
        console.log('🔄 SessionRecoveryIndicator: using default signIn...');
        // デフォルトの再ログイン処理
        signIn('spotify', { callbackUrl: window.location.href });
        console.log('✅ SessionRecoveryIndicator: signIn called successfully');
      }
      console.log('🔄 SessionRecoveryIndicator: hiding banner after re-login');
      setIsVisible(false);
    } catch (error) {
      console.error('❌ SessionRecoveryIndicator: handleReLogin error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
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
