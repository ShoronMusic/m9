import React, { useState } from 'react';
import { firestore, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const NewPlaylistPopup = ({ songId, onClose, onPlaylistCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false); // 公開状態を管理
  const [creating, setCreating] = useState(false);

  const handleCreatePlaylist = async () => {
    if (!title) {
      alert('タイトルを入力してください');
      return;
    }

    setCreating(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('ユーザーが認証されていません');
      }

      const playlistData = {
        userId: user.uid,
        title: title,
        description: description || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        songIds: [String(songId)],
        isPublic: isPublic, // 公開状態を保存
      };

      await addDoc(collection(firestore, 'playlists'), playlistData);

      alert('新しいプレイリストが作成され、曲が追加されました');
      setCreating(false);
      onPlaylistCreated();
    } catch (error) {
      console.error('プレイリストの作成中にエラーが発生しました:', error);
      setCreating(false);
    }
  };

  return (
    <div className="new-playlist-popup">
      <div className="popup-content">
        <h2>New Playlist</h2>
        <div className="form-group">
          <label htmlFor="playlist-title">タイトル（必須）:</label>
          <input
            id="playlist-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="プレイリストのタイトルを入力"
          />
        </div>

        <div className="form-group">
          <label htmlFor="playlist-description">説明:</label>
          <textarea
            id="playlist-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="プレイリストの説明を入力"
          />
        </div>

        {/* 公開設定のチェックボックスを追加 */}
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            公開する
          </label>
        </div>

        <div className="button-group">
          <button
            className="create-button"
            onClick={handleCreatePlaylist}
            disabled={creating}
          >
            {creating ? '作成中...' : '作成'}
          </button>
          <button className="cancel-button" onClick={onClose}>
            キャンセル
          </button>
        </div>
      </div>

      <style jsx>{`
        .new-playlist-popup {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }

        .popup-content {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
          max-width: 400px;
          width: 90%;
          text-align: center;
        }

        .form-group {
          margin-bottom: 20px;
          text-align: left;
        }

        .form-group label {
          font-weight: bold;
          display: block;
          margin-bottom: 8px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px;
          font-size: 14px;
          border: 1px solid #ccc;
          border-radius: 5px;
          box-sizing: border-box;
        }

        .form-group textarea {
          resize: vertical;
        }

        .button-group {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .create-button {
          background-color: #007bff;
          color: white;
          padding: 10px 15px;
          font-size: 14px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          flex: 1;
        }

        .create-button:disabled {
          background-color: #aaa;
          cursor: not-allowed;
        }

        .cancel-button {
          background-color: #f5f5f5;
          color: #333;
          padding: 10px 15px;
          font-size: 14px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          flex: 1;
        }

        .cancel-button:hover {
          background-color: #e0e0e0;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 5px; /* チェックボックスとテキストの間隔 */
        }

        .checkbox-label input[type='checkbox'] {
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default NewPlaylistPopup;
