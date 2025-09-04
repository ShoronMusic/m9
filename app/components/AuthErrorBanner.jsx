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
          // 画面の可視性状態を取得
          const isPageVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
          
          // オーディオ要素の状態を取得
          const audioElements = typeof document !== 'undefined' ? document.querySelectorAll('audio, video') : [];
          const audioState = Array.from(audioElements).map((audio, index) => ({
            index,
            paused: audio.paused,
            currentTime: audio.currentTime,
            duration: audio.duration,
            readyState: audio.readyState,
            networkState: audio.networkState,
            error: audio.error ? audio.error.message : null
          }));
          
          // セッションストレージの状態を取得
          const sessionState = {
            hasSpotifyAuthError: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('spotify_auth_error') === 'true' : false,
            hasSpotifyDeviceError: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('spotify_device_error') === 'true' : false,
            hasSpotifyToken: typeof sessionStorage !== 'undefined' ? !!sessionStorage.getItem('spotify_token') : false
          };
          
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
                // 追加の診断情報
                isPageVisible,
                audioElements: audioState,
                sessionState,
                screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
                screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
                viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
                viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
                isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
                platform: typeof navigator !== 'undefined' ? navigator.platform : '',
                language: typeof navigator !== 'undefined' ? navigator.language : '',
                online: typeof navigator !== 'undefined' ? navigator.onLine : true
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
