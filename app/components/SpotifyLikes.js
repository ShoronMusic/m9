'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Spotify APIを使った「いいね」判定（ページ内曲のみ）
export const useSpotifyLikes = (accessToken, trackIds = []) => {
  const [likedTracks, setLikedTracks] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const retryTimeoutRef = useRef(null);

  // エラーをクリアする関数
  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  // リトライ処理
  const retryOperation = useCallback((operation, delay = 1000) => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        operation();
      }, delay * (retryCount + 1)); // 指数バックオフ
    } else {
      setError('複数回の試行に失敗しました。手動で再読み込みしてください。');
    }
  }, [retryCount]);

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
                // 認証エラーの場合、リトライを試行
                throw new Error('AUTH_ERROR_401');
              } else if (response.status === 429) {
                // レート制限の場合、少し待ってからリトライ
                throw new Error('RATE_LIMIT_429');
              } else {
                const errorText = await response.text();
                console.error('Failed to fetch liked tracks:', response.status, errorText);
                throw new Error(`API_ERROR_${response.status}`);
              }
            }
            
            const likedArray = await response.json();
            batch.forEach((id, index) => {
              if (likedArray[index]) {
                allLikedTracks.add(id);
              }
            });
          }
          
          setLikedTracks(allLikedTracks);
          setRetryCount(0); // 成功時にリトライカウントをリセット
        } catch (error) {
          console.error('Error fetching liked tracks:', error);
          
          if (error.message === 'AUTH_ERROR_401') {
            setError('認証エラー: Spotifyに再ログインしてください');
            // 認証エラーの場合はリトライしない
          } else if (error.message === 'RATE_LIMIT_429') {
            setError('レート制限により一時的に利用できません。しばらく待ってから再試行してください。');
            // レート制限の場合は自動リトライ
            retryOperation(fetchLikedTracks, 2000);
          } else if (error.message.startsWith('API_ERROR_')) {
            setError(`API エラーが発生しました (${error.message.replace('API_ERROR_', '')})`);
            // APIエラーの場合はリトライ
            retryOperation(fetchLikedTracks);
          } else {
            setError('ネットワークエラーが発生しました');
            // ネットワークエラーの場合はリトライ
            retryOperation(fetchLikedTracks);
          }
          
          setLikedTracks(new Set());
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchLikedTracks();
    } else {
      setLikedTracks(new Set());
      setError(null);
      setRetryCount(0);
    }

    // クリーンアップ関数
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [accessToken, trackIds.join(','), retryOperation]);

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
      } else if (response.status === 429) {
        setError('レート制限により一時的に利用できません。しばらく待ってから再試行してください。');
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
      } else if (response.status === 429) {
        setError('レート制限により一時的に利用できません。しばらく待ってから再試行してください。');
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
  const toggleLike = useCallback(async (trackId) => {
    const isCurrentlyLiked = likedTracks.has(trackId);
    
    if (isCurrentlyLiked) {
      return await removeFromLikedTracks(trackId);
    } else {
      return await addToLikedTracks(trackId);
    }
  }, [likedTracks, addToLikedTracks, removeFromLikedTracks]);

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

  // 手動リフレッシュ
  const refreshLikes = useCallback(() => {
    if (accessToken && trackIds.length > 0) {
      setRetryCount(0);
      setError(null);
      // useEffectが再実行されるように、依存配列を一時的に変更
      const currentTrackIds = [...trackIds];
      setLikedTracks(new Set());
      setTimeout(() => {
        // 実際のリフレッシュ処理
        const fetchLikedTracks = async () => {
          setIsLoading(true);
          try {
            const batchSize = 50;
            const batches = [];
            for (let i = 0; i < currentTrackIds.length; i += batchSize) {
              batches.push(currentTrackIds.slice(i, i + batchSize));
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
                throw new Error(`API エラー: ${response.status}`);
              }
              
              const likedArray = await response.json();
              batch.forEach((id, index) => {
                if (likedArray[index]) {
                  allLikedTracks.add(id);
                }
              });
            }
            
            setLikedTracks(allLikedTracks);
            setError(null);
          } catch (error) {
            console.error('Manual refresh error:', error);
            setError(error.message);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchLikedTracks();
      }, 100);
    }
  }, [accessToken, trackIds]);

  return {
    likedTracks,
    isLoading,
    error,
    retryCount,
    maxRetries,
    addToLikedTracks,
    removeFromLikedTracks,
    toggleLike,
    updateLikedStatus,
    refreshLikes,
    clearError,
  };
}; 