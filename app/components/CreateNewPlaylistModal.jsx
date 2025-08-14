'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function CreateNewPlaylistModal({ 
  isOpen, 
  onClose, 
  onCreate, 
  trackToAdd = null,
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
  const [success, setSuccess] = useState(false);

  // モーダルが開かれた時、またはtrackToAddが変更された時の処理
  useEffect(() => {
    if (isOpen) {
      // モーダルが開かれた時の初期化
      setError(null);
      setSuccess(false);
      setLoading(false);
      setPlaylistData({
        name: '',
        description: '',
        is_public: false
      });
    }
  }, [isOpen, trackToAdd]);

  // onCloseを安定化するためのuseCallback
  const stableOnClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // モーダルが閉じられる際に状態をリセット
  const handleClose = () => {
    setError(null);
    setSuccess(false);
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
          genreInfo = { term_id: trackToAdd.acf.genre_id, name: trackToAdd.acf.genre_id };
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
          vocalInfo = { term_id: trackToAdd.acf.vocal_id, name: trackToAdd.acf.vocal_name };
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
      
      // 作成成功後、指定された曲を追加（新規プレイリストなので重複チェックは不要）
      if (trackToAdd && result.playlist) {
        const trackAddSuccess = await addTrackToNewPlaylist(trackToAdd, result.playlist.id);
        
        // 曲の追加に失敗した場合は、エラーメッセージを表示して処理を停止
        if (!trackAddSuccess) {
          setLoading(false); // ローディング状態を解除
          return; // エラーメッセージは既に設定されているので、ここで処理を停止
        }
      }

      // コールバックを呼び出し
      if (onCreate) {
        onCreate(result.playlist);
      }
      if (onPlaylistCreated) {
        onPlaylistCreated(result.playlist);
      }
      
      // 成功状態を設定
      setSuccess(true);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTrackToNewPlaylist = async (track, playlistId) => {
    try {
      console.log('🎯 addTrackToNewPlaylist called with:', { track, playlistId });
      
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

      console.log('🎯 Prepared trackData:', trackData);
      console.log('🎯 Sending request with skipDuplicateCheck: true');

      // 新規プレイリストへの追加なので、重複チェックをスキップするフラグを追加
      const requestBody = {
        ...trackData,
        skipDuplicateCheck: true // 新規プレイリストなので重複チェックをスキップ
      };
      
      console.log('🎯 Final request body being sent:', requestBody);
      console.log('🎯 skipDuplicateCheck in request body:', requestBody.skipDuplicateCheck);
      console.log('🎯 skipDuplicateCheck type:', typeof requestBody.skipDuplicateCheck);
      
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🎯 API Response:', { ok: response.ok, status: response.status });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎯 曲の追加に失敗しました:', errorData);
        
        // エラーメッセージを適切に処理
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
        return false; // 失敗を示す
      }
      
      console.log('🎯 曲の追加が成功しました');
      return true; // 成功を示す
    } catch (err) {
      console.error('🎯 曲の追加エラー:', err);
      setError(`曲の追加に失敗しました: ${err.message}`);
      return false; // 失敗を示す
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>新規プレイリスト作成</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        {/* エラーメッセージ表示 */}
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

        {/* 成功時は完了メッセージを表示 */}
        {success ? (
          <div className={styles.existingPlaylists}>
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>✓</div>
              <h4>登録完了しました</h4>
              <p>新しいプレイリスト「{playlistData.name}」が正常に作成され、曲が追加されました。</p>
            </div>
            <button
              className={styles.closeButton}
              onClick={handleClose}
            >
              閉じる
            </button>
          </div>
        ) : (
          /* 新規作成フォーム */
          <div className={styles.createFormContainer}>
            <form onSubmit={handleSubmit} className={styles.createForm}>
              <div className={styles.formGroup}>
                <label htmlFor="playlistName">プレイリスト名 *</label>
                <input
                  type="text"
                  id="playlistName"
                  name="name"
                  value={playlistData.name}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="プレイリスト名を入力"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="playlistDescription">説明（オプション）</label>
                <textarea
                  id="playlistDescription"
                  name="description"
                  value={playlistData.description}
                  onChange={handleInputChange}
                  disabled={loading}
                  placeholder="プレイリストの説明を入力"
                  rows={3}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="is_public"
                    checked={playlistData.is_public}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  公開プレイリストにする
                </label>
              </div>
              
              <button
                type="submit"
                className={styles.createButton}
                disabled={loading || !playlistData.name.trim()}
              >
                {loading ? '作成中...' : 'プレイリスト作成'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
