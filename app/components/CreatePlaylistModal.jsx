'use client';

import { useState } from 'react';
import styles from './CreatePlaylistModal.module.css';

export default function CreatePlaylistModal({ 
  isOpen, 
  onClose, 
  onCreate, 
  trackToAdd = null,
  userPlaylists = [],
  onAddToPlaylist = null,
  onPlaylistCreated = null
}) {
  const [playlistData, setPlaylistData] = useState({
    name: '',
    description: '',
    is_public: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!playlistData.name.trim()) {
      setError('プレイリスト名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // APIが期待するフィールド名でデータを準備
      const requestData = {
        name: playlistData.name,
        description: playlistData.description,
        is_public: playlistData.is_public
      };

      // 曲の情報がある場合は追加
      if (trackToAdd) {
        requestData.track_id = trackToAdd.id || trackToAdd.song_id || trackToAdd.track_id;
        requestData.song_id = trackToAdd.song_id || trackToAdd.id || trackToAdd.track_id;
        requestData.track_name = trackToAdd.title?.rendered || trackToAdd.title;
        requestData.artists = trackToAdd.artists;
      }

      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        setError('プレイリストの作成に失敗しました');
        return;
      }

      const result = await response.json();
      
      // 作成成功後、指定された曲を追加（APIで既に追加されている場合は不要）
      if (trackToAdd && result.playlist && !result.track_added) {
        await addTrackToNewPlaylist(trackToAdd, result.playlist.id);
      }

      // コールバックを呼び出し
      if (onCreate) {
        onCreate(result.playlist);
      }
      if (onPlaylistCreated) {
        onPlaylistCreated(result.playlist);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTrackToNewPlaylist = async (track, playlistId) => {
    try {
      // 必須フィールドのみを送信（IDが最低限必要）
      const trackData = {
        song_id: track.id || track.song_id,
        track_id: track.id || track.track_id
      };

      // 利用可能な情報があれば追加
      if (track.title?.rendered || track.title) {
        trackData.title = track.title?.rendered || track.title;
      }
      if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
        trackData.artists = track.artists;
      }
      if (track.thumbnail_url) {
        trackData.thumbnail_url = track.thumbnail_url;
      }
      if (track.style_id) {
        trackData.style_id = track.style_id;
      }
      if (track.style_name) {
        trackData.style_name = track.style_name;
      }
      if (track.release_date || track.date) {
        trackData.release_date = track.release_date || track.date;
      }

      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('曲の追加に失敗しました:', errorData);
        setError(`曲の追加に失敗しました: ${errorData.message || errorData.error || '不明なエラー'}`);
        return;
      }
    } catch (err) {
      console.error('曲の追加エラー:', err);
      setError(`曲の追加に失敗しました: ${err.message}`);
    }
  };

  // 既存プレイリストに追加
  const handleAddToExistingPlaylist = async (playlistId) => {
    if (!trackToAdd) {
      setError('追加する曲の情報がありません');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // トラックデータを準備
      console.log('=== FRONTEND: handleAddToExistingPlaylist called ===');
      console.log('trackToAdd object:', trackToAdd);
      console.log('trackToAdd.title:', trackToAdd.title);
      console.log('trackToAdd.title?.rendered:', trackToAdd.title?.rendered);
      console.log('trackToAdd.name:', trackToAdd.name);
      console.log('trackToAdd.id:', trackToAdd.id);
      console.log('trackToAdd.song_id:', trackToAdd.song_id);
      
      // track_nameがundefinedの場合は、artistsから曲名を構築
      let trackName = trackToAdd.title?.rendered || trackToAdd.title || trackToAdd.name;
      if (!trackName && trackToAdd.artists && Array.isArray(trackToAdd.artists)) {
        trackName = trackToAdd.artists.map(artist => artist.name).join(', ');
      }
      
      const trackData = {
        track_id: trackToAdd.id || trackToAdd.song_id,
        track_name: trackName || 'Unknown Track',
        song_id: trackToAdd.id || trackToAdd.song_id,
        artists: trackToAdd.artists || null
      };

      console.log('Prepared trackData:', trackData);
      console.log('Adding track to existing playlist:', { playlistId, trackData });

      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackData),
      });

      console.log('API Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        console.log('API Response Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });
        
        // 重複トラックの場合は特別な処理
        if (response.status === 409) {
          console.log('Handling duplicate track error (409)');
          setError(errorData.message || 'この曲は既にプレイリストに追加されています');
          return;
        }
        
        // その他のエラーの場合
        console.log('Handling other error');
        setError(errorData.message || errorData.error || '曲の追加に失敗しました');
        return;
      }

      // 成功時の処理
      console.log('Processing successful response');
      const result = await response.json();
      console.log('Track added successfully:', result);
      
      // 成功メッセージを表示
      setError(null);
      setSuccess(`「${trackToAdd.title?.rendered || trackToAdd.title || trackToAdd.name}」をプレイリストに追加しました！`);
      
      // 成功時の処理
      if (onAddToPlaylist) {
        console.log('Calling onAddToPlaylist callback');
        try {
          await onAddToPlaylist(trackToAdd, playlistId);
          console.log('onAddToPlaylist callback completed successfully');
        } catch (callbackError) {
          console.error('Error in onAddToPlaylist callback:', callbackError);
          // コールバックでエラーが発生しても、トラック追加自体は成功しているので
          // エラーは設定しない（成功メッセージは維持）
        }
      }
      
      // 少し待ってから閉じる（成功メッセージを見せるため）
      setTimeout(() => {
        console.log('Closing modal after success');
        onClose();
      }, 1000);
      
    } catch (err) {
      console.error('既存プレイリストへの追加エラー:', err);
      // エラーメッセージを設定
      setError(`プレイリストへの追加に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>プレイリストに追加</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* 統一されたメッセージ表示エリア */}
        {error && (
          <div className={styles.error}>{error}</div>
        )}
        {success && (
          <div className={styles.success}>{success}</div>
        )}

        {/* 既存プレイリストへの追加 */}
        {userPlaylists.length > 0 && (
          <div className={styles.existingPlaylists}>
            <h3>既存のプレイリストに追加</h3>
            
            <div className={styles.playlistList}>
              {userPlaylists.map(playlist => (
                <button
                  key={playlist.id}
                  className={styles.playlistItem}
                  onClick={() => handleAddToExistingPlaylist(playlist.id)}
                  disabled={loading}
                >
                  <span className={styles.playlistName}>{playlist.name}</span>
                  <span className={styles.playlistCount}>{playlist.track_count || 0}曲</span>
                  {loading && <span className={styles.loading}>追加中...</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 区切り線 */}
        {userPlaylists.length > 0 && (
          <div className={styles.divider}>
            <span>または</span>
          </div>
        )}

        {/* 新規プレイリスト作成 */}
        <div className={styles.createSection}>
          <h3>新規プレイリスト作成</h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="name">プレイリスト名 *</label>
              <input
                id="name"
                type="text"
                value={playlistData.name}
                onChange={(e) => setPlaylistData({
                  ...playlistData,
                  name: e.target.value
                })}
                placeholder="プレイリスト名を入力"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">説明</label>
              <textarea
                id="description"
                value={playlistData.description}
                onChange={(e) => setPlaylistData({
                  ...playlistData,
                  description: e.target.value
                })}
                placeholder="プレイリストの説明（任意）"
                rows="3"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={playlistData.is_public}
                  onChange={(e) => setPlaylistData({
                    ...playlistData,
                    is_public: e.target.checked
                  })}
                />
                <span>公開プレイリストにする</span>
              </label>
            </div>

            {trackToAdd && (
              <div className={styles.trackInfo}>
                <p>以下の曲を追加します：</p>
                <div className={styles.trackPreview}>
                  <div>
                    <div className={styles.trackTitle}>
                      {trackToAdd.title?.rendered || trackToAdd.title || `ID: ${trackToAdd.id || trackToAdd.song_id || trackToAdd.track_id}`}
                    </div>
                    {trackToAdd.artists && (
                      <div className={styles.trackArtist}>
                        {Array.isArray(trackToAdd.artists) 
                          ? trackToAdd.artists.map(artist => artist.name || artist).join(', ')
                          : trackToAdd.artists}
                      </div>
                    )}
                    {!trackToAdd.artists && (trackToAdd.title?.rendered || trackToAdd.title) && (
                      <div className={styles.trackArtist}>
                        <em>アーティスト情報なし</em>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.cancelButton}
                onClick={onClose}
                disabled={loading}
              >
                キャンセル
              </button>
              <button 
                type="submit" 
                className={styles.createButton}
                disabled={loading}
              >
                {loading ? '作成中...' : 'プレイリスト作成'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}