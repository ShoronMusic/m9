'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './PlaylistList.module.css';

export default function PlaylistList() {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ name: '', description: '', is_public: false });

  // プレイリスト一覧を取得
  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/playlists');
      
      if (!response.ok) {
        throw new Error('プレイリストの取得に失敗しました');
      }
      
      const data = await response.json();
      setPlaylists(data.playlists || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 新しいプレイリストを作成
  const createPlaylist = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPlaylist),
      });

      if (!response.ok) {
        throw new Error('プレイリストの作成に失敗しました');
      }

      const data = await response.json();
      setPlaylists([data.playlist, ...playlists]);
      setNewPlaylist({ name: '', description: '', is_public: false });
      setShowCreateForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchPlaylists();
    }
  }, [session]);

  if (!session?.user) {
    return <div className={styles.notLoggedIn}>ログインが必要です</div>;
  }

  if (loading) {
    return <div className={styles.loading}>読み込み中...</div>;
  }

  if (error) {
    return <div className={styles.error}>エラー: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>マイプレイリスト</h2>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={styles.createButton}
        >
          {showCreateForm ? 'キャンセル' : '新規作成'}
        </button>
      </div>

      {/* 新規作成フォーム */}
      {showCreateForm && (
        <form onSubmit={createPlaylist} className={styles.createForm}>
          <div className={styles.formGroup}>
            <label htmlFor="name">プレイリスト名 *</label>
            <input
              type="text"
              id="name"
              value={newPlaylist.name}
              onChange={(e) => setNewPlaylist({...newPlaylist, name: e.target.value})}
              required
              placeholder="プレイリスト名を入力"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="description">説明</label>
            <textarea
              id="description"
              value={newPlaylist.description}
              onChange={(e) => setNewPlaylist({...newPlaylist, description: e.target.value})}
              placeholder="プレイリストの説明を入力"
              rows="3"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>
              <input
                type="checkbox"
                checked={newPlaylist.is_public}
                onChange={(e) => setNewPlaylist({...newPlaylist, is_public: e.target.checked})}
              />
              Playlist公開
            </label>
          </div>
          
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              作成
            </button>
          </div>
        </form>
      )}

      {/* プレイリスト一覧 */}
      <div className={styles.playlistGrid}>
        {playlists.length === 0 ? (
          <div className={styles.emptyState}>
            プレイリストがありません。新規作成してください。
          </div>
        ) : (
          playlists.map((playlist) => (
            <div key={playlist.id} className={styles.playlistCard}>
              <div className={styles.playlistInfo}>
                <h3>{playlist.name}</h3>
                {playlist.description && (
                  <p className={styles.description}>{playlist.description}</p>
                )}
                <div className={styles.meta}>
                  <span className={styles.trackCount}>
                    {playlist.playlist_tracks?.[0]?.count || 0}曲
                  </span>
                  <span className={styles.visibility}>
                    {playlist.is_public ? '公開' : '非公開'}
                  </span>
                </div>
                <div className={styles.date}>
                  作成日: {new Date(playlist.created_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
              
              <div className={styles.playlistActions}>
                <button className={styles.viewButton}>
                  表示
                </button>
                <button className={styles.editButton}>
                  編集
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
