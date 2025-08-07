'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePlayer } from '../components/PlayerContext';
import styles from './MyPage.module.css';

export default function MyPageClient({ session }) {
  const { data: sessionData } = useSession();
  const { currentTrack, trackList, isPlaying } = usePlayer();
  const [playHistory, setPlayHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPlayTime: 0,
    uniqueTracks: 0,
    completedTracks: 0,
    totalPlays: 0
  });

  // 視聴履歴を取得
  useEffect(() => {
    const fetchPlayHistory = async () => {
      if (!session) return;
      
      try {
        const response = await fetch('/api/play-history');
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched play history data:', data);
          setPlayHistory(data.playHistory || []);
          setStats(data.stats || {});
        }
      } catch (error) {
        console.error('Failed to fetch play history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayHistory();
  }, [session]);

  // 時間フォーマット関数
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    }
    return `${minutes}分`;
  };

  // 日付フォーマット関数
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}.${month}.${day} (${weekday})`;
  };

  // 視聴履歴の詳細表示
  const renderPlayHistoryDetails = () => {
    if (playHistory.length === 0) {
      return (
        <div className={styles.noHistory}>
          <p>まだ視聴履歴がありません</p>
          <p>曲を再生すると、ここに履歴が表示されます</p>
        </div>
      );
    }

    return (
      <div className={styles.historyDetails}>
        <h4>視聴履歴</h4>
        <div className={styles.historyTable}>
          <div className={styles.historyHeader}>
            <span>通しNO</span>
            <span>視聴開始タイム</span>
            <span>アーティスト</span>
            <span>タイトル</span>
            <span>お気に入り</span>
          </div>
          {playHistory.map((record, index) => (
            <div key={record.id} className={styles.historyRow}>
              <span className={styles.recordNumber}>
                {String(index + 1).padStart(3, '0')}
              </span>
              <span className={styles.recordTime}>
                {formatDate(record.created_at)} [{String(new Date(record.created_at).getHours()).padStart(2, '0')}:{String(new Date(record.created_at).getMinutes()).padStart(2, '0')}]
              </span>
              <span className={styles.recordArtist}>
                {record.artist_name || 'Unknown Artist'}
              </span>
              <span className={styles.recordTitle}>
                {record.track_title || 'Unknown Track'}
              </span>
              <span className={styles.recordFavorite}>
                {record.completed ? '♥' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Spotifyユーザー情報
  const user = session?.user || sessionData?.user;
  const spotifyProfile = user?.image ? (
    <div className={styles.profileSection}>
      <img 
        src={user.image} 
        alt="Profile" 
        className={styles.profileImage}
      />
      <div className={styles.profileInfo}>
        <h2>{user.name}</h2>
        <p className={styles.email}>{user.email}</p>
      </div>
    </div>
  ) : null;

  // 現在再生中の曲
  const currentPlaying = currentTrack ? (
    <div className={styles.currentPlaying}>
      <h3>🎵 現在再生中</h3>
      <div className={styles.trackInfo}>
        <img 
          src={currentTrack.thumbnail || '/placeholder.jpg'} 
          alt="Album" 
          className={styles.albumArt}
        />
        <div className={styles.trackDetails}>
          <h4>{typeof currentTrack.title === 'string' ? currentTrack.title : (typeof currentTrack.title?.rendered === 'string' ? currentTrack.title.rendered : (currentTrack.name || 'Unknown Track'))}</h4>
          <p>{currentTrack.artist || currentTrack.artistName}</p>
          <div className={styles.playStatus}>
            {isPlaying ? '▶️ 再生中' : '⏸️ 一時停止'}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className={styles.noPlaying}>
      <h3>🎵 現在再生中の曲はありません</h3>
      <p>トップページやスタイルページで曲を再生してみてください</p>
    </div>
  );

  // 視聴履歴（将来的に実装）
  const playHistorySection = (
    <div className={styles.playHistory}>
      <h3>📊 視聴履歴</h3>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h4>総視聴時間</h4>
          <p className={styles.statValue}>{formatDuration(stats.totalPlayTime)}</p>
        </div>
        <div className={styles.statCard}>
          <h4>視聴した曲数</h4>
          <p className={styles.statValue}>{stats.uniqueTracks}曲</p>
        </div>
        <div className={styles.statCard}>
          <h4>お気に入り</h4>
          <p className={styles.statValue}>{stats.completedTracks}曲</p>
        </div>
      </div>
      {renderPlayHistoryDetails()}
      <p className={styles.comingSoon}>※ 視聴履歴機能は今後実装予定です</p>
    </div>
  );

  // アカウント設定
  const accountSettings = (
    <div className={styles.accountSettings}>
      <h3>⚙️ アカウント設定</h3>
      <div className={styles.settingsList}>
        <div className={styles.settingItem}>
          <span>Spotify連携</span>
          <span className={styles.status}>✅ 連携済み</span>
        </div>
        <div className={styles.settingItem}>
          <span>通知設定</span>
          <span className={styles.status}>🔔 有効</span>
        </div>
        <div className={styles.settingItem}>
          <span>プライバシー</span>
          <span className={styles.status}>🔒 標準</span>
        </div>
      </div>
      <button 
        onClick={() => signOut({ callbackUrl: '/' })}
        className={styles.signOutButton}
      >
        ログアウト
      </button>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>マイページ</h1>
        <p>Spotifyアカウントでログイン中</p>
      </div>

      {spotifyProfile}
      
      <div className={styles.content}>
        {currentPlaying}
        
        {playHistorySection}
        
        {accountSettings}
      </div>
    </div>
  );
}
