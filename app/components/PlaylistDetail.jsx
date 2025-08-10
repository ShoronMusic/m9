'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './PlaylistDetail.module.css';
import CreatePlaylistModal from './CreatePlaylistModal';

export default function PlaylistDetail({ playlistId }) {
  const { data: session } = useSession();
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedTrack, setDraggedTrack] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);

  // プレイリスト情報とトラックを取得
  const fetchPlaylistData = async () => {
    try {
      setLoading(true);
      
      // プレイリスト情報を取得
      const playlistResponse = await fetch(`/api/playlists/${playlistId}`);
      if (!playlistResponse.ok) {
        throw new Error('プレイリストの取得に失敗しました');
      }
      const playlistData = await playlistResponse.json();
      setPlaylist(playlistData.playlist);

      // トラック一覧を取得
      const tracksResponse = await fetch(`/api/playlists/${playlistId}/tracks`);
      if (!tracksResponse.ok) {
        throw new Error('トラックの取得に失敗しました');
      }
      const tracksData = await tracksResponse.json();
      setTracks(tracksData.tracks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ユーザーのプレイリスト一覧を取得
  const fetchUserPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists');
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error('プレイリスト取得エラー:', err);
    }
  };

  // プレイリストに追加
  const handleAddToPlaylist = (track) => {
    setTrackToAdd(track);
    setShowCreateModal(true);
  };

  // 既存プレイリストに追加
  const addTrackToPlaylist = async (track, playlistId) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          song_id: track.song_id,
          track_id: track.track_id,
          title: track.title,
          artists: track.artists,
          thumbnail_url: track.thumbnail_url,
          style_id: track.style_id,
          style_name: track.style_name,
          release_date: track.release_date
        }),
      });

      if (!response.ok) {
        throw new Error('曲の追加に失敗しました');
      }

      			console.log('プレイリストに追加しました！');
    		} catch (err) {
			console.error('曲の追加に失敗しました:', err.message);
		}
  };

  // 新規プレイリスト作成モーダルを開く
  const openCreatePlaylistModal = (track) => {
    setTrackToAdd(track);
    setShowCreateModal(true);
  };

  // プレイリスト作成完了
  const handlePlaylistCreated = (newPlaylist) => {
    		console.log(`プレイリスト「${newPlaylist.name}」を作成し、曲を追加しました！`);
    fetchUserPlaylists(); // プレイリスト一覧を更新
  };

  // ドラッグ開始
  const handleDragStart = (e, track) => {
    setDraggedTrack(track);
    e.dataTransfer.effectAllowed = 'move';
  };

  // ドラッグオーバー
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // ドロップ処理
  const handleDrop = async (e, targetTrack) => {
    e.preventDefault();
    
    if (!draggedTrack || draggedTrack.id === targetTrack.id) return;

    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks/${draggedTrack.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPosition: targetTrack.position,
          targetTrackId: targetTrack.id
        }),
      });

      if (!response.ok) {
        throw new Error('順番の変更に失敗しました');
      }

      // トラック一覧を再取得
      await fetchPlaylistData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDraggedTrack(null);
    }
  };

  // トラック削除
  const handleRemoveTrack = async (trackId) => {
    if (!confirm('この曲をプレイリストから削除しますか？')) return;

    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('トラックの削除に失敗しました');
      }

      // トラック一覧を再取得
      await fetchPlaylistData();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (playlistId && session?.user) {
      fetchPlaylistData();
      fetchUserPlaylists();
    }
  }, [playlistId, session]);

  if (!session?.user) {
    return <div className={styles.notLoggedIn}>ログインが必要です</div>;
  }

  if (loading) {
    return <div className={styles.loading}>読み込み中...</div>;
  }

  if (error) {
    return <div className={styles.error}>エラー: {error}</div>;
  }

  if (!playlist) {
    return <div className={styles.notFound}>プレイリストが見つかりません</div>;
  }

  return (
    <div className={styles.container}>
      {/* プレイリストヘッダー */}
      <div className={styles.playlistHeader}>
        <div className={styles.playlistInfo}>
          <h1>{playlist.name}</h1>
          {playlist.description && (
            <p className={styles.description}>{playlist.description}</p>
          )}
          <div className={styles.meta}>
            <span className={styles.trackCount}>{tracks.length}曲</span>
            <span className={styles.visibility}>
              {playlist.is_public ? '公開' : '非公開'}
            </span>
            <span className={styles.date}>
              作成日: {new Date(playlist.created_at).toLocaleDateString('ja-JP')}
            </span>
          </div>
        </div>
        
        <div className={styles.playlistActions}>
          <button className={styles.editButton}>編集</button>
          <button className={styles.shareButton}>共有</button>
        </div>
      </div>

      {/* トラック一覧 */}
      <div className={styles.tracksContainer}>
        <div className={styles.tracksHeader}>
          <h2>トラック一覧</h2>
          <span className={styles.trackCount}>{tracks.length}曲</span>
        </div>

        {tracks.length === 0 ? (
          <div className={styles.emptyState}>
            トラックがありません。曲を追加してください。
          </div>
        ) : (
          <div className={styles.tracksList}>
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className={`${styles.trackItem} ${draggedTrack?.id === track.id ? styles.dragging : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, track)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, track)}
              >
                {/* ドラッグハンドル */}
                <div className={styles.dragHandle}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M4 6h8v1H4V6zm0 3h8v1H4V9z" fill="currentColor"/>
                  </svg>
                </div>

                {/* 順番 */}
                <div className={styles.position}>{track.position}</div>

                {/* サムネール */}
                <div className={styles.thumbnail}>
                  <img 
                    src={track.thumbnail_url || '/images/placeholder.jpg'} 
                    alt={track.title}
                    onError={(e) => {
                      e.target.src = '/images/placeholder.jpg';
                    }}
                  />
                </div>

                {/* 曲情報 */}
                <div className={styles.trackInfo}>
                  <div className={styles.title}>{track.title}</div>
                  <div className={styles.artists}>
                    {Array.isArray(track.artists) 
                      ? track.artists.join(', ') 
                      : track.artists}
                  </div>
                </div>

                {/* スタイルアイコン */}
                <div className={styles.styleIcon}>
                  <img 
                    src={`/images/${track.style_name?.toLowerCase()}stylenew.png`}
                    alt={track.style_name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>

                {/* リリース日 */}
                <div className={styles.releaseDate}>
                  {track.release_date ? 
                    new Date(track.release_date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    }).replace(/\//g, '.') 
                    : '-'
                  }
                </div>

                {/* 3点メニュー */}
                <div className={styles.trackActions}>
                  <button className={styles.menuButton}>
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <path d="M8 4a1 1 0 100-2 1 1 0 000 2zM8 9a1 1 0 100-2 1 1 0 000 2zM8 14a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                    </svg>
                  </button>
                  
                  {/* サブメニュー */}
                  <div className={styles.submenu}>
                    <a href={`/artists/${track.artists?.[0]}`} className={styles.menuItem}>
                      アーティストリンク
                    </a>
                    <a href={`/songs/${track.song_id}`} className={styles.menuItem}>
                      タイトルリンク
                    </a>
                    <a href={`/genres/${track.style_name}`} className={styles.menuItem}>
                      ジャンルリンク
                    </a>
                    
                    {/* プレイリストに追加 - 拡張版 */}
                    <div className={styles.playlistSubmenu}>
                      <button className={styles.menuItem} onClick={() => handleAddToPlaylist(track)}>
                        プレイリストに追加
                      </button>
                      <div className={styles.playlistOptions}>
                        {userPlaylists.map(playlist => (
                          <button 
                            key={playlist.id}
                            className={styles.playlistOption}
                            onClick={() => addTrackToPlaylist(track, playlist.id)}
                          >
                            {playlist.name}
                          </button>
                        ))}
                        <button 
                          className={`${styles.playlistOption} ${styles.createNew}`}
                          onClick={() => openCreatePlaylistModal(track)}
                        >
                          ＋ 新規プレイリスト作成
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      className={`${styles.menuItem} ${styles.danger}`}
                      onClick={() => handleRemoveTrack(track.id)}
                    >
                      プレイリストから削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 新規プレイリスト作成モーダル */}
      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handlePlaylistCreated}
        trackToAdd={trackToAdd}
      />
    </div>
  );
}