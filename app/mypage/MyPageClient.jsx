'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePlayer } from '../components/PlayerContext';
import { useSpotifyLikes } from '../components/SpotifyLikes';
import styles from './MyPage.module.css';

export default function MyPageClient({ session }) {
  const { data: sessionData } = useSession();
  const { currentTrack, trackList, isPlaying } = usePlayer();
  const [playHistory, setPlayHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [supabaseTest, setSupabaseTest] = useState(null);

  // Spotify APIからお気に入り情報を取得
  const trackIds = playHistory.map(record => record.track_id).filter(Boolean);
  const { likedTracks, error: likesError } = useSpotifyLikes(session?.accessToken, trackIds);

  // Supabase接続テスト
  const testSupabaseConnection = async () => {
    try {
      const response = await fetch('/api/test-supabase');
      if (response.ok) {
        const data = await response.json();
        setSupabaseTest(data);
        console.log('Supabase test result:', data);
      } else {
        setSupabaseTest({ error: `HTTP ${response.status}` });
      }
    } catch (error) {
      setSupabaseTest({ error: error.message });
    }
  };

  // 視聴履歴を取得
  const fetchPlayHistory = async () => {
    if (!session) return;
    
    try {
      console.log('Fetching play history for user:', session.user.id);
      const response = await fetch('/api/play-history');
      console.log('Play history response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched play history data:', data);
        setPlayHistory(data.playHistory || []);
        setStats(data.stats || {});
        setDebugInfo({
          hasData: data.playHistory?.length > 0,
          dataCount: data.playHistory?.length || 0,
          hasStats: !!data.stats,
          responseStatus: response.status
        });
      } else {
        console.error('Failed to fetch play history:', response.status, response.statusText);
        setDebugInfo({
          error: true,
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      console.error('Failed to fetch play history:', error);
      setDebugInfo({
        error: true,
          errorMessage: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayHistory();
    
    // 定期的に視聴履歴を更新（30秒ごと）
    const interval = setInterval(fetchPlayHistory, 30000);
    
    return () => clearInterval(interval);
  }, [session]);

  // 視聴履歴を手動で更新
  const refreshPlayHistory = useCallback(async () => {
    await fetchPlayHistory();
  }, [session]);

  // テスト記録機能
  const testRecordPlayHistory = async () => {
    console.log('Testing play history recording...');
    try {
      const response = await fetch('/api/test-play-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: 'test-track-id',
          song_id: 999999,
          play_duration: 45,
          completed: true,
          source: 'test',
          artist_name: 'CABLE, Rezz',
          track_title: 'Glass Veins'
        })
      });
      
      const result = await response.json();
      console.log('Test play history result:', result);
      
      if (result.success) {
        alert('テスト記録が成功しました！');
        await fetchPlayHistory(); // 履歴を更新
      } else {
        alert(`テスト記録が失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error('Test record error:', error);
      alert('テスト記録でエラーが発生しました');
    }
  };

  // お気に入り切り替え機能
  const handleFavoriteToggle = async (entryId, newFavoriteState) => {
    console.log('Favorite toggle clicked:', { entryId, newFavoriteState, trackId: playHistory.find(e => e.id === entryId)?.track_id });
    
    if (!session?.accessToken) {
      alert('Spotifyにログインしてください');
      return;
    }

    try {
      const entry = playHistory.find(e => e.id === entryId);
      if (!entry?.track_id) {
        alert('トラックIDが見つかりません');
        return;
      }

      // Spotify APIを使用してお気に入りを切り替え
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${entry.track_id}`, {
        method: newFavoriteState ? 'PUT' : 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Spotify API response status:', response.status);
      
      if (response.ok) {
        console.log('Spotify favorite status updated successfully');
        // ローカル状態はSpotifyLikesフックが自動的に更新する
      } else {
        const errorData = await response.json();
        console.error('Failed to update Spotify favorite status:', errorData);
        alert(`お気に入り更新に失敗しました: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating favorite status:', error);
      alert('お気に入り更新でエラーが発生しました');
    }
  };

  // 日付フォーマット関数
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const day = days[date.getDay()];
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const dayOfMonth = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${date.getFullYear()}.${month}.${dayOfMonth} (${day}) [${hours}:${minutes}]`;
  };

  // 再生時間フォーマット関数
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分`;
  };

  // デバッグ情報を表示
  const renderDebugInfo = () => {
    if (!debugInfo) return null;
    
    return (
      <div className={styles.debugInfo}>
        <h4>デバッグ情報</h4>
        <pre style={{ fontSize: '12px', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
          {JSON.stringify({
            hasData: debugInfo.hasData,
            dataCount: debugInfo.dataCount,
            hasStats: debugInfo.hasStats,
            responseStatus: debugInfo.responseStatus,
            error: debugInfo.error,
            status: debugInfo.status,
            errorMessage: debugInfo.errorMessage,
            // 追加: track_idとlikedTracksの詳細
            trackIds: trackIds,
            likedTracksSize: likedTracks.size,
            likedTracksArray: Array.from(likedTracks),
            playHistoryTrackIds: playHistory.map(record => ({
              id: record.id,
              track_id: record.track_id,
              artist_name: record.artist_name,
              track_title: record.track_title,
              isLiked: likedTracks.has(record.track_id)
            }))
          }, null, 2)}
        </pre>
      </div>
    );
  };

  // 視聴履歴の詳細表示
  const renderPlayHistoryDetails = () => {
    if (isLoading) {
      return (
        <div className={styles.noHistory}>
          <p>視聴履歴を読み込み中...</p>
        </div>
      );
    }

    if (playHistory.length === 0) {
      return (
        <div className={styles.noHistory}>
          <p>まだ視聴履歴がありません</p>
          <p>曲を再生すると、ここに履歴が表示されます</p>
          {debugInfo.error && (
            <p style={{ color: 'red', fontSize: '12px' }}>
              エラー: {debugInfo.errorMessage || `HTTP ${debugInfo.status}`}
            </p>
          )}
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
                {(record.is_favorite || likedTracks.has(record.track_id)) && (
                  <img
                    src="/svg/heart-solid.svg"
                    alt="Favorite"
                    style={{ 
                      width: "14px", 
                      height: "14px",
                      filter: "invert(27%) sepia(51%) saturate(2878%) hue-rotate(86deg) brightness(104%) contrast(97%)"
                    }}
                  />
                )}
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
          <p className={styles.statValue}>{formatDuration(stats?.totalPlayTime || 0)}</p>
        </div>
        <div className={styles.statCard}>
          <h4>視聴した曲数</h4>
          <p className={styles.statValue}>{stats?.uniqueTracks || 0}曲</p>
        </div>
        <div className={styles.statCard}>
          <h4>お気に入り</h4>
          <p className={styles.statValue}>{stats?.completedTracks || 0}曲</p>
        </div>
      </div>
      {renderPlayHistoryDetails()}
      {renderDebugInfo()}
      <p className={styles.comingSoon}>※ 視聴履歴機能は今後実装予定です</p>
    </div>
  );

  // アカウント設定セクション
  const accountSettings = (
    <div className={styles.settingsCard}>
      <h3>アカウント設定</h3>
      <div className={styles.settingItem}>
        <span>Spotify連携</span>
        <span className={styles.settingValue}>連携済み</span>
      </div>
      <div className={styles.settingItem}>
        <span>通知設定</span>
        <span className={styles.settingValue}>有効</span>
      </div>
      <div className={styles.settingItem}>
        <span>プライバシー</span>
        <span className={styles.settingValue}>標準</span>
      </div>
      <button onClick={() => signOut()} className={styles.logoutButton}>
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

      {/* ユーザープロフィール */}
      <div className={styles.profileCard}>
        <div className={styles.profileInfo}>
          <div className={styles.profileImage}>
            <img src={session?.user?.image || '/images/default-avatar.png'} alt="Profile" />
          </div>
          <div className={styles.profileDetails}>
            <h3>{session?.user?.name || 'ユーザー'}</h3>
            <p>{session?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* 視聴履歴サマリー */}
      {stats && (
        <div className={styles.statsCard}>
          <h3>視聴履歴サマリー</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>総視聴時間</span>
              <span className={styles.statValue}>{formatDuration(stats?.totalPlayTime || 0)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>視聴した曲数</span>
              <span className={styles.statValue}>{stats?.uniqueTracks || 0}曲</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>お気に入り</span>
              <span className={styles.statValue}>{stats?.completedTracks || 0}曲</span>
            </div>
          </div>
        </div>
      )}

      {/* 視聴履歴テーブル */}
      <div className={styles.historyCard}>
        <div className={styles.historyHeader}>
          <h3>視聴履歴</h3>
          <button 
            onClick={refreshPlayHistory}
            className={styles.refreshButton}
            disabled={isLoading}
          >
            {isLoading ? '更新中...' : '視聴履歴更新'}
          </button>
        </div>
        
        {isLoading ? (
          <div className={styles.loading}>視聴履歴を読み込み中...</div>
        ) : playHistory && playHistory.length > 0 ? (
          <div className={styles.tableContainer}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>通しNO</th>
                  <th>視聴開始タイム</th>
                  <th>アーティスト</th>
                  <th>タイトル</th>
                  <th>再生時間</th>
                  <th>完了</th>
                  <th>ソース</th>
                  <th>お気に入り</th>
                </tr>
              </thead>
              <tbody>
                {playHistory.map((entry, index) => (
                  <tr key={entry.id}>
                    <td>{(index + 1).toString().padStart(3, '0')}</td>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{entry.artist_name || 'Unknown Artist'}</td>
                    <td>{entry.track_title || 'Unknown Track'}</td>
                    <td>{entry.play_duration}秒</td>
                    <td>{entry.completed ? '完了' : '中断'}</td>
                    <td>{entry.source || 'unknown'}</td>
                    <td>
                      {(entry.is_favorite || likedTracks.has(entry.track_id)) && (
                        <img
                          src="/svg/heart-solid.svg"
                          alt="Favorite"
                          style={{ 
                            width: "14px", 
                            height: "14px",
                            filter: "invert(27%) sepia(51%) saturate(2878%) hue-rotate(86deg) brightness(104%) contrast(97%)"
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.noHistory}>
            <p>視聴履歴がありません</p>
            <p>曲を再生すると、ここに履歴が表示されます</p>
          </div>
        )}
      </div>

      {accountSettings}
    </div>
  );
}
