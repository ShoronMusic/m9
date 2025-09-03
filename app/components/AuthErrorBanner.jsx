'use client';

import { useState, useEffect } from 'react';
import styles from './AuthErrorBanner.module.css';

export default function AuthErrorBanner({ error, onReLogin, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);

  // SpotifyログインエラーをAxiomに送信
  useEffect(() => {
    if (error && isVisible) {
      const logAuthError = async () => {
        try {
          await fetch('/api/mobile-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              level: 'error',
              type: 'spotify_auth_error',
              message: `Spotifyログインエラー: ${error}`,
              details: {
                errorMessage: error,
                timestamp: new Date().toISOString(),
                url: typeof window !== 'undefined' ? window.location.href : '',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                component: 'AuthErrorBanner',
              }
            })
          });
        } catch (logError) {
          console.error('Failed to log auth error:', logError);
        }
      };

      logAuthError();
    }
  }, [error, isVisible]);

  if (!error || !isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleReLogin = () => {
    if (onReLogin) {
      onReLogin();
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.icon}>⚠️</div>
        <div className={styles.message}>
          <div className={styles.title}>Spotifyログインが必要です</div>
          <div className={styles.description}>{error}</div>
        </div>
        <div className={styles.actions}>
          <button 
            onClick={handleReLogin}
            className={styles.reLoginButton}
          >
            再ログイン
          </button>
          <button 
            onClick={handleDismiss}
            className={styles.dismissButton}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
