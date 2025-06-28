'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export const PlayerContext = createContext(null);

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const [trackList, setTrackList] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
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

  // Stale closureを避けるために最新のステートをrefで保持
  const stateRef = useRef();
  useEffect(() => {
    stateRef.current = {
      trackList,
      currentTrack,
      currentTrackIndex,
      isPlaying
    };
  });

  const playTrack = useCallback((track, index, songs, source, onPageEnd = null) => {
    // 新しいソースの場合、トラックリストを更新
    if (source !== currentTrackListSource.current) {
        // 状態を完全にリセット
        setCurrentTrack(null);
        setCurrentTrackIndex(-1);
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
        
        // トラックリストを更新
        setTrackList(songs);
        currentTrackListSource.current = source;
    }
    
    // 次ページ遷移コールバックを保存
    onPageEndRef.current = onPageEnd;
    
    const newTrack = {
      ...track,
      artist: track.artistName,
      title: track.title.rendered,
      thumbnail: track.featured_media_url_thumbnail || track.featured_media_url || '/placeholder.jpg',
      spotify_url: track.acf?.spotify_url,
    };
    setCurrentTrack(newTrack);
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    // 新しい曲が開始されたら位置をリセット
    setPosition(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.currentTrack) return;
    setIsPlaying(prev => !prev);
  }, []);

  const playNext = useCallback(() => {
    // refから最新のstateを取得
    const { trackList, currentTrack, currentTrackIndex } = stateRef.current;
    
    if (trackList.length === 0) {
      return;
    }

    let currentIndex = -1;

    // 1. まずは state の currentTrackIndex を信頼する
    if (currentTrackIndex !== undefined && currentTrackIndex >= 0 && currentTrackIndex < trackList.length) {
      const trackAtStateIndex = trackList[currentTrackIndex];
      // 念のため、インデックスの曲と現在の曲が一致するか確認
      if (trackAtStateIndex && currentTrack && (trackAtStateIndex.id === currentTrack.id || (trackAtStateIndex.spotifyTrackId && trackAtStateIndex.spotifyTrackId === currentTrack.spotifyTrackId))) {
        currentIndex = currentTrackIndex;
      }
    }

    // 2. stateのインデックスが信頼できない場合、IDで再検索する
    if (currentIndex === -1 && currentTrack) {
      const currentTrackId = currentTrack?.spotifyTrackId || currentTrack?.id;
      const currentId = currentTrack?.id;

      currentIndex = trackList.findIndex(track => 
        (track.spotifyTrackId && track.spotifyTrackId === currentTrackId) || 
        (track.id && track.id === currentId)
      );
    }
    
    if (currentIndex === -1) {
      setCurrentTrack(trackList[0]);
      setCurrentTrackIndex(0);
      setIsPlaying(true);
      setPosition(0);
      return;
    }
    
    const nextIndex = currentIndex + 1;
    
    // 最後の曲に到達した場合の処理
    if (nextIndex >= trackList.length) {
      // 次ページ遷移コールバックがある場合は呼び出す
      if (onPageEndRef.current && typeof onPageEndRef.current === 'function') {
        try {
          onPageEndRef.current();
        } catch (error) {
          // エラーハンドリング
        }
      } else {
        // コールバックがない場合は最初の曲に戻る
        setCurrentTrack(trackList[0]);
        setCurrentTrackIndex(0);
        setIsPlaying(true);
        setPosition(0);
      }
      return;
    }
    
    const nextTrack = trackList[nextIndex];
    
    if (!nextTrack) {
      return;
    }
    
    setCurrentTrack(nextTrack);
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true);
    setPosition(0);
  }, []);

  const playPrevious = useCallback(() => {
    if (trackList.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + trackList.length) % trackList.length;
    setCurrentTrack(trackList[prevIndex]);
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true);
    setPosition(0);
  }, [currentTrackIndex, trackList]);

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
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}; 