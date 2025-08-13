'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import styles from './PlaylistDetail.module.css';
import PlaylistSongList from './PlaylistSongList';

export default function PlaylistDetail({ playlist, tracks, session, autoPlayFirst = false }) {
  const { data: clientSession } = useSession();
  const [userPlaylists, setUserPlaylists] = useState([]);


  // 日付フォーマット関数
  const formatPlaylistDate = (dateString) => {
    if (!dateString) return '不明';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '不明';
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}.${month}.${day}`;
  };

  // ユーザーのプレイリスト一覧を取得
  const fetchUserPlaylists = useCallback(async () => {
    try {
      const response = await fetch('/api/playlists');
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error('プレイリスト取得エラー:', err);
    }
  }, []);

  // 次のプレイリストに移動する関数
  const handlePlaylistEnd = () => {
    const currentIndex = userPlaylists.findIndex(p => p.id === playlist.id);
    if (currentIndex !== -1 && currentIndex < userPlaylists.length - 1) {
      const nextPlaylist = userPlaylists[currentIndex + 1];
      window.location.href = `/playlists/${nextPlaylist.id}?autoplay=1`;
    } else {
      console.log('プレイリストの最後に到達しました');
    }
  };









  // トラック削除
  const handleRemoveTrack = async (trackId) => {
    if (!confirm('この曲をプレイリストから削除しますか？')) return;

    try {
      const response = await fetch(`/api/playlists/${playlist.id}/tracks/${trackId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('トラックの削除に失敗しました');
      }

      // ページをリロードして変更を反映
      window.location.reload();
    } catch (err) {
      console.error('トラックの削除に失敗しました:', err.message);
    }
  };



  // コンポーネントマウント時にプレイリスト一覧を取得
  useEffect(() => {
    if (session?.user) {
      fetchUserPlaylists();
    }
  }, [session, fetchUserPlaylists]);

  if (!session?.user) {
    return <div className={styles.notLoggedIn}>ログインが必要です</div>;
  }

  if (!playlist) {
    return <div className={styles.notFound}>プレイリストが見つかりません</div>;
  }

  return (
    <div className={styles.container}>
      {/* プレイリストヘッダー */}
      <div className={styles.playlistHeader}>
        <div className={styles.playlistInfo}>
          <div className={styles.playlistLabel}>Playlist:</div>
          <h1 className={styles.playlistTitle}>{playlist.name}</h1>
          <div className={styles.createdBy}>
            Created by {playlist.users?.spotify_display_name || playlist.created_by || 'Unknown User'}
          </div>
          <div className={styles.meta}>
            <span className={styles.lastUpdated}>
              Update: {formatPlaylistDate(playlist.updated_at || playlist.created_at)}
            </span>
            <span className={styles.visibility}>
              {playlist.is_public ? '公開' : '非公開'}
            </span>
          </div>
          {playlist.description && (
            <p className={styles.description}>{playlist.description}</p>
          )}
        </div>
        
        <div className={styles.playlistActions}>
          <button className={styles.editButton}>編集</button>
          <button className={styles.shareButton}>共有</button>
        </div>
      </div>

      {/* トラックリスト */}
      {tracks.length === 0 ? (
        <div className={styles.emptyState}>
          トラックがありません。曲を追加してください。
        </div>
      ) : (
        <PlaylistSongList
          tracks={tracks}
          playlistId={playlist.id}
          accessToken={session?.accessToken}
          source={`playlist/${playlist.id}`}
          onPageEnd={handlePlaylistEnd}
          autoPlayFirst={autoPlayFirst}
        />
      )}
      

    </div>
  );
}