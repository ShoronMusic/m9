'use client';

import React from 'react';
import { ERROR_TYPES } from './useErrorHandler';
import styles from './SpotifyPlaybackErrorDisplay.module.css';

export default function SpotifyPlaybackErrorDisplay({ 
  songData, 
  errors = [], 
  onResolve 
}) {
  // Spotify関連のエラーをフィルタリング
  const spotifyErrors = errors.filter(error => 
    error.type === ERROR_TYPES.SPOTIFY || 
    error.message.includes('Spotify') ||
    error.message.includes('Premium') ||
    error.message.includes('再生エラー') ||
    error.message.includes('曲の再生に失敗')
  );

  // エラーが存在し、Spotify Track IDがある場合のみ表示
  if (spotifyErrors.length === 0 || !songData?.spotifyTrackId) {
    return null;
  }

  // エラーを閉じる処理
  const handleResolve = () => {
    if (onResolve) {
      spotifyErrors.forEach(error => onResolve(error.id));
    }
  };

  const spotifyTrackId = songData.spotifyTrackId;
  const spotifyUrl = `https://open.spotify.com/track/${spotifyTrackId}`;
  const spotifyWebUrl = `https://open.spotify.com/track/${spotifyTrackId}?go=1&nd=1`;

  const handleRetry = () => {
    window.location.reload();
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleCopyTrackId = () => {
    navigator.clipboard.writeText(spotifyTrackId);
    alert('Spotify Track IDをコピーしました');
  };

  const handleOpenSpotify = () => {
    window.open(spotifyUrl, '_blank');
  };

  const handleOpenSpotifyWeb = () => {
    window.open(spotifyWebUrl, '_blank');
  };

  return (
    <div className={styles.container}>
      <div className={styles.errorIcon}>×</div>
      <div className={styles.errorContent}>
        <div className={styles.errorTitle}>
          再生エラーが発生しました
        </div>
        
        <div className={styles.errorMessage}>
          {spotifyErrors.map((error, index) => (
            <div key={error.id || index} className={styles.errorItem}>
              {error.message}
            </div>
          ))}
        </div>

        <div className={styles.spotifyInfo}>
          <div className={styles.infoTitle}>
            曲のIDが正しいかどうか確認するために
          </div>
          
          <div className={styles.trackIdSection}>
            <div className={styles.trackIdLabel}>
              Spotify Track ID:
            </div>
            <div className={styles.trackIdValue}>
              <code className={styles.trackIdCode}>{spotifyTrackId}</code>
              <button 
                className={styles.copyButton}
                onClick={handleCopyTrackId}
                title="Track IDをコピー"
              >
                📋
              </button>
            </div>
          </div>

          <div className={styles.linksSection}>
            <div className={styles.linksTitle}>
              確認用リンク:
            </div>
            <div className={styles.links}>
              <button 
                className={styles.spotifyButton}
                onClick={handleOpenSpotify}
                title="Spotifyアプリで開く"
              >
                🎵 Spotifyアプリで開く
              </button>
              <button 
                className={styles.spotifyWebButton}
                onClick={handleOpenSpotifyWeb}
                title="Spotify Webで開く"
              >
                🌐 Spotify Webで開く
              </button>
            </div>
          </div>
        </div>

        <div className={styles.possibleCauses}>
          <div className={styles.causesTitle}>
            考えられる原因:
          </div>
          <ul className={styles.causesList}>
            <li>Spotify Premiumアカウントでログインしているか確認してください</li>
            <li>ブラウザでポップアップがブロックされていないか確認してください</li>
            <li>Spotifyアプリで再生中の曲がある場合は停止してください</li>
            <li>Chrome、Firefox、Safariの最新版を使用してください</li>
            <li>上記のリンクで曲が正しく表示されるか確認してください</li>
          </ul>
        </div>

        <div className={styles.errorActions}>
          <button 
            className={styles.retryButton} 
            onClick={handleRetry}
          >
            🔄 再試行
          </button>
          <button 
            className={styles.reloadButton} 
            onClick={handleReload}
          >
            📄 ページを再読み込み
          </button>
          <button 
            className={styles.closeButton} 
            onClick={handleResolve}
          >
            ✕ エラーを閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
