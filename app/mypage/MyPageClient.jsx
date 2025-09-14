'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePlayer } from '../components/PlayerContext';
import { useSpotifyLikes } from '../components/SpotifyLikes';
import { getUserPlaylists } from '../lib/supabase';
import Link from 'next/link';
import PlaylistFilters from '../playlists/PlaylistFilters';
import styles from './MyPage.module.css';

// CloudinaryのベースURL（正しい形式）
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

// Cloudinaryに存在しない画像のキャッシュ
const cloudinaryNotFoundCache = new Set();
// WebP形式も存在しない画像のキャッシュ
const webpNotFoundCache = new Set();

// JPG/PNG URLをWebP URLに変換する関数
function convertToWebPUrl(originalUrl) {
  if (!originalUrl) return originalUrl;
  
  // ファイル拡張子を取得
  const lastDotIndex = originalUrl.lastIndexOf('.');
  if (lastDotIndex === -1) return originalUrl;
  
  const extension = originalUrl.substring(lastDotIndex + 1).toLowerCase();
  
  // JPG/JPEG/PNGの場合はWebPに変換
  if (['jpg', 'jpeg', 'png'].includes(extension)) {
    const webpUrl = originalUrl.substring(0, lastDotIndex) + '.webp';
    console.log('🖼️ MyPageClient - Converting to WebP:', {
      original: originalUrl,
      webp: webpUrl
    });
    return webpUrl;
  }
  
  // 既にWebPの場合はそのまま返す
  return originalUrl;
}

// サムネイルURLを取得する関数（SongList.jsと同じロジック）
function getThumbnailUrl(track) {
  if (track.thumbnail) {
    const fileName = track.thumbnail.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return track.thumbnail;
      }
      return convertToWebPUrl(track.thumbnail);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  if (track.featured_media_url) {
    const fileName = track.featured_media_url.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return track.featured_media_url;
      }
      return convertToWebPUrl(track.featured_media_url);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  // YouTube IDからサムネイルを生成
  if (track.youtubeId) {
    return `https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg`;
  }
  
  return '/placeholder.jpg';
}

