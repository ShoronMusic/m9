'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import styles from './LoginPromptModal.module.css';

export default function LoginPromptModal({ 
  isVisible, 
  onClose, 
  songTitle = 'この曲',
  onLoginSuccess 
}) {
  const [isLoading, setIsLoading] = useState(false);

  // モーダルが表示されている間はスクロールを無効化
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  // モーダルの外側をクリックしたら閉じる
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Spotifyログインを実行
  const handleSpotifyLogin = async () => {
    setIsLoading(true);
    try {
      await signIn('spotify', { callbackUrl: window.location.href });
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // モーダルが非表示の場合は何も表示しない
  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.icon}>🎵</div>
          <h2 className={styles.title}>Spotifyログインが必要です</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.message}>
            <p>
              <strong>{songTitle}</strong> を再生するには、Spotifyアカウントへのログインが必要です。
            </p>
            <p>
              ログインすると、以下の機能が利用できます：
            </p>
            <ul className={styles.features}>
              <li>🎵 曲の再生・一時停止・スキップ</li>
              <li>❤️ お気に入り曲へのいいね</li>
              <li>📱 プレイリストの作成・管理</li>
              <li>🎧 高音質での音楽視聴</li>
            </ul>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.spotifyLoginButton}
            onClick={handleSpotifyLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                ログイン中...
              </>
            ) : (
              <>
                <img 
                  src="/svg/spotify-icon.svg" 
                  alt="Spotify" 
                  className={styles.spotifyIcon}
                />
                Sign in with Spotify
              </>
            )}
          </button>
          
          <button 
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isLoading}
          >
            後で
          </button>
        </div>

        <div className={styles.footerNote}>
          <p>
            初回ログイン時は、Spotifyの利用規約とプライバシーポリシーに同意する必要があります。
          </p>
        </div>
      </div>
    </div>
  );
}
