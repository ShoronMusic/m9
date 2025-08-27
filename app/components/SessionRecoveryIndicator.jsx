'use client';

import { useState } from 'react';
import styles from './SessionRecoveryIndicator.module.css';

export default function SessionRecoveryIndicator({ 
  isRecovering, 
  onManualRecovery, 
  onDismiss 
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [showManualOption, setShowManualOption] = useState(false);

  if (!isRecovering || !isVisible) {
    return null;
  }

  const handleManualRecovery = async () => {
    if (onManualRecovery) {
      const success = await onManualRecovery();
      if (success) {
        setIsVisible(false);
      } else {
        setShowManualOption(true);
      }
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
          </div>
          <div className={styles.manualActions}>
            <button 
              onClick={handleManualRecovery}
              className={styles.retryButton}
            >
              再試行
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