export default function MyPageClient({ session }) {
  const { data: sessionData } = useSession();
  const { currentTrack, trackList, isPlaying, playlistUpdateTrigger, triggerPlaylistUpdate } = usePlayer();
  const [playHistory, setPlayHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [supabaseTest, setSupabaseTest] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState('name'); // 'name' または 'date'
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' または 'list'
  const [filteredPlaylists, setFilteredPlaylists] = useState([]); // フィルタリング後のプレイリスト
  
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

  // プレイリスト一覧を取得する関数（TuneDive Supabase仕様）
  const fetchPlaylists = useCallback(async () => {
    if (!session?.user?.id) {
      console.log('🔍 MyPageClient - No session user ID, skipping playlist fetch');
      return;
    }
    
    console.log('🔍 MyPageClient - Fetching playlists from TuneDive Supabase API');
    console.log('🔍 MyPageClient - Session info:', {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      provider: session.user.provider
    });
    
    setPlaylistsLoading(true);
    try {
      // TuneDiveのSupabase APIエンドポイントを使用
      const response = await fetch('/api/playlists', {
        headers: {
          'Authorization': `Bearer ${session.accessToken || session.id}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 MyPageClient - API Response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      if (response.ok) {
        const data = await response.json();
        const playlistsData = data.playlists || [];
        
        console.log('🔍 MyPageClient - Playlists data:', {
          count: playlistsData.length,
          playlists: playlistsData.map(p => ({
            id: p.id,
            name: p.name,
            track_count: p.track_count,
            updated_at: p.updated_at,
            is_public: p.is_public
          }))
        });
        
        setPlaylists(playlistsData);
        setFilteredPlaylists(playlistsData); // フィルタリング結果を初期化
      } else {
        console.error('🔍 MyPageClient - Failed to fetch playlists:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('🔍 MyPageClient - Error details:', errorData);
      }
    } catch (error) {
      console.error('🔍 MyPageClient - Error fetching playlists:', error);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [session?.user?.id, session?.accessToken, session?.id]);

  // フィルタリング結果を更新する関数
  const handleFilterChange = useCallback((filteredData) => {
    setFilteredPlaylists(filteredData);
    setCurrentPage(1); // フィルタリング後は1ページ目に戻す
    
    // フィルタリング結果のプレイリストのスタイル背景も更新
    if (filteredData.length > 0) {
      // スタイル背景は削除
    }
  }, []);

  // プレイリストを並び替える関数
  const sortPlaylists = useCallback((playlists, order) => {
    if (!playlists || playlists.length === 0) return playlists;
    
    const sortedPlaylists = [...playlists];
    
    if (order === 'name') {
      // 名前順（昇順）
      sortedPlaylists.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'ja');
      });
    } else if (order === 'date') {
      // 更新日順（新しい順）
      sortedPlaylists.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0);
        const dateB = new Date(b.updated_at || b.created_at || 0);
        return dateB - dateA;
      });
    }
    
    return sortedPlaylists;
  }, []);

  // 並び替え順序を変更する関数
  const handleSortChange = useCallback((newOrder) => {
    setSortOrder(newOrder);
    // フィルタリング結果を並び替え
    const sorted = sortPlaylists(filteredPlaylists, newOrder);
    setFilteredPlaylists(sorted);
  }, [sortPlaylists, filteredPlaylists]);

  // 表示モードを切り替える関数
  const handleDisplayModeChange = useCallback((newMode) => {
    setDisplayMode(newMode);
  }, []);

  // プレイリスト作成後の処理
  const handlePlaylistCreated = useCallback((newPlaylist) => {
    // プレイリスト一覧を更新
    fetchPlaylists();
    // プレイリスト更新トリガーを発火
    triggerPlaylistUpdate();
  }, [fetchPlaylists, triggerPlaylistUpdate]);

  // プレイリストに曲が追加された後の処理
  const handleTrackAdded = useCallback((track, playlistId) => {
    // プレイリスト一覧を更新
    fetchPlaylists();
    // プレイリスト更新トリガーを発火
    triggerPlaylistUpdate();
  }, [fetchPlaylists, triggerPlaylistUpdate]);

  // プレイリスト一覧を初期化時に取得
  useEffect(() => {
    if (session?.user?.id) {
      fetchPlaylists();
    }
  }, [session?.user?.id, fetchPlaylists]);

  // プレイリスト更新トリガーの監視
  useEffect(() => {
    if (playlistUpdateTrigger > 0) {
      // プレイリスト一覧を更新
      fetchPlaylists();
    }
  }, [playlistUpdateTrigger, fetchPlaylists]);

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
      const response = await fetch('/api/play-history');
      
      if (response.ok) {
        const data = await response.json();
        
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
      const response = await fetch('/api/spotify-likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackId: entry.track_id,
          isLiked: newFavoriteState,
        }),
      });

      if (response.ok) {
        // お気に入り状態を更新
        setPlayHistory(prev => 
          prev.map(record => 
            record.id === entryId 
              ? { ...record, is_favorite: newFavoriteState }
              : record
          )
        );
      } else {
        console.error('Failed to update favorite status');
        alert('お気に入りの更新に失敗しました');
      }
    } catch (error) {
      console.error('Error updating favorite status:', error);
      alert('お気に入りの更新でエラーが発生しました');
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

  // プレイリスト用の日付フォーマット関数（プレイリスト詳細ページと同じ形式）
  const formatPlaylistDate = (dateString) => {
    if (!dateString) return '不明';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '不明';
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}.${month}.${day}`;
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
    
    // playlist: 形式の場合（プレイリスト名|ID）
    if (source.startsWith('playlist: ')) {
      const parts = source.split('|');
      if (parts.length === 2) {
        const playlistName = parts[0].replace('playlist: ', '');
        const playlistId = parts[1];
        return (
          <Link href={`/playlists/${playlistId}`} className={styles.sourceLink}>
            {`playlist: ${playlistName}`}
          </Link>
        );
      }
    }
    
    // playlist/形式の場合（古い形式、UUIDのみ）
    if (source.startsWith('playlist/')) {
      const playlistId = source.replace('playlist/', '');
      // UUIDの形式チェック（基本的な形式）
      if (playlistId && playlistId.length > 20) {
        return (
          <Link href={`/playlists/${playlistId}`} className={styles.sourceLink}>
            {`playlist: ${playlistId.substring(0, 8)}...`}
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
          src={getThumbnailUrl(currentTrack)} 
          alt="Album" 
          className={styles.albumArt}
          onError={(e) => {
            console.log('🖼️ MyPageClient - Image load error:', {
              failedUrl: e.target.src,
              trackId: currentTrack.id,
              trackTitle: currentTrack.title?.rendered || currentTrack.title,
              hasTriedOriginal: e.target.dataset.triedOriginal,
              hasTriedWebP: e.target.dataset.triedWebP
            });

            if (!e.target.dataset.triedOriginal) { // First attempt (Cloudinary failed)
              e.target.dataset.triedOriginal = "1";
              if (e.target.src.includes('cloudinary.com')) {
                const fileName = e.target.src.split("/").pop();
                cloudinaryNotFoundCache.add(fileName);
                console.log('🖼️ MyPageClient - Added to not found cache:', fileName);
              }
              const src = currentTrack.thumbnail || currentTrack.featured_media_url;
              if (src) {
                const webpUrl = convertToWebPUrl(src);
                console.log('🖼️ MyPageClient - Trying WebP URL (99% success rate):', webpUrl);
                e.target.src = webpUrl;
              }
            } else if (!e.target.dataset.triedWebP) { // Second attempt (WebP failed)
              e.target.dataset.triedWebP = "1";
              if (e.target.src.includes('.webp')) {
                const fileName = e.target.src.split("/").pop();
                webpNotFoundCache.add(fileName);
                console.log('🖼️ MyPageClient - Added to WebP not found cache (1% case):', fileName);
              }
              const src = currentTrack.thumbnail || currentTrack.featured_media_url;
              if (src) {
                console.log('🖼️ MyPageClient - Trying original URL as last resort:', src);
                e.target.src = src;
              }
            } else { // All attempts failed
              console.log('🖼️ MyPageClient - Falling back to placeholder');
              e.target.onerror = null;
              e.target.src = '/placeholder.jpg';
            }
          }}
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



  // アカウント設定セクション（統合認証対応）
  const accountSettings = (
    <div className={styles.settingsCard}>
      <h3>アカウント設定</h3>
      <div className={styles.settingItem}>
        <span>
          {session?.user?.provider === 'google' ? 'Google連携' : 'Spotify連携'}
        </span>
        <span className={styles.settingValue}>連携済み</span>
      </div>
      <div className={styles.settingItem}>
        <span>認証プロバイダー</span>
        <span className={styles.settingValue}>
          {session?.user?.provider === 'google' ? 'Google' : 'Spotify'}
        </span>
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
        <p>
          {session?.user?.provider === 'google' 
            ? 'Googleアカウントでログイン中' 
            : 'Spotifyアカウントでログイン中'
          }
        </p>
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

      {/* プレイリストコーナー */}
      <div className={styles.playlistsCard}>
        <div className={styles.playlistsHeader}>
          <h3>マイプレイリスト</h3>
          <div className={styles.playlistsControls}>
            <div className={styles.sortButtons}>
              <button
                onClick={() => handleSortChange('name')}
                className={`${styles.sortButton} ${sortOrder === 'name' ? styles.sortButtonActive : ''}`}
              >
                名前順
              </button>
              <button
                onClick={() => handleSortChange('date')}
                className={`${styles.sortButton} ${sortOrder === 'date' ? styles.sortButtonActive : ''}`}
              >
                更新日順
              </button>
            </div>
            <div className={styles.displayModeButtons}>
              <button
                onClick={() => handleDisplayModeChange('grid')}
                className={`${styles.displayModeButton} ${displayMode === 'grid' ? styles.displayModeButtonActive : ''}`}
                title="ボタン表示"
              >
                <span className={styles.displayModeIcon}>⊞</span>
              </button>
              <button
                onClick={() => handleDisplayModeChange('list')}
                className={`${styles.displayModeButton} ${displayMode === 'list' ? styles.displayModeButtonActive : ''}`}
                title="行表示"
              >
                <span className={styles.displayModeIcon}>☰</span>
              </button>
            </div>
            <button 
              onClick={fetchPlaylists}
              className={styles.refreshButton}
              disabled={playlistsLoading}
            >
              {playlistsLoading ? '更新中...' : 'プレイリスト更新'}
            </button>
          </div>
        </div>
        
        {/* フィルタリングコンポーネント */}
        {playlists && playlists.length > 0 && (
          <PlaylistFilters 
            playlists={playlists} 
            onFilterChange={handleFilterChange}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
          />
        )}
        
        {/* プレイリスト数表示 */}
        <div style={{ 
          textAlign: 'center', 
          margin: '10px 0', 
          color: '#666',
          fontSize: '14px'
        }}>
          {filteredPlaylists.length === playlists.length 
            ? `すべてのプレイリストを表示中 (${playlists.length}件)`
            : `フィルタリング結果: ${filteredPlaylists.length}件 / 全${playlists.length}件`
          }
        </div>
        
        {playlistsLoading ? (
          <div className={styles.loading}>プレイリストを読み込み中...</div>
        ) : filteredPlaylists && filteredPlaylists.length > 0 ? (
          displayMode === 'grid' ? (
            <div className={styles.playlistsGrid}>
              {sortPlaylists(filteredPlaylists, sortOrder).map((playlist) => (
                <Link 
                  href={`/playlists/${playlist.id}`} 
                  key={playlist.id}
                  className={styles.playlistItem}
                >
                  <div className={styles.playlistCover}>
                    {playlist.cover_image_url ? (
                      <img 
                        src={playlist.cover_image_url} 
                        alt={playlist.name}
                        className={styles.playlistImage}
                      />
                    ) : (
                      <div 
                        className={styles.playlistPlaceholder}
                        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      >
                        <span>🎵</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.playlistInfo}>
                    <h4 className={styles.playlistName}>{playlist.name}</h4>
                    
                    {/* 年とタグの表示 */}
                    <div className={styles.playlistMetadata}>
                      {playlist.year && (
                        <span className={`${styles.metadataItem} ${styles.year}`}>
                          {playlist.year}
                        </span>
                      )}
                      {playlist.tags && (
                        <span className={`${styles.metadataItem} ${styles.tag}`}>
                          {playlist.tags}
                        </span>
                      )}
                    </div>
                    
                    <p className={styles.playlistStats}>
                      {playlist.track_count || 0}曲 • {formatPlaylistDate(playlist.updated_at || playlist.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.playlistsList}>
              {sortPlaylists(filteredPlaylists, sortOrder).map((playlist) => (
                <Link 
                  href={`/playlists/${playlist.id}`} 
                  key={playlist.id}
                  className={styles.playlistListItem}
                >
                  <div className={styles.playlistCover}>
                    {playlist.cover_image_url ? (
                      <img 
                        src={playlist.cover_image_url} 
                        alt={playlist.name}
                        className={styles.playlistImage}
                      />
                    ) : (
                      <div 
                        className={styles.playlistPlaceholder}
                        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      >
                        <span>🎵</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.playlistListInfo}>
                    <div className={styles.playlistListTitle}>
                      {playlist.name}
                    </div>
                    
                    {/* 年とタグの表示 */}
                    <div className={styles.playlistListMetadata}>
                      {playlist.year && (
                        <span className={`${styles.metadataItem} ${styles.year}`}>
                          {playlist.year}
                        </span>
                      )}
                      {playlist.tags && (
                        <span className={`${styles.metadataItem} ${styles.tag}`}>
                          {playlist.tags}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.playlistListRight}>
                    <div className={styles.playlistListTrackCount}>
                      {playlist.track_count || 0}曲 • {formatPlaylistDate(playlist.updated_at || playlist.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className={styles.noPlaylists}>
            {filteredPlaylists.length === 0 && playlists.length > 0 ? (
              <>
                <p>フィルター条件に一致するプレイリストがありません</p>
                <p>フィルターを変更するか、リセットしてください</p>
              </>
            ) : (
              <>
                <p>プレイリストがありません</p>
                <p>曲の三点メニューからプレイリストを作成してみてください</p>
                <p>または、既存のプレイリストに曲を追加することもできます</p>
              </>
            )}
          </div>
        )}
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
