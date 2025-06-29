'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export const PlayerContext = createContext(null);

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
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
    console.log('playTrack set:', {
      newTrack,
      index,
      songsLength: songs.length,
      source
    });
  }, []);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.currentTrack) return;
    setIsPlaying(prev => !prev);
  }, []);

  const playNext = useCallback(() => {
    const { trackList, currentTrack } = stateRef.current;
    console.log('playNext called', { trackListLength: trackList.length, currentTrack });
    if (trackList.length === 0) return;

    // 現在の曲のインデックスを再計算
    let currentIndex = trackList.findIndex(
      track => (track.spotifyTrackId && track.spotifyTrackId === (currentTrack?.spotifyTrackId || currentTrack?.id)) ||
               (track.id && track.id === currentTrack?.id)
    );

    if (currentIndex === -1) {
      // 見つからなければ最初の曲
      setCurrentTrack(trackList[0]);
      setCurrentTrackIndex(0);
      setIsPlaying(true);
      setPosition(0);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= trackList.length) {
      // 最後の曲ならonPageEnd
      if (onPageEndRef.current && typeof onPageEndRef.current === 'function') {
        try {
          onPageEndRef.current();
        } catch (error) {
          // エラーハンドリング
        }
      }
      return;
    }

    const nextTrack = trackList[nextIndex];
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