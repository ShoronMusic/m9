'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePlayer } from './PlayerContext';
import styles from './CreatePlaylistModal.module.css';

// スタイルIDからスタイル名を取得する関数
function getStyleName(styleId) {
  const styleMap = {
    2844: 'Pop',
    2845: 'Alternative',
    4686: 'Dance',
    2846: 'Electronica',
    2847: 'R&B',
    2848: 'Hip-Hop',
    6703: 'Rock',
    2849: 'Metal',
    2873: 'Others'
  };
  return styleMap[styleId] || 'Unknown';
}

export default function CreatePlaylistModal({ 
  isOpen, 
  onClose, 
  onCreate, 
  trackToAdd = null,
  userPlaylists = [],
  onAddToPlaylist = null,
  onPlaylistCreated = null
}) {
  const { triggerPlaylistUpdate } = usePlayer();
  const [playlistData, setPlaylistData] = useState({
    name: '',
    description: '',
    is_public: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sortType, setSortType] = useState('updated'); // 'updated' または 'name'
  const [localPlaylists, setLocalPlaylists] = useState([]); // ローカルで管理するプレイリスト一覧

  // モーダルが開かれた時、またはtrackToAddが変更された時の処理
  useEffect(() => {
    if (isOpen) {
      // モーダルが開かれた時の初期化
    setError(null);
      setSuccess(null);
      setLoading(false);
      setPlaylistData({
        name: '',
        description: '',
        is_public: false
      });
      setLocalPlaylists(userPlaylists || []);
      setSortType('updated');
    }
  }, [isOpen, trackToAdd, userPlaylists]);

  // onCloseを安定化するためのuseCallback
  const stableOnClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ソートされたプレイリストを取得
  const sortedPlaylists = useMemo(() => {
    if (!localPlaylists || localPlaylists.length === 0) return [];
    
    const playlists = [...localPlaylists];
    
    if (sortType === 'updated') {
      // 更新日順（最新が上）
      return playlists.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0);
        const dateB = new Date(b.updated_at || b.created_at || 0);
        return dateB - dateA;
      });
    } else if (sortType === 'name') {
      // 名前(昇順)
      return playlists.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'ja');
      });
    }
    
    return playlists;
  }, [localPlaylists, sortType]);

  // ソートタイプを切り替える
  const handleSortChange = (newSortType) => {
    setSortType(newSortType);
  };

  // 新規プレイリスト作成モーダルを開く
  const handleCreateNewPlaylist = () => {
    console.log('🎯 新規プレイリスト作成ボタンがクリックされました');
    console.log('🎯 onCreateコールバックの存在確認:', !!onCreate);
    
    // 既存モーダルは閉じずに、親コンポーネントに新規作成アクションを通知
      if (onCreate) {
      console.log('🎯 onCreateコールバックを呼び出します');
      onCreate({ action: 'create_new' });
      console.log('🎯 onCreateコールバック完了');
    } else {
      console.log('🎯 onCreateコールバックが存在しません');
    }
  };

  // モーダルが閉じられる際に状態をリセット
  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setLoading(false);
    setPlaylistData({
      name: '',
      description: '',
      is_public: false
    });
    stableOnClose();
  };

  const handleInputChange = (e) => {
    const { name, type, checked, value } = e.target;
    setPlaylistData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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

      // スタイル情報を取得
      let styleInfo = null;
      if (trackToAdd.style && Array.isArray(trackToAdd.style) && trackToAdd.style.length > 0) {
        const styleItem = trackToAdd.style[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      } else if (trackToAdd.styles && Array.isArray(trackToAdd.styles) && trackToAdd.styles.length > 0) {
        const styleItem = trackToAdd.styles[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      }

      // ジャンル情報を取得
      let genreInfo = null;
      let allGenres = []; // 全ジャンル情報を保存
      
      if (trackToAdd.genre_data && Array.isArray(trackToAdd.genre_data) && trackToAdd.genre_data.length > 0) {
        allGenres = trackToAdd.genre_data;
        genreInfo = trackToAdd.genre_data[0];
      } else if (trackToAdd.genres && Array.isArray(trackToAdd.genres) && trackToAdd.genres.length > 0) {
        allGenres = trackToAdd.genres;
        genreInfo = trackToAdd.genres[0];
      }

      // 複数ジャンル名をカンマ区切りで作成（genre_nameフィールド用）
      let genreNameForDisplay = null;
      if (allGenres.length > 0) {
        const genreNames = allGenres.map(genre => {
          if (typeof genre === 'string') return genre;
          if (typeof genre === 'object' && genre !== null) {
            return genre.name || genre.genre_name || genre.slug || Object.values(genre)[0];
          }
          return String(genre);
        }).filter(name => name && name !== 'null' && name !== 'undefined' && name !== 'unknown');
        
        if (genreNames.length > 0) {
          genreNameForDisplay = genreNames.join(', ');
        }
      }
      
      // 単一ジャンル情報がない場合は、複数ジャンルから最初のものを使用
      if (!genreInfo && allGenres.length > 0) {
        const firstGenre = allGenres[0];
        if (typeof firstGenre === 'string') {
          genreInfo = { term_id: null, name: firstGenre };
        } else if (typeof firstGenre === 'object' && firstGenre !== null) {
          genreInfo = { 
            term_id: firstGenre.term_id || firstGenre.id || null, 
            name: firstGenre.name || firstGenre.genre_name || firstGenre.slug 
          };
        }
      }

      // ボーカル情報を取得
      let vocalInfo = null;
      if (trackToAdd.vocal_data && Array.isArray(trackToAdd.vocal_data) && trackToAdd.vocal_data.length > 0) {
        vocalInfo = trackToAdd.vocal_data[0];
      } else if (trackToAdd.vocals && Array.isArray(trackToAdd.vocals) && trackToAdd.vocals.length > 0) {
        vocalInfo = trackToAdd.vocals[0];
      }

      // サムネイルURLを取得
      let thumbnailUrl = null;
      if (trackToAdd.thumbnail) {
        thumbnailUrl = trackToAdd.thumbnail;
      } else if (trackToAdd.acf?.thumbnail_url) {
        thumbnailUrl = trackToAdd.acf.thumbnail_url;
      } else if (trackToAdd.thumbnail_url) {
        thumbnailUrl = trackToAdd.thumbnail_url;
      }

      // 公開年月を取得
      let releaseDate = null;
      if (trackToAdd.date) {
        releaseDate = trackToAdd.date;
      } else if (trackToAdd.release_date) {
        releaseDate = trackToAdd.release_date;
      } else if (trackToAdd.acf?.release_date) {
        releaseDate = trackToAdd.acf.release_date;
      }

      // Spotify画像URLを取得
      let spotifyImages = null;
      if (trackToAdd.artists && Array.isArray(trackToAdd.artists) && trackToAdd.artists.length > 0) {
        const artistImages = trackToAdd.artists
          .map(artist => artist.acf?.spotify_images || artist.spotify_images)
          .filter(Boolean);
        if (artistImages.length > 0) {
          spotifyImages = JSON.stringify(artistImages);
        }
      }
      
      const trackData = {
        // 基本項目
        track_id: trackToAdd.id || trackToAdd.song_id,
        title: trackName || 'Unknown Track',
        song_id: trackToAdd.id || trackToAdd.song_id,
        artists: trackToAdd.artists || null,
        
        // メディア情報
        thumbnail_url: thumbnailUrl,
        
        // スタイル・ジャンル・ボーカル情報（主要なもの）
        style_id: styleInfo?.term_id || trackToAdd.style_id,
        style_name: styleInfo?.name || trackToAdd.style_name,
        genre_id: genreInfo?.term_id || trackToAdd.genre_id,
        genre_name: genreNameForDisplay || genreInfo?.name || trackToAdd.genre_name,
        vocal_id: vocalInfo?.term_id || trackToAdd.vocal_id,
        vocal_name: vocalInfo?.name || trackToAdd.vocal_name,
        
        // 複数情報を格納する新しいフィールド
        genre_data: trackToAdd.genres || trackToAdd.genre_data || null,
        style_data: trackToAdd.styles || trackToAdd.style || null,
        vocal_data: trackToAdd.vocals || trackToAdd.vocal_data || null,
        
        // 日付情報
        release_date: releaseDate,
        
        // Spotify情報
        spotify_track_id: trackToAdd.acf?.spotify_track_id || trackToAdd.spotifyTrackId,
        spotify_images: spotifyImages,
        spotify_artists: trackToAdd.acf?.spotify_artists ? JSON.stringify(trackToAdd.acf.spotify_artists) : null,
        
        // その他の情報
        is_favorite: false, // 新規追加時はデフォルトでfalse
        artist_order: trackToAdd.acf?.artist_order?.[0] || null,
        content: trackToAdd.content?.rendered || trackToAdd.content || null
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
        let errorMessage = '曲の追加に失敗しました';
        
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // 詳細情報がある場合は追加
        if (errorData.details) {
          errorMessage += `\n\n詳細: ${errorData.details}`;
        }
        
        setError(errorMessage);
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
      triggerPlaylistUpdate(); // プレイリスト追加後にトリガー
      
      // 少し待ってから閉じる（成功メッセージを見せるため）
      setTimeout(() => {
        console.log('Closing modal after success');
        handleClose();
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
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>プレイリストに追加</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        {/* 統一されたメッセージ表示エリア */}
        {error && (
          <div className={styles.error}>
            {error.split('\n').map((line, index) => (
              <div key={index}>
                {line}
                {index < error.split('\n').length - 1 && <br />}
              </div>
            ))}
          </div>
        )}
        {success && (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successMessage}>{success}</div>
          </div>
        )}

        {/* 既存プレイリスト一覧 */}
        {!loading && !success && (
          <div className={styles.existingPlaylists}>
            <h3>既存のプレイリストに追加</h3>
            <div className={styles.sortControls}>
              <button
                className={`${styles.sortButton} ${sortType === 'updated' ? styles.active : ''}`}
                onClick={() => handleSortChange('updated')}
              >
                更新日順
              </button>
              <button
                className={`${styles.sortButton} ${sortType === 'name' ? styles.active : ''}`}
                onClick={() => handleSortChange('name')}
              >
                名前(昇順)
              </button>
            </div>
            <div className={styles.playlistList}>
              {sortedPlaylists.map(playlist => (
                <button
                  key={playlist.id}
                  className={`${styles.playlistItem} ${playlist.isNewlyCreated ? styles.newlyCreated : ''}`}
                  onClick={() => handleAddToExistingPlaylist(playlist.id)}
                  disabled={loading}
                >
                  <span className={styles.playlistName}>{playlist.name}</span>
                  <span className={styles.playlistCount}>{playlist.track_count || 0}曲</span>
                  {loading && <span className={styles.loading}>追加中...</span>}
                </button>
              ))}
            </div>
            <button
              className={styles.createNewButton}
              onClick={handleCreateNewPlaylist}
              disabled={loading}
            >
              ＋ 新規プレイリスト作成
            </button>
                      </div>
                    )}
      </div>
    </div>
  );
}