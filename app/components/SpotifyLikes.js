'use client';

import { useState, useEffect, useCallback } from 'react';

// Spotify APIを使った「いいね」判定（ページ内曲のみ）
export const useSpotifyLikes = (accessToken, trackIds = []) => {
  const [likedTracks, setLikedTracks] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ページ内の曲だけ一括判定（useEffectで直接呼ぶ）
  useEffect(() => {
    if (accessToken && trackIds.length > 0) {
      const fetchLikedTracks = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // Spotify APIの制限（50曲ずつ）に合わせて分割
          const batchSize = 50;
          const batches = [];
          for (let i = 0; i < trackIds.length; i += batchSize) {
            batches.push(trackIds.slice(i, i + batchSize));
          }

          const allLikedTracks = new Set();
          
          for (const batch of batches) {
            const idsParam = batch.join(',');
            const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${idsParam}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            
            if (!response.ok) {
              if (response.status === 401) {
                throw new Error('認証エラー: Spotifyに再ログインしてください');
              }
              const errorText = await response.text();
              console.error('Failed to fetch liked tracks:', response.status, errorText);
              throw new Error(`いいね情報の取得に失敗しました (${response.status})`);
            }
            
            const likedArray = await response.json();
            batch.forEach((id, index) => {
              if (likedArray[index]) {
                allLikedTracks.add(id);
              }
            });
          }
          
          setLikedTracks(allLikedTracks);
        } catch (error) {
          console.error('Error fetching liked tracks:', error);
          setError(error.message);
          setLikedTracks(new Set());
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchLikedTracks();
    } else {
      setLikedTracks(new Set());
      setError(null);
    }
  }, [accessToken, trackIds.join(',')]);

  // いいね追加
  const addToLikedTracks = useCallback(async (trackId) => {
    if (!accessToken) {
      setError('Spotifyにログインしてください');
      return false;
    }
    
    try {
      setError(null);
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setLikedTracks(prev => new Set([...prev, trackId]));
        return true;
      } else if (response.status === 401) {
        setError('認証エラー: Spotifyに再ログインしてください');
        return false;
      } else {
        setError('いいねの追加に失敗しました');
        return false;
      }
    } catch (error) {
      console.error('Error adding to liked tracks:', error);
      setError('ネットワークエラーが発生しました');
      return false;
    }
  }, [accessToken]);

  // いいね解除
  const removeFromLikedTracks = useCallback(async (trackId) => {
    if (!accessToken) {
      setError('Spotifyにログインしてください');
      return false;
    }
    
    try {
      setError(null);
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setLikedTracks(prev => {
          const newSet = new Set(prev);
          newSet.delete(trackId);
          return newSet;
        });
        return true;
      } else if (response.status === 401) {
        setError('認証エラー: Spotifyに再ログインしてください');
        return false;
      } else {
        setError('いいねの解除に失敗しました');
        return false;
      }
    } catch (error) {
      console.error('Error removing from liked tracks:', error);
      setError('ネットワークエラーが発生しました');
      return false;
    }
  }, [accessToken]);

  // いいねの切り替え
  const toggleLike = useCallback(async (trackId, shouldLike) => {
    if (shouldLike) {
      return await addToLikedTracks(trackId);
    } else {
      return await removeFromLikedTracks(trackId);
    }
  }, [addToLikedTracks, removeFromLikedTracks]);

  // 手動でいいね状態を更新（外部からの変更に対応）
  const updateLikedStatus = useCallback((trackId, isLiked) => {
    setLikedTracks(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.add(trackId);
      } else {
        newSet.delete(trackId);
      }
      return newSet;
    });
  }, []);

  return {
    likedTracks,
    isLoading,
    error,
    addToLikedTracks,
    removeFromLikedTracks,
    toggleLike,
    updateLikedStatus,
  };
}; 