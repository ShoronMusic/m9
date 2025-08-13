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

  // プレイリスト更新の状態管理
  const [playlistUpdateTrigger, setPlaylistUpdateTrigger] = useState(0);

  // プレイリスト更新をトリガーする関数
  const triggerPlaylistUpdate = useCallback(() => {
    setPlaylistUpdateTrigger(prev => prev + 1);
  }, []);

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

  // 認証エラー状態の管理
  const [authError, setAuthError] = useState(false);

  // 認証エラーの監視（一時的に無効化）
  useEffect(() => {
    const checkAuthError = () => {
      const hasAuthError = sessionStorage.getItem('spotify_auth_error');
      if (hasAuthError) {
        // エラーフラグを自動的にクリア
        sessionStorage.removeItem('spotify_auth_error');
        console.warn('認証エラーフラグをクリアしました');
      }
      setAuthError(false);
    };

    // 初回チェック
    checkAuthError();

    // 定期的にチェック（頻度を下げる）
    const interval = setInterval(checkAuthError, 30000); // 30秒に変更

    return () => clearInterval(interval);
  }, []);

  // 認証エラーが発生した場合の処理（アラートを無効化）
  useEffect(() => {
    if (authError) {
      console.warn('認証エラーが検出されました。Spotifyログインを再実行してください。');
      
      // プレイヤー状態をリセット
      setCurrentTrack(null);
      setCurrentTrackIndex(-1);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
      
      // エラーフラグをクリア
      sessionStorage.removeItem('spotify_auth_error');
      setAuthError(false);
      
      // アラートを無効化（開発環境でも表示しない）
      // if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && window.alert) {
      //   setTimeout(() => {
      //     alert('Spotify認証エラーが発生しました。ページを再読み込みしてSpotifyログインを再実行してください。');
      //   }, 1000);
      // }
    }
  }, [authError]);

  // ページロード時にプレイヤー状態をリセット
  useEffect(() => {
    // ページロード時にプレイヤー状態を完全にリセット
    setCurrentTrack(null);
    setCurrentTrackIndex(-1);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setTrackList([]);
    currentTrackListSource.current = null;
    
    // 保存された状態もクリア
    sessionStorage.removeItem('tunedive_player_state');
    sessionStorage.removeItem('spotify_auth_error');
    sessionStorage.removeItem('spotify_device_error');
    
    // 開発環境でのログを削除
  }, []); // 空の依存配列で初回のみ実行

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
    if (session?.user?.id && !playTracker) {
      const tracker = new PlayTracker(session.user.id);
      setPlayTracker(tracker);
      
      // ログイン時にエラーフラグをクリア
      sessionStorage.removeItem('spotify_auth_error');
      sessionStorage.removeItem('spotify_device_error');
      
      // 開発環境でのログを削除
    }
  }, [session, playTracker]);

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
      // ログイン前は状態を保存しない
      if (!session) {
        return;
      }
      
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
          
          // Player state saved silently
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
        // ログイン前は状態を復元しない
        if (!session) {
                  // 開発環境でのログを削除
          return;
        }
        
        // 認証エラーやデバイスエラーが発生した場合は状態をリセット
        const hasAuthError = sessionStorage.getItem('spotify_auth_error');
        const hasDeviceError = sessionStorage.getItem('spotify_device_error');
        
        if (hasAuthError || hasDeviceError) {
          // 開発環境でのログを削除
          // エラーフラグをクリア
          sessionStorage.removeItem('spotify_auth_error');
          sessionStorage.removeItem('spotify_device_error');
          // 保存された状態をクリア
          sessionStorage.removeItem('tunedive_player_state');
          return;
        }
        
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
          // 開発環境でのログを削除
          
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
          
          // 開発環境でのログを削除
        }
      } catch (error) {
        console.error('Failed to restore player state:', error);
      }
    };

    // ページ読み込み時に状態を復元
    restorePlayerState();
  }, [isPageVisible, session]);

  // 省電力モードでの最適化
  useEffect(() => {
    if (isPowerSaveMode) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Power save mode detected, optimizing player');
      }
      // 省電力モードでは更新頻度を下げる
      // バックグラウンド処理を最小限に
    }
  }, [isPowerSaveMode]);

  const playTrack = useCallback((track, index, songs, source, onPageEnd = null) => {
    console.log('🎵 PlayerContext - playTrack called:', {
      track,
      index,
      songsLength: songs?.length,
      source,
      currentSource: currentTrackListSource.current,
      isNewSource: source !== currentTrackListSource.current
    });
    
    if (source !== currentTrackListSource.current) {
        console.log('🔄 PlayerContext - New source detected, resetting state');
        // 状態を完全にリセット
        setCurrentTrack(null);
        setCurrentTrackIndex(-1);
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
        setTrackList(songs);
        currentTrackListSource.current = source;
    } else {
        console.log('🔄 PlayerContext - Same source, checking for duplicate track');
        // すでに同じsourceで同じ曲なら何もしない
        if (currentTrack && currentTrack.id === track.id) {
          console.log('⏭️ PlayerContext - Same track, skipping');
          return;
        }
        
        // 同じsourceだが曲リストが変わった場合、リストを更新
        if (songs !== trackList) {
          console.log('🔄 PlayerContext - Updating track list');
          setTrackList(songs);
        }
    }
    
    // 次ページ遷移コールバックを保存
    onPageEndRef.current = onPageEnd;
    const newTrack = {
      ...track,
      artist: track.artistName,
      title: track.title?.rendered || track.title,
      thumbnail: track.featured_media_url_thumbnail || track.featured_media_url || (track.album?.images?.[0]?.url) || track.thumbnail || '/placeholder.jpg',
      spotify_url: track.acf?.spotify_url,
      // Spotify track IDを明示的に保持
      spotify_track_id: track.spotify_track_id || track.spotifyTrackId || track.acf?.spotify_track_id,
      // スタイル・ジャンル情報を保持
      styles: track.styles,
      genres: track.genres,
    };
    
    console.log('🎵 PlayerContext - Track transformation:', {
      originalSpotifyTrackId: track.spotify_track_id,
      originalSpotifyTrackIdAlt: track.spotifyTrackId,
      originalAcfSpotifyTrackId: track.acf?.spotify_track_id,
      newSpotifyTrackId: newTrack.spotify_track_id
    });
    
    // 現在の曲の再生を停止
    if (playTracker) {
      playTracker.stopTracking(false); // 中断として記録
    }
    
    console.log('🔄 PlayerContext - Clearing previous track state');
    // 前の曲の情報を即座にクリアしてから新しい曲を設定
    setCurrentTrack(null);
    setCurrentTrackIndex(-1);
    setIsPlaying(false);
    setPosition(0);
    
    console.log('🔄 PlayerContext - Scheduling new track state update');
    // 次のフレームで新しい曲を設定（状態のクリアを確実にする）
    requestAnimationFrame(() => {
      console.log('🎵 PlayerContext - Setting new track state:', {
        newTrack,
        index,
        isPlaying: true
      });
      
      setCurrentTrack(newTrack);
      setCurrentTrackIndex(index);
      setIsPlaying(true);
      setPosition(0);
      
      console.log('✅ PlayerContext - New track state set successfully');
      
      // 視聴履歴追跡を開始（重複を防ぐため一度だけ呼び出し）
      if (playTracker && session?.user?.id) {
        console.log('📊 PlayerContext - Starting play tracking');
        playTracker.startTracking(newTrack, track.id, source);
      }
    });
  }, [playTracker, session, currentTrack, trackList]);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.currentTrack) {
      return;
    }
    
    // 現在の曲が新しいリストに含まれているかチェック
    const { trackList, currentTrack } = stateRef.current;
    const trackExists = trackList.some(
      track => (track.spotifyTrackId && track.spotifyTrackId === (currentTrack?.spotifyTrackId || currentTrack?.id)) ||
               (track.id && track.id === currentTrack?.id)
    );
    
    if (!trackExists) {
      return;
    }
    
    setIsPlaying(prev => !prev);
  }, []);

  const playNext = useCallback(() => {
    const { trackList, currentTrack, currentTrackIndex } = stateRef.current;
    
    if (trackList.length === 0) {
      return;
    }

    // まず保存されたインデックスを使用
    let currentIndex = currentTrackIndex;
    
    // 保存されたインデックスが無効な場合のみ再計算
    if (currentIndex === -1 || currentIndex >= trackList.length) {
      currentIndex = trackList.findIndex(
        track => (track.spotifyTrackId && track.spotifyTrackId === (currentTrack?.spotifyTrackId || currentTrack?.id)) ||
                 (track.id && track.id === currentTrack?.id)
      );
    }

    if (currentIndex === -1) {
      // 見つからなければ最初の曲
      setCurrentTrack(trackList[0]);
      setCurrentTrackIndex(0);
      setIsPlaying(true);
      setPosition(0);
      
      // 視聴履歴追跡を開始
      if (playTracker && session?.user?.id) {
        playTracker.startTracking(trackList[0], trackList[0].id, currentTrackListSource.current);
      }
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= trackList.length) {
      // 最後の曲ならonPageEnd
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
    
    // 現在の曲の再生を停止
    if (playTracker) {
      playTracker.stopTracking(true); // 完了として記録
    }
    
    // 少し遅延してから次の曲を再生
    setTimeout(() => {
      setCurrentTrack(nextTrack);
      setCurrentTrackIndex(nextIndex);
      setIsPlaying(true);
      setPosition(0);
      
      // 視聴履歴追跡を開始
      if (playTracker && session?.user?.id) {
        playTracker.startTracking(nextTrack, nextTrack.id, currentTrackListSource.current);
      }
    }, 100);
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
    
    // 現在の状態を確認
    const { trackList, currentTrack, currentTrackIndex } = stateRef.current;
    
    // トップページ特有のデバッグ情報
    if (currentTrackListSource.current && currentTrackListSource.current.includes('top')) {
      // トップページの場合は何もしない（ログも出力しない）
    }
    
    playNext();
  }, [playTracker, playNext]);

  // isPlayingの状態変更を監視して視聴履歴を記録
  useEffect(() => {
    if (playTracker && !isPlaying && currentTrack) {
      // 再生が停止された時に視聴履歴を記録
      playTracker.stopTracking(false); // 中断として記録
    }
  }, [isPlaying, playTracker, currentTrack]);

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
    // プレイリスト更新関連
    playlistUpdateTrigger,
    triggerPlaylistUpdate,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

// デフォルトエクスポートを追加
export default PlayerProvider; 