'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './PlaylistDetail.module.css';
import CreatePlaylistModal from './CreatePlaylistModal';

export default function PlaylistDetail({ playlist, tracks, session }) {
  const { data: clientSession } = useSession();
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [draggedTrack, setDraggedTrack] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);

  // 日付フォーマット関数
  const formatPlaylistDate = (dateString) => {
    if (!dateString) return '不明';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '昨日';
    } else if (diffDays <= 7) {
      return `${diffDays}日前`;
    } else if (diffDays <= 30) {
      const weeks = Math.ceil(diffDays / 7);
      return `${weeks}週間前`;
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${date.getFullYear()}.${month}.${day}`;
    }
  };

  // データフィールドをテキストとして表示するヘルパー関数
  const formatFieldAsText = (field) => {
    if (!field) return '-';
    
    // デバッグ用：フィールドの型と値をログ出力
    console.log('formatFieldAsText input:', { field, type: typeof field, isArray: Array.isArray(field) });
    
    // 日付フィールドの処理（ISO形式の日付文字列をチェック）
    if (typeof field === 'string' && /^\d{4}-\d{2}-\d{2}/.test(field)) {
      try {
        const date = new Date(field);
        if (!isNaN(date.getTime())) {
          const formatted = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\//g, '.');
          console.log('Date formatted:', { original: field, formatted });
          return formatted;
        }
      } catch (e) {
        console.log('Date parsing failed:', e);
      }
    }
    
    if (typeof field === 'string') {
      // JSON文字列の可能性をチェック
      if (field.startsWith('{') || field.startsWith('[')) {
        try {
          const parsed = JSON.parse(field);
          console.log('JSON parsed:', { original: field, parsed, type: typeof parsed });
          if (Array.isArray(parsed)) {
            const result = parsed.join(', ');
            console.log('Array result:', result);
            return result;
          } else if (typeof parsed === 'object') {
            // アーティスト情報の場合はnameフィールドを優先
            if (parsed.name) {
              console.log('Parsed object with name field:', parsed.name);
              return parsed.name;
            }
            // nameフィールドがない場合は、最初の数個の値のみを表示
            const values = Object.values(parsed).slice(0, 3);
            const result = values.join(', ');
            console.log('Parsed object result (first 3 values):', result);
            return result;
          }
          const result = parsed.toString();
          console.log('Other result:', result);
          return result;
        } catch (e) {
          console.log('JSON parsing failed:', e);
          // JSONパースに失敗した場合は元の文字列を返す
          return field;
        }
      }
      console.log('String result:', field);
      return field;
    }
    
    if (Array.isArray(field)) {
      const formattedArray = field.map(item => {
        // 各要素がオブジェクトの場合はnameフィールドを優先
        if (typeof item === 'object' && item !== null) {
          if (item.name) {
            return item.name;
          }
          // nameフィールドがない場合は最初の値を返す
          return Object.values(item)[0] || JSON.stringify(item);
        }
        return item;
      });
      const result = formattedArray.join(', ');
      console.log('Array result:', result);
      return result;
    }
    
    if (typeof field === 'object') {
      // オブジェクトの場合は、nameフィールドがあればそれを優先
      if (field.name) {
        console.log('Object with name field:', field.name);
        return field.name;
      }
      // nameフィールドがない場合は、最初の数個の値のみを表示
      const values = Object.values(field).slice(0, 3);
      const result = values.join(', ');
      console.log('Object result (first 3 values):', result);
      return result;
    }
    
    const result = field.toString();
    console.log('Final result:', result);
    return result;
  };

  // アーティスト情報を適切に表示するヘルパー関数
  const formatArtists = (artists) => {
    if (!artists) return '-';
    
    console.log('formatArtists input:', { artists, type: typeof artists, isArray: Array.isArray(artists) });
    
    // 配列の場合
    if (Array.isArray(artists)) {
      const formattedArtists = artists.map(artist => {
        // 各要素がJSON文字列の場合
        if (typeof artist === 'string' && (artist.startsWith('{') || artist.startsWith('['))) {
          try {
            const parsed = JSON.parse(artist);
            // アーティストオブジェクトからnameフィールドを取得
            if (parsed && typeof parsed === 'object' && parsed.name) {
              return parsed.name;
            }
            // nameフィールドがない場合は最初の値を返す
            return Object.values(parsed)[0] || artist;
          } catch (e) {
            console.log('Artist JSON parsing failed:', e);
            return artist;
          }
        }
        // 文字列の場合はそのまま返す
        if (typeof artist === 'string') {
          return artist;
        }
        // オブジェクトの場合はnameフィールドまたは最初の値を返す
        if (typeof artist === 'object' && artist !== null) {
          return artist.name || Object.values(artist)[0] || JSON.stringify(artist);
        }
        return artist;
      });
      
      const result = formattedArtists.join(', ');
      console.log('formatArtists result:', result);
      return result;
    }
    
    // 配列以外の場合は従来の処理
    const formatted = formatFieldAsText(artists);
    console.log('formatArtists result:', formatted);
    return formatted === '-' ? '-' : formatted;
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
      const response = await fetch(`/api/playlists/${playlist.id}/tracks/${draggedTrack.id}`, {
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

      // ページをリロードして変更を反映
      window.location.reload();
    } catch (err) {
      console.error('順番の変更に失敗しました:', err.message);
    } finally {
      setDraggedTrack(null);
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

  useEffect(() => {
    if (session?.user) {
      fetchUserPlaylists();
    }
  }, [session]);

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
          <h1 className={styles.playlistTitle}>{playlist.name}</h1>
          {playlist.description && (
            <p className={styles.description}>{playlist.description}</p>
          )}
          <div className={styles.meta}>
            <span className={styles.trackCount}>{tracks.length}曲</span>
            <span className={styles.lastUpdated}>
              最終更新: {formatPlaylistDate(playlist.updated_at || playlist.created_at)}
            </span>
            <span className={styles.visibility}>
              {playlist.is_public ? '公開' : '非公開'}
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
        
        {/* トラックヘッダーラベル */}
        <div className={styles.trackLabels}>
          <div className={styles.labelPosition}>順番</div>
          <div className={styles.labelInfo}>曲情報</div>
          <div className={styles.labelReleaseDate}>リリース日</div>
          <div className={styles.labelStyleName}>スタイル</div>
          <div className={styles.labelAddedDate}>追加日</div>
          <div className={styles.labelActions}>操作</div>
        </div>

        {tracks.length === 0 ? (
          <div className={styles.emptyState}>
            トラックがありません。曲を追加してください。
          </div>
        ) : (
          <div className={styles.tracksList}>
            {tracks.map((track, index) => {
              // デバッグ用：トラックデータの構造をログ出力
              console.log(`Track ${index} data:`, track);
              
              return (
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
                <div className={styles.position}>{track.position || index + 1}</div>

                {/* 曲情報 */}
                <div className={styles.trackInfo}>
                  <div className={styles.title}>
                    <strong>{formatFieldAsText(track.title)}</strong>
                  </div>
                  <div className={styles.artists}>
                    <strong>{formatArtists(track.artists)}</strong>
                  </div>
                  {track.song_id && (
                    <div className={styles.songId}>
                      ID: {formatFieldAsText(track.song_id)}
                    </div>
                  )}
                  {track.track_id && (
                    <div className={styles.trackId}>
                      トラックID: {formatFieldAsText(track.track_id)}
                    </div>
                  )}
                </div>

                {/* リリース日 */}
                <div className={styles.releaseDate}>
                  {track.release_date ? 
                    formatFieldAsText(track.release_date)
                    : '-'
                  }
                </div>

                {/* スタイル名 */}
                <div className={styles.styleName}>
                  {formatFieldAsText(track.style_name)}
                </div>

                {/* 追加日 */}
                <div className={styles.addedDate}>
                  {track.added_at ? 
                    formatFieldAsText(track.added_at)
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
                    <a href={`/artists/${formatFieldAsText(track.artists?.[0])}`} className={styles.menuItem}>
                      アーティストリンク
                    </a>
                    <a href={`/songs/${track.song_id}`} className={styles.menuItem}>
                      タイトルリンク
                    </a>
                    <a href={`/genres/${formatFieldAsText(track.style_name)}`} className={styles.menuItem}>
                      ジャンルリンク
                    </a>
                    
                    {/* プレイリストに追加 - 拡張版 */}
                    <div className={styles.playlistSubmenu}>
                      <button className={styles.menuItem} onClick={() => handleAddToPlaylist(track)}>
                        プレイリストに追加
                      </button>
                      <div className={styles.playlistOptions}>
                        {userPlaylists.map(userPlaylist => (
                          <button 
                            key={userPlaylist.id}
                            className={styles.playlistOption}
                            onClick={() => addTrackToPlaylist(track, userPlaylist.id)}
                          >
                            {userPlaylist.name}
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
            );
            })}
          </div>
        )}
      </div>
      
      {/* 新規プレイリスト作成モーダル */}
      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPlaylistCreated={handlePlaylistCreated}
        trackToAdd={trackToAdd}
      />
    </div>
  );
}