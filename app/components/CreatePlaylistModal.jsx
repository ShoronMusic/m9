'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePlayer } from './PlayerContext';
import styles from './CreatePlaylistModal.module.css';
import { playSuccessSound, playErrorSound } from '../lib/audioUtils';

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
      // 最終更新日順（最後に曲を追加した日が新しい順）
      return playlists.sort((a, b) => {
        // 新しいフィールドlast_track_added_atを使用
        const dateA = new Date(a.last_track_added_at || a.updated_at || a.created_at || 0);
        const dateB = new Date(b.last_track_added_at || b.updated_at || b.created_at || 0);
        
        // デバッグ用ログは削除
        
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
    stableOnClose();
  };

  // 既存プレイリストに追加
  const handleAddToExistingPlaylist = async (playlistId) => {
    if (!trackToAdd) {
      setError('追加する曲の情報がありません');
      return;
    }
    // vocal_dataを必ずセット
    const trackWithVocals = {
      ...trackToAdd,
      vocal_data: Array.isArray(trackToAdd.vocal_data) && trackToAdd.vocal_data.length > 0 ? trackToAdd.vocal_data : (Array.isArray(trackToAdd.vocals) ? trackToAdd.vocals : [])
    };

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // トラックデータを準備
      console.log('=== FRONTEND: handleAddToExistingPlaylist called ===');
      console.log('trackToAdd object:', trackWithVocals);
      console.log('trackToAdd.title:', trackWithVocals.title);
      console.log('trackToAdd.title?.rendered:', trackWithVocals.title?.rendered);
      console.log('trackToAdd.name:', trackWithVocals.name);
      console.log('trackToAdd.id:', trackWithVocals.id);
      console.log('trackToAdd.song_id:', trackWithVocals.song_id);
      
      // track_nameがundefinedの場合は、artistsから曲名を構築
      let trackName = trackWithVocals.title?.rendered || trackWithVocals.title || trackWithVocals.name;
      if (!trackName && trackWithVocals.artists && Array.isArray(trackWithVocals.artists)) {
        trackName = trackWithVocals.artists.map(artist => artist.name).join(', ');
      }

      // スタイル情報を取得
      let styleInfo = null;
      if (trackWithVocals.style && Array.isArray(trackWithVocals.style) && trackWithVocals.style.length > 0) {
        const styleItem = trackWithVocals.style[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      } else if (trackWithVocals.styles && Array.isArray(trackWithVocals.styles) && trackWithVocals.styles.length > 0) {
        const styleItem = trackWithVocals.styles[0];
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
      
      if (trackWithVocals.genre_data && Array.isArray(trackWithVocals.genre_data) && trackWithVocals.genre_data.length > 0) {
        allGenres = trackWithVocals.genre_data;
        genreInfo = trackWithVocals.genre_data[0];
      } else if (trackWithVocals.genres && Array.isArray(trackWithVocals.genres) && trackWithVocals.genres.length > 0) {
        allGenres = trackWithVocals.genres;
        genreInfo = trackWithVocals.genres[0];
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
      let vocalArray = [];
      if (trackWithVocals.vocal_data && Array.isArray(trackWithVocals.vocal_data) && trackWithVocals.vocal_data.length > 0) {
        vocalArray = trackWithVocals.vocal_data;
        vocalInfo = trackWithVocals.vocal_data[0];
      } else if (trackWithVocals.vocals && Array.isArray(trackWithVocals.vocals) && trackWithVocals.vocals.length > 0) {
        vocalArray = trackWithVocals.vocals;
        vocalInfo = trackWithVocals.vocals[0];
      }

      // サムネイルURLを取得
      let thumbnailUrl = null;
      if (trackWithVocals.thumbnail) {
        thumbnailUrl = trackWithVocals.thumbnail;
      } else if (trackWithVocals.acf?.thumbnail_url) {
        thumbnailUrl = trackWithVocals.acf.thumbnail_url;
      } else if (trackWithVocals.thumbnail_url) {
        thumbnailUrl = trackWithVocals.thumbnail_url;
      }

      // 公開年月を取得
      let releaseDate = null;
      if (trackWithVocals.date) {
        releaseDate = trackWithVocals.date;
      } else if (trackWithVocals.release_date) {
        releaseDate = trackWithVocals.release_date;
      } else if (trackWithVocals.acf?.release_date) {
        releaseDate = trackWithVocals.acf.release_date;
      }

      // Spotify画像URLを取得
      let spotifyImages = null;
      if (trackWithVocals.artists && Array.isArray(trackWithVocals.artists) && trackWithVocals.artists.length > 0) {
        const artistImages = trackWithVocals.artists
          .map(artist => artist.acf?.spotify_images || artist.spotify_images)
          .filter(Boolean);
        if (artistImages.length > 0) {
          spotifyImages = JSON.stringify(artistImages);
        }
      }
      
      const trackData = {
        // 基本項目
        track_id: trackWithVocals.id || trackWithVocals.song_id,
        title: trackName || 'Unknown Track',
        song_id: trackWithVocals.id || trackWithVocals.song_id,
        artists: trackWithVocals.artists || null,
        
        // メディア情報
        thumbnail_url: thumbnailUrl,
        
        // スタイル・ジャンル・ボーカル情報（主要なもの）
        style_id: styleInfo?.term_id || trackWithVocals.style_id,
        style_name: styleInfo?.name || trackWithVocals.style_name,
        genre_id: genreInfo?.term_id || trackWithVocals.genre_id,
        genre_name: genreNameForDisplay || genreInfo?.name || trackWithVocals.genre_name,
        vocal_id: vocalInfo?.term_id || trackWithVocals.vocal_id,
        vocal_name: vocalInfo?.name || trackWithVocals.vocal_name,
        
        // 複数情報を格納する新しいフィールド
        genre_data: trackWithVocals.genres || trackWithVocals.genre_data || null,
        style_data: trackWithVocals.styles || trackWithVocals.style || null,
        vocal_data: vocalArray.length > 0 ? vocalArray : null,
        
        // 日付情報
        release_date: releaseDate,
        
        // Spotify情報
        spotify_track_id: trackWithVocals.acf?.spotify_track_id || trackWithVocals.spotifyTrackId,
        spotify_images: spotifyImages,
        spotify_artists: trackWithVocals.acf?.spotify_artists ? JSON.stringify(trackWithVocals.acf.spotify_artists) : null,
        
        // その他の情報
        is_favorite: false, // 新規追加時はデフォルトでfalse
        artist_order: trackWithVocals.acf?.artist_order?.[0] || null,
        content: trackWithVocals.content?.rendered || trackWithVocals.content || null
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
      setSuccess(`「${trackWithVocals.title?.rendered || trackWithVocals.title || trackWithVocals.name}」をプレイリストに追加しました！`);
      
      // 成功時にSE音を再生
      playSuccessSound();
      
      // 成功時の処理
      if (onAddToPlaylist) {
        console.log('Calling onAddToPlaylist callback');
        try {
          await onAddToPlaylist(trackWithVocals, playlistId);
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
                最終更新日順
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