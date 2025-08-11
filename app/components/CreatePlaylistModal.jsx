'use client';

import { useState } from 'react';
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
        // スタイル情報を取得（複数のソースから、より包括的に）
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
        } else if (trackToAdd.acf?.style_id && trackToAdd.acf?.style_name) {
          styleInfo = { term_id: trackToAdd.acf.style_id, name: trackToAdd.acf.style_name };
        } else if (trackToAdd.style_id && trackToAdd.style_name) {
          styleInfo = { term_id: trackToAdd.style_id, name: trackToAdd.style_name };
        } else if (trackToAdd.category_data && Array.isArray(trackToAdd.category_data)) {
          // category_dataからスタイル情報を探す
          const styleCategory = trackToAdd.category_data.find(cat => 
            cat.type === 'style' || cat.taxonomy === 'style' || 
            (cat.name && cat.name.toLowerCase().includes('style'))
          );
          if (styleCategory) {
            styleInfo = { term_id: styleCategory.term_id || styleCategory.id, name: styleCategory.name };
          }
        } else if (trackToAdd.categories && Array.isArray(trackToAdd.categories)) {
          // categoriesからスタイル情報を探す
          const styleCategory = trackToAdd.categories.find(cat => 
            cat.type === 'style' || cat.taxonomy === 'style' || 
            (cat.name && cat.name.toLowerCase().includes('style'))
          );
          if (styleCategory) {
            styleInfo = { term_id: styleCategory.term_id || styleCategory.id, name: styleCategory.name };
          }
        }

        // ジャンル情報を取得（複数のソースから、複数ジャンル対応）
        let genreInfo = null;
        let allGenres = []; // 全ジャンル情報を保存
        
        if (trackToAdd.genre_data && Array.isArray(trackToAdd.genre_data) && trackToAdd.genre_data.length > 0) {
          allGenres = trackToAdd.genre_data;
          genreInfo = trackToAdd.genre_data[0]; // 主要なジャンルとして最初のものを使用
        } else if (trackToAdd.genres && Array.isArray(trackToAdd.genres) && trackToAdd.genres.length > 0) {
          allGenres = trackToAdd.genres;
          genreInfo = trackToAdd.genres[0];
        } else if (trackToAdd.acf?.genre_id && trackToAdd.acf?.genre_name) {
          genreInfo = { term_id: trackToAdd.acf.genre_id, name: trackToAdd.acf.genre_name };
          allGenres = [genreInfo];
        } else if (trackToAdd.genre_id && trackToAdd.genre_name) {
          genreInfo = { term_id: trackToAdd.genre_id, name: trackToAdd.genre_id };
          allGenres = [genreInfo];
        }

        // ボーカル情報を取得（複数のソースから）
        let vocalInfo = null;
        if (trackToAdd.vocal_data && Array.isArray(trackToAdd.vocal_data) && trackToAdd.vocal_data.length > 0) {
          vocalInfo = trackToAdd.vocal_data[0];
        } else if (trackToAdd.vocals && Array.isArray(trackToAdd.vocals) && trackToAdd.vocals.length > 0) {
          vocalInfo = trackToAdd.vocals[0];
        } else if (trackToAdd.acf?.vocal_id && trackToAdd.acf?.vocal_name) {
          vocalInfo = { term_id: trackToAdd.acf.vocal_id, name: trackToAdd.acf.vocal_name };
        } else if (trackToAdd.vocal_id && trackToAdd.vocal_name) {
          vocalInfo = { term_id: trackToAdd.vocal_id, name: trackToAdd.vocal_name };
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

        // 基本項目
        requestData.track_id = trackToAdd.id || trackToAdd.song_id || trackToAdd.track_id;
        requestData.song_id = trackToAdd.song_id || trackToAdd.id || trackToAdd.track_id;
        requestData.title = trackToAdd.title?.rendered || trackToAdd.title;
        requestData.artists = trackToAdd.artists;
        
        // メディア情報
        requestData.thumbnail_url = thumbnailUrl;
        
        // スタイル・ジャンル・ボーカル情報
        requestData.style_id = styleInfo?.term_id || trackToAdd.style_id;
        requestData.style_name = styleInfo?.name || trackToAdd.style_name;
        requestData.genre_id = genreInfo?.term_id || trackToAdd.genre_id;
        requestData.genre_name = genreInfo?.name || trackToAdd.genre_name;
        requestData.vocal_id = vocalInfo?.term_id || trackToAdd.vocal_id;
        requestData.vocal_name = vocalInfo?.name || trackToAdd.vocal_name;
        
        // 日付情報
        requestData.release_date = releaseDate;
        
        // Spotify情報
        requestData.spotify_track_id = trackToAdd.acf?.spotify_track_id || trackToAdd.spotifyTrackId;
        requestData.spotify_images = spotifyImages;
        requestData.spotify_artists = trackToAdd.acf?.spotify_artists ? JSON.stringify(trackToAdd.acf.spotify_artists) : null;
        
        // その他の情報
        requestData.is_favorite = false; // 新規追加時はデフォルトでfalse
        requestData.artist_order = trackToAdd.acf?.artist_order?.[0] || null;
        requestData.content = trackToAdd.content?.rendered || trackToAdd.content || null;
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
      triggerPlaylistUpdate(); // プレイリスト作成後にトリガー
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTrackToNewPlaylist = async (track, playlistId) => {
    try {
      // 複数ジャンル名をカンマ区切りで作成（genre_nameフィールド用）
      let genreNameForDisplay = null;
      if (track.genres && Array.isArray(track.genres) && track.genres.length > 0) {
        const genreNames = track.genres.map(genre => {
          if (typeof genre === 'string') return genre;
          if (typeof genre === 'object' && genre !== null) {
            return genre.name || genre.genre_name || genre.slug || Object.values(genre)[0];
          }
          return String(genre);
        }).filter(name => name && name !== 'null' && name !== 'undefined' && name !== 'unknown');
        
        if (genreNames.length > 0) {
          genreNameForDisplay = genreNames.join(', ');
        }
      } else if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
        const genreNames = track.genre_data.map(genre => {
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
      
      // データベースに存在するフィールドのみを含むデータを送信
      const trackData = {
        // 基本項目
        song_id: track.id || track.song_id,
        track_id: track.id || track.track_id,
        title: track.title?.rendered || track.title,
        artists: track.artists || null,
        
        // メディア情報
        thumbnail_url: track.thumbnail_url || track.thumbnail || null,
        
        // スタイル・ジャンル・ボーカル情報（主要なもの）
        style_id: track.style_id || null,
        style_name: track.style_name || null,
        genre_id: track.genre_id || null,
        genre_name: genreNameForDisplay || track.genre_name || null,
        vocal_id: track.vocal_id || null,
        vocal_name: track.vocal_name || null,
        
        // 複数情報を格納する新しいフィールド
        genre_data: track.genres || track.genre_data || null,
        style_data: track.styles || track.style || null,
        vocal_data: track.vocals || track.vocal_data || null,
        
        // 日付情報
        release_date: track.release_date || track.releaseDate || track.date || null,
        
        // Spotify情報
        spotify_track_id: track.acf?.spotify_track_id || track.spotifyTrackId || null,
        spotify_images: null, // 後で実装
        spotify_artists: track.acf?.spotify_artists ? JSON.stringify(track.acf.spotify_artists) : null,
        
        // その他の情報
        is_favorite: false,
        artist_order: track.acf?.artist_order?.[0] || null,
        content: track.content?.rendered || track.content || null
      };

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
      triggerPlaylistUpdate(); // プレイリスト追加後にトリガー
      
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