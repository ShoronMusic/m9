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

  const playTrack = useCallback((track, index, songs, source) => {
    console.log('=== PLAYTRACK START ===');
    console.log('playTrack called:', {
      trackName: track?.name || track?.title?.rendered,
      trackId: track?.spotifyTrackId || track?.id,
      index,
      source,
      currentTrackId: currentTrack?.spotifyTrackId || currentTrack?.id
    });
    
    if (source !== currentTrackListSource.current) {
        console.log('Updating track list for new source:', source);
        setTrackList(songs);
        currentTrackListSource.current = source;
    }
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
    
    console.log('playTrack completed:', {
      newTrackName: track?.name || track?.title?.rendered,
      newTrackId: track?.spotifyTrackId || track?.id,
      newIndex: index
    });
    console.log('=== PLAYTRACK END ===');
  }, [currentTrack]);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.currentTrack) return;
    setIsPlaying(prev => !prev);
  }, []);

  const playNext = useCallback(() => {
    // refから最新のstateを取得
    const { trackList, currentTrack } = stateRef.current;

    console.log('playNext called with state from ref:', {
      trackListLength: trackList.length,
      currentTrack: currentTrack?.name || currentTrack?.title?.rendered,
      currentTrackId: currentTrack?.spotifyTrackId || currentTrack?.id,
    });
    
    if (trackList.length === 0) {
      console.log('Track list is empty, cannot play next');
      return;
    }
    
    const currentTrackId = currentTrack?.spotifyTrackId || currentTrack?.id;
    // 現在の曲のインデックスをリストから毎回再検索する
    let currentIndex = trackList.findIndex(track => 
      (track?.spotifyTrackId || track?.id) === currentTrackId
    );

    if (currentIndex === -1) {
      console.error('Current track not found in tracklist, cannot play next. Defaulting to first track.');
      // 見つからない場合は、リストの最初の曲を再生するなどのフォールバック処理
      currentIndex = -1; 
    }
    
    const nextIndex = (currentIndex + 1) % trackList.length;
    const nextTrack = trackList[nextIndex];
    
    console.log('Playing next track:', {
      currentIndex,
      nextIndex,
      nextTrackName: nextTrack?.name || nextTrack?.title?.rendered,
      nextTrackId: nextTrack?.spotifyTrackId || nextTrack?.id,
    });
    
    if (!nextTrack) {
      console.error('Next track is null or undefined');
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
    console.log('PlayerContext seekTo called:', {
      newPosition,
      spotifyPlayerRef: !!spotifyPlayerRef,
      spotifyPlayerRefCurrent: !!spotifyPlayerRef?.current,
      seekToMethod: !!(spotifyPlayerRef?.current?.seekTo)
    });
    
    if (spotifyPlayerRef.current && spotifyPlayerRef.current.seekTo) {
      console.log('Calling spotifyPlayerRef.current.seekTo with position:', newPosition);
      spotifyPlayerRef.current.seekTo(newPosition);
      // 即座に位置を更新
      setPosition(newPosition);
    } else {
      console.error('spotifyPlayerRef.current.seekTo is not available');
    }
  }, []);

  // SpotifyPlayerから状態を更新する関数
  const updateCurrentTrackState = useCallback((newTrack, newIndex) => {
    console.log('Updating current track state:', {
      newTrackName: newTrack?.name || newTrack?.title?.rendered,
      newTrackId: newTrack?.spotifyTrackId || newTrack?.id,
      newIndex,
      currentTrackName: currentTrack?.name || currentTrack?.title?.rendered,
      currentTrackId: currentTrack?.spotifyTrackId || currentTrack?.id,
      currentIndex: currentTrackIndex
    });
    
    setCurrentTrack(newTrack);
    setCurrentTrackIndex(newIndex);
  }, [currentTrack, currentTrackIndex]);

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