'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './PlaylistDetail.module.css';
import PlaylistSongList from './PlaylistSongList';

export default function PlaylistDetail({ playlist: initialPlaylist, tracks: initialTracks, session, autoPlayFirst = false, isOwner = false }) {
  const { data: clientSession } = useSession();
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [editName, setEditName] = useState(initialPlaylist.name || '');
  const [editDescription, setEditDescription] = useState(initialPlaylist.description || '');
  const [editIsPublic, setEditIsPublic] = useState(initialPlaylist.is_public || false);
  const [editYear, setEditYear] = useState(initialPlaylist.year || '');
  const [editTags, setEditTags] = useState(initialPlaylist.tags || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);
  const [tracks, setTracks] = useState(initialTracks); // トラックの状態管理を追加

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
    setEditIsPublic(playlist.is_public || false);
    setEditYear(playlist.year || '');
    setEditTags(playlist.tags || '');
    setIsEditing(true);
  };

  // 編集をキャンセル
  const cancelEditing = () => {
    setEditName(playlist.name || '');
    setEditDescription(playlist.description || '');
    setEditIsPublic(playlist.is_public || false);
    setEditYear(playlist.year || '');
    setEditTags(playlist.tags || '');
    setIsEditing(false);
  };

  // プレイリスト情報を保存
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setShowFinalDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setShowFinalDeleteConfirm(false);
  };

  const handleFinalDelete = async () => {
    try {
      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('プレイリストが削除されました');
        // マイページにリダイレクト
        if (typeof window !== 'undefined') {
          window.location.href = '/mypage';
        }
      } else {
        const errorData = await response.json();
        alert(`削除に失敗しました: ${errorData.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('プレイリスト削除エラー:', error);
      alert('削除中にエラーが発生しました');
    } finally {
      setShowFinalDeleteConfirm(false);
    }
  };

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
          is_public: editIsPublic,
          year: editYear || null,
          tags: editTags.trim() || null,
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
        setPlaylist(prev => ({ 
          ...prev, 
          name: editName.trim(), 
          description: editDescription.trim() || null, 
          is_public: editIsPublic,
          year: editYear || null,
          tags: editTags.trim() || null
        }));
        
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
      if (typeof window !== 'undefined') {
        window.location.href = `/playlists/${nextPlaylist.id}?autoplay=1`;
      }
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

  // 公開プレイリストの場合はログインなしでも閲覧可能
  // 非公開プレイリストの場合のみログインが必要
  if (!playlist.is_public && !session?.user) {
    return <div className={styles.notLoggedIn}>このプレイリストを表示するにはログインが必要です</div>;
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
              
              <div className={styles.formGroup}>
                <label htmlFor="editYear">年（オプション）</label>
                <select
                  id="editYear"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  className={styles.editSelect}
                >
                  <option value="">年を選択してください</option>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="editTags">タグ（オプション）</label>
                <input
                  type="text"
                  id="editTags"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className={styles.editInput}
                  placeholder="例: Summer Sonic, Rock, 2025"
                  maxLength={200}
                />
                <small className={styles.helpText}>
                  カンマ区切りで複数のタグを入力できます
                </small>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                  />
                  <span>Playlist公開</span>
                </label>
              </div>
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
              
              {/* 削除ボタン */}
              <div className={styles.deleteSection}>
                <button
                  onClick={handleDeleteClick}
                  disabled={isSaving}
                  className={styles.deleteButton}
                >
                  プレイリストを削除
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.playlistTitle}>{playlist.name}</h1>
              {playlist.description && (
                <p className={styles.description}>{playlist.description}</p>
              )}
              
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
              
              {session?.user && isOwner && (
                <button
                  onClick={startEditing}
                  className={styles.editButton}
                >
                  編集
                </button>
              )}
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
              <span className={`${styles.visibility} ${playlist.is_public ? styles.public : styles.private}`}>
                {playlist.is_public ? '公開' : '非公開'}
              </span>
            </div>
          </div>
        </div>
        
        <div className={styles.playlistActions}>
          {session?.user ? (
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
          ) : (
            <Link href="/" className={styles.myPageButton}>
              <span className={styles.backArrow}>←</span>
              <span className={styles.buttonText}>ホームに戻る</span>
            </Link>
          )}
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
          onTrackOrderChange={setTracks} // トラックの順序が変更されたら状態を更新
        />
      )}
      
      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className={styles.deleteConfirmModal}>
          <div className={styles.deleteConfirmContent}>
            <h3>プレイリストの削除</h3>
            <p>このプレイリスト「{playlist.name}」を削除しますか？</p>
            <p className={styles.deleteWarning}>
              この操作により、プレイリスト内の全曲も削除されます。
            </p>
            <div className={styles.deleteConfirmActions}>
              <button
                onClick={handleDeleteCancel}
                className={styles.deleteCancelButton}
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                className={styles.deleteConfirmButton}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 最終削除確認モーダル */}
      {showFinalDeleteConfirm && (
        <div className={styles.deleteConfirmModal}>
          <div className={styles.deleteConfirmContent}>
            <h3>最終確認</h3>
            <p>本当にこのプレイリストを削除しますか？</p>
            <p className={styles.deleteWarning}>
              <strong>この操作は取り消せません。</strong><br/>
              プレイリスト「{playlist.name}」とその中の全曲が完全に削除されます。
            </p>
            <div className={styles.deleteConfirmActions}>
              <button
                onClick={handleDeleteCancel}
                className={styles.deleteCancelButton}
              >
                キャンセル
              </button>
              <button
                onClick={handleFinalDelete}
                className={styles.deleteFinalButton}
              >
                完全に削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}