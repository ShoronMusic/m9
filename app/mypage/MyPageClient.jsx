'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePlayer } from '../components/PlayerContext';
import { useSpotifyLikes } from '../components/SpotifyLikes';
import Link from 'next/link';
import styles from './MyPage.module.css';

export default function MyPageClient({ session }) {
  const { data: sessionData } = useSession();
  const { currentTrack, trackList, isPlaying } = usePlayer();
  const [playHistory, setPlayHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [supabaseTest, setSupabaseTest] = useState(null);
  
  // ページネーション用の状態
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Spotify APIからお気に入り情報を取得
  const trackIds = playHistory.map(record => record.track_id).filter(Boolean);
  const { likedTracks, error: likesError } = useSpotifyLikes(session?.accessToken, trackIds);

  // ページネーション計算
  const totalPages = Math.ceil(playHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = playHistory.slice(startIndex, endIndex);

  // ページ変更ハンドラー
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // ページネーションコンポーネント
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 最初のページ
    if (startPage > 1) {
      pages.push(
        <button
          key="first"
          onClick={() => handlePageChange(1)}
          className={styles.pageButton}
        >
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(<span key="dots1" className={styles.pageDots}>...</span>);
      }
    }

    // 表示するページ
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`${styles.pageButton} ${currentPage === i ? styles.activePage : ''}`}
        >
          {i}
        </button>
      );
    }

    // 最後のページ
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="dots2" className={styles.pageDots}>...</span>);
      }
      pages.push(
        <button
          key="last"
          onClick={() => handlePageChange(totalPages)}
          className={styles.pageButton}
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div className={styles.pagination}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={styles.pageButton}
        >
          ← 前へ
        </button>
        
        <div className={styles.pageNumbers}>
          {pages}
        </div>
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={styles.pageButton}
        >
          次へ →
        </button>
        
        <div className={styles.pageInfo}>
          {startIndex + 1}-{Math.min(endIndex, playHistory.length)} / {playHistory.length}件
        </div>
      </div>
    );
  };

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
        
        // フロントエンドでも重複フィルタリングを実行
        const rawHistory = data.playHistory || [];
        const filteredHistory = [];
        const seenTracks = new Set();
        
        for (const record of rawHistory) {
          const trackKey = `${record.track_id || record.song_id}`;
          
          if (!seenTracks.has(trackKey)) {
            filteredHistory.push(record);
            seenTracks.add(trackKey);
          }
        }
        
        console.log('Filtered play history:', {
          original: rawHistory.length,
          filtered: filteredHistory.length
        });
        
        setPlayHistory(filteredHistory);
        setStats(data.stats || {});
        setDebugInfo({
          hasData: filteredHistory.length > 0,
          dataCount: filteredHistory.length,
          hasStats: !!data.stats,
          responseStatus: response.status,
          originalCount: rawHistory.length,
          filteredCount: filteredHistory.length
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

  // データが更新された時にページを1ページ目に戻す
  useEffect(() => {
    setCurrentPage(1);
  }, [playHistory.length]);

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

  // タイトル表示用の関数（JSON文字列を処理）
  const formatTrackTitle = (title) => {
    if (!title) return 'Unknown Track';
    
    // 文字列の場合
    if (typeof title === 'string') {
      // JSON文字列の場合を処理
      try {
        const parsed = JSON.parse(title);
        if (parsed && typeof parsed === 'object' && parsed.rendered) {
          return parsed.rendered;
        }
      } catch (e) {
        // JSONとして解析できない場合はそのまま返す
        return title;
      }
      return title;
    }
    
    // オブジェクトの場合
    if (typeof title === 'object' && title.rendered) {
      return title.rendered;
    }
    
    return 'Unknown Track';
  };

  // スタイル表示用の関数（色分け付き）
  const formatStyle = (styleName) => {
    if (!styleName) return 'Unknown';
    
    // スタイルごとの色を定義（アーティストページのStyle Breakdownと同じ）
    const styleColorMap = {
      'Pop': '#f25042',
      'Alternative': '#448aca',
      'Dance': '#f39800',
      'Electronica': '#ffd803',
      'R&B': '#8c7851',
      'Hip-Hop': '#078080',
      'Rock': '#6246ea',
      'Metal': '#9646ea',
      'Others': '#BDBDBD'
    };
    
    const color = styleColorMap[styleName] || '#BDBDBD';
    
    return (
      <span 
        style={{
          backgroundColor: color,
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          display: 'inline-block',
          textShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }}
      >
        {styleName}
      </span>
    );
  };

  // ソース表示用の関数（リンク付き）
  const formatSource = (source) => {
    if (!source) return 'unknown';
    
    // artist/形式の場合
    if (source.startsWith('artist/')) {
      const artistSlug = source.replace('artist/', '');
      // undefinedを含む場合や無効なスラッグの場合はリンクを表示しない
      if (artistSlug && artistSlug !== 'undefined' && !artistSlug.includes('undefined')) {
        return (
          <Link href={`/${artistSlug}/1`} className={styles.sourceLink}>
            {source}
          </Link>
        );
      }
    }
    
    // その他の場合はそのまま表示
    return source;
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
            // 重複フィルタリング情報
            originalCount: debugInfo.originalCount,
            filteredCount: debugInfo.filteredCount,
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

  // 日付ごとにグループ化されたデータを生成
  const generateGroupedData = (data) => {
    const grouped = [];
    let currentDate = null;
    
    data.forEach((entry, index) => {
      const entryDate = new Date(entry.created_at).toDateString();
      
      // 新しい日付の場合は日付セパレーターを追加
      if (entryDate !== currentDate) {
        currentDate = entryDate;
        const dateObj = new Date(entry.created_at);
        const formattedDate = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dateObj.getDay()];
        
        grouped.push({
          type: 'date-separator',
          date: formattedDate,
          dayOfWeek: dayOfWeek,
          id: `date-${entryDate}`
        });
      }
      
      // エントリーを追加
      grouped.push({
        type: 'entry',
        data: entry,
        originalIndex: index
      });
    });
    
    return grouped;
  };

  // 現在のページのグループ化されたデータ
  const currentPageGroupedData = generateGroupedData(currentPageData);


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
                  <th>スタイル</th>
                  <th>ソース</th>
                  <th>お気に入り</th>
                </tr>
              </thead>
              <tbody>
                {currentPageGroupedData.map((item, index) => (
                  item.type === 'date-separator' ? (
                    <tr key={item.id}>
                      <td colSpan="7" className={styles.dateSeparator}>
                        <span>{item.date} ({item.dayOfWeek})</span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.data.id}>
                      <td>{(startIndex + item.originalIndex + 1).toString().padStart(3, '0')}</td>
                      <td>{formatDate(item.data.created_at)}</td>
                      <td>{item.data.artist_name || 'Unknown Artist'}</td>
                      <td>{formatTrackTitle(item.data.track_title)}</td>
                      <td>{formatStyle(item.data.style_name)}</td>
                      <td>{formatSource(item.data.source)}</td>
                      <td>
                        {(item.data.is_favorite || likedTracks.has(item.data.track_id)) && (
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
                  )
                ))}
              </tbody>
            </table>
            {renderPagination()}
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
