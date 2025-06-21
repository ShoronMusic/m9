// src/components/SaveToPlaylistPopup.jsx

import React, { useState, useEffect, useRef } from 'react';
import { firestore, auth } from './firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import NewPlaylistPopup from './NewPlaylistPopup';
import './SaveToPlaylistPopup.css';
import { Snackbar, Alert } from '@mui/material';

// ★ 更新日を YYYY.MM.DD 形式で返す関数
const formatUpdatedDateOnly = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return ''; 
  const date = timestamp.toDate();
  return date
    .toLocaleDateString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/-/g, '.');  
};

const SaveToPlaylistPopup = ({ songId, onClose }) => {
  const [playlists, setPlaylists] = useState([]);
  const [showNewPlaylistPopup, setShowNewPlaylistPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('updatedAt');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const firstButtonRef = useRef(null);

  // プレイリスト取得
  const fetchUserPlaylists = async (sort) => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('ユーザーが認証されていません');
      }

      let q;
      if (sort === 'updatedAt') {
        // 更新日順
        q = query(
          collection(firestore, 'playlists'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc')
        );
      } else if (sort === 'title') {
        // タイトルのアルファベット順
        q = query(
          collection(firestore, 'playlists'),
          where('userId', '==', user.uid),
          orderBy('title', 'asc')
        );
      } else {
        // デフォルトのソート（更新日順）
        q = query(
          collection(firestore, 'playlists'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const userPlaylists = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('プレイリストの取得中にエラーが発生しました:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPlaylists(sortOption);
    if (firstButtonRef.current) {
      firstButtonRef.current.focus();
    }
  }, [sortOption]);

  const handleAddSongToPlaylist = async (playlistId) => {
    try {
      setError(null);
      console.log('Adding song to playlist:', { songId, playlistId });
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error('ユーザーが認証されていません');
      }

      // songIdが数値でない場合は数値に変換
      const numericSongId = typeof songId === 'string' ? parseInt(songId, 10) : songId;
      if (isNaN(numericSongId)) {
        throw new Error('無効な曲IDです');
      }

      const playlistRef = doc(firestore, 'playlists', playlistId);
      const playlistDoc = await getDoc(playlistRef);

      if (!playlistDoc.exists()) {
        throw new Error('プレイリストが存在しません');
      }

      const playlistData = playlistDoc.data();
      if (playlistData.userId !== user.uid) {
        throw new Error('このプレイリストにアクセスする権限がありません');
      }

      console.log('Updating playlist with song ID:', numericSongId);
      await updateDoc(playlistRef, {
        songIds: arrayUnion(String(numericSongId)),
        updatedAt: serverTimestamp(),
      });

      setSnackbar({
        open: true,
        message: '曲がプレイリストに追加されました',
        severity: 'success',
      });
      onClose();
    } catch (error) {
      console.error('曲の追加中にエラーが発生しました:', error);
      setError(error.message);
      setSnackbar({
        open: true,
        message: `エラー: ${error.message}`,
        severity: 'error',
      });
    }
  };

  const handleCreateNewPlaylist = () => {
    setShowNewPlaylistPopup(true);
  };

  const handleCloseNewPlaylistPopup = () => {
    setShowNewPlaylistPopup(false);
    fetchUserPlaylists(sortOption);
  };

  // 背景クリックでポップアップを閉じる
  const handleBackgroundClick = (e) => {
    if (e.target.className === 'save-to-playlist-popup') {
      onClose();
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Escapeキーでポップアップを閉じる
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="save-to-playlist-popup" onClick={handleBackgroundClick}>
      <div className="popup-content">
        <h2>プレイリストに保存</h2>
        {error && <p className="error">{error}</p>}

        <div className="sort-container">
          <label htmlFor="sort-select">ソート順:</label>
          <select
            id="sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="sort-select"
          >
            <option value="updatedAt">更新日順</option>
            <option value="title">アルファベット順</option>
          </select>
        </div>

        <button
          className="new-playlist-button"
          onClick={handleCreateNewPlaylist}
          ref={firstButtonRef}
        >
          + New Playlist
        </button>

        {loading ? (
          <p className="loading">読み込み中...</p>
        ) : playlists.length > 0 ? (
          <div className="playlist-list-container">
            <ul className="playlist-list">
              {playlists.map((playlist) => {
                // 曲数 (playlist.songIds?.length || 0)
                // 更新日 YYYY.MM.DD (formatUpdatedDateOnly)
                const playlistDate = formatUpdatedDateOnly(playlist.updatedAt);
                return (
                  <li key={playlist.id}>
                    <button onClick={() => handleAddSongToPlaylist(playlist.id)}>
                      {playlist.title} ({playlist.songIds?.length || 0}) {playlistDate}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="no-playlists">プレイリストがありません。まずは新規作成してください。</p>
        )}

        <button className="close-button" onClick={onClose}>
          閉じる
        </button>
      </div>

      {showNewPlaylistPopup && (
        <NewPlaylistPopup
          songId={songId}
          onClose={handleCloseNewPlaylistPopup}
          onPlaylistCreated={() => {
            setShowNewPlaylistPopup(false);
            fetchUserPlaylists(sortOption);
          }}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default SaveToPlaylistPopup;
