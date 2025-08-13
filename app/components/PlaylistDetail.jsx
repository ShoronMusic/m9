'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './PlaylistDetail.module.css';
import PlaylistSongList from './PlaylistSongList';

export default function PlaylistDetail({ playlist: initialPlaylist, tracks, session, autoPlayFirst = false }) {
  const { data: clientSession } = useSession();
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [editName, setEditName] = useState(initialPlaylist.name || '');
  const [editDescription, setEditDescription] = useState(initialPlaylist.description || '');
  const [isSaving, setIsSaving] = useState(false);

  // プレイリストの最新更新日を取得（トラックの追加日から）
  const getLatestUpdateDate = () => {
    if (!tracks || tracks.length === 0) {
      return playlist.created_at;
    }
    
    // トラックのadded_at（追加日）から最新の日付を取得
    const latestTrackDate = tracks.reduce((latest, track) => {
      if (track.added_at && new Date(track.added_at) > new Date(latest)) {
        return track.added_at;
      }
      return latest;
    }, playlist.created_at);
    
    return latestTrackDate;
  };

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

  // 編集モードを開始
  const startEditing = () => {
    setEditName(playlist.name || '');
    setEditDescription(playlist.description || '');
    setIsEditing(true);
  };

  // 編集をキャンセル
  const cancelEditing = () => {
    setEditName(playlist.name || '');
    setEditDescription(playlist.description || '');
    setIsEditing(false);
  };

  // プレイリスト情報を保存
  const savePlaylist = async () => {
    if (!editName.trim()) {
      alert('プレイリスト名は必須です');
      return;
    }

    setIsSaving(true);
    try {
      console.log('🔧 プレイリスト保存開始:', {
        playlistId: playlist.id,
        name: editName.trim(),
        description: editDescription.trim() || null
      });

      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      console.log('📡 APIレスポンス:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      // レスポンスのステータスコードをチェック
      if (response.ok) {
        console.log('✅ プレイリスト更新成功');
        
        // 成功時はレスポンスの内容をチェックせずに処理を続行
        // 成功したら編集モードを終了し、プレイリスト情報を更新
        setIsEditing(false);
        
        // プレイリスト情報をローカルで更新（ページリロードなし）
        setPlaylist(prev => ({ ...prev, name: editName.trim(), description: editDescription.trim() || null }));
        
        console.log('✅ ローカル状態更新完了');
        // アラートなしで静かに保存完了
      } else {
        console.log('❌ エラーレスポンス');
        
        // エラーレスポンスの場合のみエラーメッセージを処理
        try {
          const errorData = await response.json();
          console.log('📋 エラーデータ:', errorData);
          throw new Error(errorData.error || 'プレイリストの更新に失敗しました');
        } catch (jsonError) {
          console.log('❌ JSONパースエラー:', jsonError);
          // JSONパースエラーの場合は、ステータスコードベースのエラーメッセージを使用
          throw new Error(`プレイリストの更新に失敗しました (HTTP ${response.status})`);
        }
      }
      
    } catch (error) {
      console.error('❌ プレイリスト更新エラー:', error);
      // エラー時のみアラートを表示
      alert(`プレイリストの更新に失敗しました: ${error.message}`);
    } finally {
      setIsSaving(false);
      console.log('🔚 保存処理完了');
    }
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
          
          {isEditing ? (
            <div className={styles.editForm}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={styles.editNameInput}
                placeholder="プレイリスト名を入力"
                maxLength={100}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={styles.editDescriptionInput}
                placeholder="プレイリストの説明を入力（任意）"
                maxLength={500}
                rows={3}
              />
              <div className={styles.editActions}>
                <button
                  onClick={savePlaylist}
                  disabled={isSaving}
                  className={styles.saveButton}
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className={styles.cancelButton}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.playlistTitle}>{playlist.name}</h1>
              {playlist.description && (
                <p className={styles.description}>{playlist.description}</p>
              )}
              <button
                onClick={startEditing}
                className={styles.editButton}
              >
                編集
              </button>
            </>
          )}
          
          <div className={styles.createdBy}>
            Created by {playlist.users?.spotify_display_name || playlist.created_by || 'Unknown User'}
          </div>
          <div className={styles.meta}>
            <div className={styles.metaLeft}>
              <span className={styles.lastUpdated}>
                Update: {formatPlaylistDate(getLatestUpdateDate())}
              </span>
              <span className={styles.visibility}>
                {playlist.is_public ? '公開' : '非公開'}
              </span>
            </div>
          </div>
        </div>
        
        <div className={styles.playlistActions}>
          <Link href="/mypage" className={styles.myPageButton}>
            <span className={styles.backArrow}>←</span>
            <span className={styles.buttonText}>Playlist 一覧</span>
            <div className={styles.myIcon}>
              <img 
                src={session?.user?.image || '/images/default-avatar.png'} 
                alt="My Icon" 
                className={styles.myIconImage}
              />
            </div>
          </Link>
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