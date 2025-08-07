'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { updatePlayerStateInSW, getPlayerStateFromSW, getDeviceInfo, detectPowerSaveMode } from '@/lib/sw-utils';
import { PlayTracker } from '@/lib/playTracker';
import { useSession } from 'next-auth/react';

export const PlayerContext = createContext(null);

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const { data: session } = useSession();
  const [trackList, setTrackList] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const [isMuted, setIsMuted] = useState(false);
  
  // 再生時間の状態を追加
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  
  // SpotifyPlayerのrefを保持
  const spotifyPlayerRef = useRef(null);
  
  // A ref to hold the source of the track list (e.g., 'style/pop/1')
  // This helps prevent re-loading the same list unnecessarily
  const currentTrackListSource = useRef(null);

  // 次ページ遷移用のコールバックを保持
  const onPageEndRef = useRef(null);

  // ページの可視性状態を管理
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [wasPlayingBeforeHidden, setWasPlayingBeforeHidden] = useState(false);
  
  // デバイス情報と省電力モード
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [isPowerSaveMode, setIsPowerSaveMode] = useState(false);

  // 視聴履歴追跡
  const [playTracker, setPlayTracker] = useState(null);

  // Stale closureを避けるために最新のステートをrefで保持
  const stateRef = useRef();
  useEffect(() => {
    stateRef.current = {
      trackList,
      currentTrack,
      currentTrackIndex,
      isPlaying,
      isPageVisible
    };
  });

  // デバイス情報の初期化
  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);
    
    // 省電力モードの検出
    detectPowerSaveMode().then(isPowerSave => {
      setIsPowerSaveMode(isPowerSave);
    });
  }, []);

  // 視聴履歴追跡の初期化
  useEffect(() => {
    if (session?.user?.id) {
      const tracker = new PlayTracker(session.user.id);
      setPlayTracker(tracker);
    }
  }, [session]);

  // ページの可視性変更を監視
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (!isVisible) {
        // ページが非表示になった時
        setWasPlayingBeforeHidden(isPlaying);
        console.log('Page hidden, was playing:', isPlaying);
        
        // Service Workerに状態を送信
        if (currentTrack) {
          const playerState = {
            currentTrack,
            currentTrackIndex,
            isPlaying,
            position,
            volume,
            isMuted,
            trackListSource: currentTrackListSource.current,
            timestamp: Date.now()
          };
          updatePlayerStateInSW(playerState);
        }
      } else {
        // ページが表示された時
        console.log('Page visible, was playing before hidden:', wasPlayingBeforeHidden);
        if (wasPlayingBeforeHidden && currentTrack) {
          // 非表示前に再生中だった場合は再生を再開
          setTimeout(() => {
            setIsPlaying(true);
          }, 500); // 少し遅延を入れて安定化
        }
      }
    };

    // ページの可視性変更イベントを監視
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ページのフォーカス変更も監視
    const handleFocus = () => {
      if (wasPlayingBeforeHidden && currentTrack) {
        setTimeout(() => {
          setIsPlaying(true);
        }, 300);
      }
    };
    
    const handleBlur = () => {
      setWasPlayingBeforeHidden(isPlaying);
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPlaying, wasPlayingBeforeHidden, currentTrack]);

  // バックグラウンドでの状態保持のための永続化
  useEffect(() => {
    const savePlayerState = () => {
      if (currentTrack) {
        const playerState = {
          currentTrack,
          currentTrackIndex,
          isPlaying,
          position,
          volume,
          isMuted,
          trackListSource: currentTrackListSource.current,
          timestamp: Date.now()
        };
        try {
          sessionStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
          
          // Service Workerにも送信
          updatePlayerStateInSW(playerState);
          
          console.log('Player state saved:', {
            track: currentTrack?.title || currentTrack?.name,
            index: currentTrackIndex,
            isPlaying,
            source: currentTrackListSource.current
          });
        } catch (error) {
          console.error('Failed to save player state:', error);
        }
      }
    };

    // 状態変更時に永続化
    savePlayerState();
  }, [currentTrack, currentTrackIndex, isPlaying, position, volume, isMuted]);

  // ページ読み込み時の状態復元
  useEffect(() => {
    const restorePlayerState = async () => {
      try {
        // まずService Workerから状態を取得
        const swState = await getPlayerStateFromSW();
        let playerState = null;
        
        if (swState) {
          const now = Date.now();
          const timeDiff = now - swState.timestamp;
          
          // 30分以内の状態のみ復元
          if (timeDiff < 30 * 60 * 1000) {
            playerState = swState;
          }
        }
        
        // Service Workerから取得できない場合はsessionStorageから
        if (!playerState) {
          const savedState = sessionStorage.getItem('tunedive_player_state');
          if (savedState) {
            playerState = JSON.parse(savedState);
            const now = Date.now();
            const timeDiff = now - playerState.timestamp;
            
            // 30分以内の状態のみ復元
            if (timeDiff >= 30 * 60 * 1000) {
              playerState = null;
            }
          }
        }
        
        if (playerState) {
          console.log('Restoring player state:', {
            track: playerState.currentTrack?.title || playerState.currentTrack?.name,
            index: playerState.currentTrackIndex,
            isPlaying: playerState.isPlaying,
            source: playerState.trackListSource,
            timestamp: new Date(playerState.timestamp).toLocaleString()
          });
          
          setCurrentTrack(playerState.currentTrack);
          setCurrentTrackIndex(playerState.currentTrackIndex);
          setVolume(playerState.volume);
          setIsMuted(playerState.isMuted);
          setPosition(playerState.position);
          currentTrackListSource.current = playerState.trackListSource;
          
          // ページが表示されている場合のみ再生状態を復元
          if (isPageVisible && playerState.isPlaying) {
            setTimeout(() => {
              setIsPlaying(true);
            }, 1000);
          }
          
          console.log('Player state restored successfully');
        }
      } catch (error) {
        console.error('Failed to restore player state:', error);
      }
    };

    // ページ読み込み時に状態を復元
    restorePlayerState();
  }, [isPageVisible]);

  // 省電力モードでの最適化
  useEffect(() => {
    if (isPowerSaveMode) {
      console.log('Power save mode detected, optimizing player');
      // 省電力モードでは更新頻度を下げる
      // バックグラウンド処理を最小限に
    }
  }, [isPowerSaveMode]);

  const playTrack = useCallback((track, index, songs, source, onPageEnd = null) => {
    if (source !== currentTrackListSource.current) {
        // 状態を完全にリセット
        setCurrentTrack(null);
        setCurrentTrackIndex(-1);
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
        setTrackList(songs);
        currentTrackListSource.current = source;
    } else {
        // すでに同じsourceで同じ曲なら何もしない
        if (currentTrack && currentTrack.id === track.id) return;
    }
    // 次ページ遷移コールバックを保存
    onPageEndRef.current = onPageEnd;
    const newTrack = {
      ...track,
      artist: track.artistName,
      title: track.title?.rendered || track.title,
      thumbnail: track.featured_media_url_thumbnail || track.featured_media_url || (track.album?.images?.[0]?.url) || track.thumbnail || '/placeholder.jpg',
      spotify_url: track.acf?.spotify_url,
    };
    setCurrentTrack(newTrack);
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setPosition(0);
    
    // 視聴履歴追跡を開始
    if (playTracker && session?.user?.id) {
      playTracker.startTracking(newTrack, track.id, source);
    }
    
    console.log('playTrack set:', {
      newTrack,
      index,
      songsLength: songs.length,
      source
    });
  }, [playTracker, session]);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.currentTrack) return;
    setIsPlaying(prev => !prev);
  }, []);

  const playNext = useCallback(() => {
    const { trackList, currentTrack, currentTrackIndex } = stateRef.current;
    console.log('playNext called', { 
      trackListLength: trackList.length, 
      currentTrack, 
      currentTrackIndex,
      currentTrackId: currentTrack?.spotifyTrackId || currentTrack?.id 
    });
    
    if (trackList.length === 0) return;

    // まず保存されたインデックスを使用
    let currentIndex = currentTrackIndex;
    
    // 保存されたインデックスが無効な場合のみ再計算
    if (currentIndex === -1 || currentIndex >= trackList.length) {
      currentIndex = trackList.findIndex(
        track => (track.spotifyTrackId && track.spotifyTrackId === (currentTrack?.spotifyTrackId || currentTrack?.id)) ||
                 (track.id && track.id === currentTrack?.id)
      );
    }

    console.log('Current index determined:', currentIndex);

    if (currentIndex === -1) {
      // 見つからなければ最初の曲
      console.log('Track not found, playing first track');
      setCurrentTrack(trackList[0]);
      setCurrentTrackIndex(0);
      setIsPlaying(true);
      setPosition(0);
      return;
    }

    const nextIndex = currentIndex + 1;
    console.log('Next index:', nextIndex, 'Track list length:', trackList.length);

    if (nextIndex >= trackList.length) {
      // 最後の曲ならonPageEnd
      console.log('Reached end of track list, calling onPageEnd');
      if (onPageEndRef.current && typeof onPageEndRef.current === 'function') {
        try {
          onPageEndRef.current();
        } catch (error) {
          console.error('Error in onPageEnd:', error);
        }
      }
      return;
    }

    const nextTrack = trackList[nextIndex];
    console.log('Playing next track:', nextTrack?.title || nextTrack?.name, 'at index:', nextIndex);
    setCurrentTrack(nextTrack);
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
    setPosition(0);
    
    // 視聴履歴追跡を開始
    if (playTracker && session?.user?.id) {
      playTracker.startTracking(nextTrack, nextTrack.id, currentTrackListSource.current);
    }
  }, [playTracker, session]);

  const playPrevious = useCallback(() => {
    if (trackList.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + trackList.length) % trackList.length;
    setCurrentTrack(trackList[prevIndex]);
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true);
    setPosition(0);
    
    // 視聴履歴追跡を開始
    if (playTracker && session?.user?.id) {
      playTracker.startTracking(trackList[prevIndex], trackList[prevIndex].id, currentTrackListSource.current);
    }
  }, [currentTrackIndex, trackList, playTracker, session]);

  // 再生時間と位置を更新する関数
  const updatePlaybackState = useCallback((newDuration, newPosition) => {
    setDuration(newDuration);
    setPosition(newPosition);
  }, []);

  // シーク機能
  const seekTo = useCallback((newPosition) => {
    if (spotifyPlayerRef.current && spotifyPlayerRef.current.seekTo) {
      spotifyPlayerRef.current.seekTo(newPosition);
      // 即座に位置を更新
      setPosition(newPosition);
    }
  }, []);

  // SpotifyPlayerから状態を更新する関数
  const updateCurrentTrackState = useCallback((newTrack, newIndex) => {
    setCurrentTrack(newTrack);
    setCurrentTrackIndex(newIndex);
  }, []);

  // 曲が終了した時の処理
  const handleTrackEnd = useCallback(() => {
    if (playTracker) {
      playTracker.stopTracking(true); // 完了として記録
    }
    playNext();
  }, [playTracker, playNext]);

  const value = {
    trackList,
    setTrackList,
    currentTrack,
    currentTrackIndex,
    isPlaying,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    duration,
    position,
    playTrack,
    togglePlay,
    playNext,
    playPrevious,
    updatePlaybackState,
    seekTo,
    spotifyPlayerRef,
    updateCurrentTrackState,
    isPageVisible,
    deviceInfo,
    isPowerSaveMode,
    handleTrackEnd,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}; 