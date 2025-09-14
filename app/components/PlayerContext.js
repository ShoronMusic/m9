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

  // Wake Lock API
  const [wakeLock, setWakeLock] = useState(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState(false);
  const [wakeLockPersistenceTimer, setWakeLockPersistenceTimer] = useState(null);

  // プレイリスト更新をトリガーする関数
  const triggerPlaylistUpdate = useCallback(() => {
    setPlaylistUpdateTrigger(prev => prev + 1);
  }, []);

  // Wake Lockの取得
  const requestWakeLock = useCallback(async () => {
    if (!isWakeLockSupported || wakeLock) {
      return;
    }

    // ページが可視状態でない場合はWake Lockを取得しない
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.wakeLock) {
        return;
      }
      const wakeLockInstance = await navigator.wakeLock.request('screen');
      setWakeLock(wakeLockInstance);
      
      // Wake Lockが解放された時のイベント
      wakeLockInstance.addEventListener('release', () => {
        setWakeLock(null);
      });

      
      // Axiomにログを送信
      try {
        await fetch('/api/mobile-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level: 'info',
            type: 'wake_lock_acquired',
            message: 'Wake Lockを取得しました',
            details: {
              isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
              platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
              component: 'PlayerContext'
            }
          })
        });
      } catch (logError) {
        console.error('Failed to log wake lock acquisition:', logError);
      }
    } catch (error) {
      console.error('Failed to acquire wake lock:', error);
      
      // Axiomにエラーログを送信
      try {
        await fetch('/api/mobile-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level: 'error',
            type: 'wake_lock_error',
            message: `Wake Lock取得エラー: ${error.message}`,
            details: {
              error: error.message,
              isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
              platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
              component: 'PlayerContext'
            }
          })
        });
      } catch (logError) {
        console.error('Failed to log wake lock error:', logError);
      }
    }
  }, [isWakeLockSupported, wakeLock]);

  // Wake Lockの解放（永続化対応版）
  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        console.log('🔒 Wake Lock released successfully');
        
        // 永続化タイマーをクリア
        if (wakeLockPersistenceTimer) {
          clearTimeout(wakeLockPersistenceTimer);
          setWakeLockPersistenceTimer(null);
        }
        
        // Axiomにログを送信
        try {
          await fetch('/api/mobile-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              level: 'info',
              type: 'wake_lock_released',
              message: 'Wake Lockを解放しました',
              details: {
                isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
                platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                component: 'PlayerContext'
              }
            })
          });
        } catch (logError) {
          console.error('Failed to log wake lock release:', logError);
        }
      } catch (error) {
        console.error('Failed to release wake lock:', error);
      }
    }
  }, [wakeLock]);

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
  }, [trackList, currentTrack, currentTrackIndex, isPlaying, isPageVisible]);

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
      
      // Wake Lockを解放
      if (wakeLock) {
        releaseWakeLock();
      }
      
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
  }, [authError, wakeLock, releaseWakeLock]);

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
    localStorage.removeItem('tunedive_player_state');
    sessionStorage.removeItem('spotify_auth_error');
    sessionStorage.removeItem('spotify_device_error');
    
    // 開発環境でのログを削除
  }, []); // 空の依存配列で初回のみ実行

  // ページ離脱時の状態保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentTrack && session) {
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
          // ページ離脱時に即座に保存
          sessionStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
          localStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
        } catch (error) {
          console.error('Failed to save player state on page unload:', error);
        }
      }
    };

    // ページ離脱時のイベントを監視
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [currentTrack, currentTrackIndex, isPlaying, position, volume, isMuted, session]);

  // デバイス情報の初期化
  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);
    
    // 省電力モードの検出
    detectPowerSaveMode().then(isPowerSave => {
      setIsPowerSaveMode(isPowerSave);
    });

    // Wake Lock APIのサポート確認
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      setIsWakeLockSupported(true);
    } else {
      console.log('⚠️ Wake Lock API is not supported');
    }
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
    
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      }
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
          // sessionStorageとlocalStorageの両方に保存（より堅牢に）
          sessionStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
          localStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
          
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

  // ページ可視性変更時の状態保存を強化
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (!isVisible) {
        // ページが非表示になった時
        setWasPlayingBeforeHidden(isPlaying);
        console.log('Page hidden, was playing:', isPlaying);
        
        // 状態を即座に保存
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
            // 両方のストレージに保存
            sessionStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
            localStorage.setItem('tunedive_player_state', JSON.stringify(playerState));
            
            // Service Workerにも送信
            updatePlayerStateInSW(playerState);
          } catch (error) {
            console.error('Failed to save player state on page hide:', error);
          }
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
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, wasPlayingBeforeHidden, currentTrack, currentTrackIndex, position, volume, isMuted]);

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
        
        // Service Workerから取得できない場合はストレージから
        if (!playerState) {
          // まずsessionStorageから試行
          let savedState = sessionStorage.getItem('tunedive_player_state');
          
          // sessionStorageにない場合はlocalStorageから試行
          if (!savedState) {
            savedState = localStorage.getItem('tunedive_player_state');
          }
          
          if (savedState) {
            try {
              playerState = JSON.parse(savedState);
              const now = Date.now();
              const timeDiff = now - playerState.timestamp;
              
              // 30分以内の状態のみ復元
              if (timeDiff >= 30 * 60 * 1000) {
                playerState = null;
              }
            } catch (error) {
              console.error('Failed to parse saved player state:', error);
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
    // ソース情報の検証と正規化
    const normalizedSource = source || 'unknown';
    
    if (normalizedSource !== currentTrackListSource.current) {
        // 状態を完全にリセット
        setCurrentTrack(null);
        setCurrentTrackIndex(-1);
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
        setTrackList(songs);
        currentTrackListSource.current = normalizedSource;
        console.log('✅ PlayerContext - Source updated:', normalizedSource);
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
      
      // SpotifyPlayerに再生指示を送信
      if (spotifyPlayerRef.current && spotifyPlayerRef.current.playNewTrack) {
        const spotifyTrackId = newTrack.spotify_track_id;
        if (spotifyTrackId) {
          console.log('🎵 PlayerContext - Triggering Spotify playback for track:', spotifyTrackId);
          spotifyPlayerRef.current.playNewTrack(spotifyTrackId);
        } else {
          console.warn('⚠️ PlayerContext - No Spotify track ID available for playback');
        }
      } else {
        console.warn('⚠️ PlayerContext - SpotifyPlayer not ready or playNewTrack method not available');
      }
      
      // 視聴履歴追跡を開始（重複を防ぐため一度だけ呼び出し）
      if (playTracker && session?.user?.id) {
        console.log('📊 PlayerContext - Starting play tracking with source:', normalizedSource);
        playTracker.startTracking(newTrack, track.id, normalizedSource);
      }
    });
  }, [playTracker, session, currentTrack, trackList, spotifyPlayerRef]);

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
    
    console.log('🔄 CONTINUOUS PLAY - playNext called', {
      trackListLength: trackList.length,
      currentTrackIndex,
      currentTrack: currentTrack?.title || currentTrack?.name
    });
    
    if (trackList.length === 0) {
      console.log('🔄 CONTINUOUS PLAY - No tracks available, returning');
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
      console.log('🔄 CONTINUOUS PLAY - Playing first track (index not found)');
      setCurrentTrack(trackList[0]);
      setCurrentTrackIndex(0);
      setIsPlaying(true);
      setPosition(0);
      
      // 視聴履歴追跡を開始
      if (playTracker && session?.user?.id) {
        const source = currentTrackListSource.current || 'unknown';
        playTracker.startTracking(trackList[0], trackList[0].id, source);
      }
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= trackList.length) {
      // 最後の曲ならonPageEnd
      console.log('🔄 CONTINUOUS PLAY - Reached end of track list, calling onPageEnd');
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
    console.log('🔄 CONTINUOUS PLAY - Playing next track:', {
      nextIndex,
      nextTrack: nextTrack?.title || nextTrack?.name,
      currentIndex
    });
    
    // 少し遅延してから次の曲を再生
    setTimeout(() => {
      setCurrentTrack(nextTrack);
      setCurrentTrackIndex(nextIndex);
      setIsPlaying(true);
      setPosition(0);
      
      // SpotifyPlayerに次の曲の情報を確実に伝達
      if (spotifyPlayerRef.current && spotifyPlayerRef.current.updateCurrentTrackState) {
        spotifyPlayerRef.current.updateCurrentTrackState(nextTrack, nextIndex);
        console.log('🔄 CONTINUOUS PLAY - Updated SpotifyPlayer with next track:', {
          nextTrackName: nextTrack?.title || nextTrack?.name,
          nextIndex,
          nextTrackId: nextTrack?.spotifyTrackId || nextTrack?.id
        });
      }
      
      // 視聴履歴追跡を開始
      if (playTracker && session?.user?.id) {
        const source = currentTrackListSource.current || 'unknown';
        playTracker.startTracking(nextTrack, nextTrack.id, source);
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
      const source = currentTrackListSource.current || 'unknown';
      console.log('📊 PlayerContext - Starting play tracking for previous track with source:', source);
      playTracker.startTracking(trackList[prevIndex], trackList[prevIndex].id, source);
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
    console.log('🎵 PlayerContext - handleTrackEnd called');
    
    // 現在の状態を確認
    const { trackList, currentTrack, currentTrackIndex } = stateRef.current;
    
    // トップページ特有のデバッグ情報
    if (currentTrackListSource.current && currentTrackListSource.current.includes('top')) {
      // トップページの場合は何もしない（ログも出力しない）
      console.log('🎵 PlayerContext - Top page detected, skipping track end handling');
      return;
    }
    
    // 視聴履歴を記録（playNext内でも記録されるが、ここで先に記録）
    if (playTracker) {
      playTracker.stopTracking(true); // 完了として記録
    }
    
    // 次の曲を再生
    playNext();
  }, [playTracker, playNext]);

  // isPlayingの状態変更を監視して視聴履歴を記録
  useEffect(() => {
    if (playTracker && !isPlaying && currentTrack) {
      // 再生が停止された時に視聴履歴を記録
      playTracker.stopTracking(false); // 中断として記録
    }
  }, [isPlaying, playTracker, currentTrack]);

  // 再生状態に応じてWake Lockを管理（最適化版）
  useEffect(() => {
    if (isPlaying && currentTrack && isWakeLockSupported) {
      // 再生開始時にWake Lockを取得（既に取得済みの場合はスキップ）
      if (!wakeLock) {
        requestWakeLock();
      }
    } else if (!isPlaying && wakeLock) {
      // 再生停止時にWake Lockを解放（ただし、短時間の停止の場合は維持）
      // 連続再生の中断を防ぐため、少し遅延してから解放
      const releaseTimer = setTimeout(() => {
        if (!isPlaying && wakeLock) {
          releaseWakeLock();
        }
      }, 2000); // 2秒の遅延
      
      return () => clearTimeout(releaseTimer);
    }
  }, [isPlaying, currentTrack, isWakeLockSupported, requestWakeLock, releaseWakeLock, wakeLock]);

  // Wake Lock永続化の管理
  useEffect(() => {
    if (wakeLock && isPlaying) {
      // 既存の永続化タイマーをクリア
      if (wakeLockPersistenceTimer) {
        clearTimeout(wakeLockPersistenceTimer);
      }
      
      // 新しい永続化タイマーを設定（5分間Wake Lockを維持）
      const timer = setTimeout(() => {
        if (wakeLock && isPlaying) {
          console.log('🔒 Wake Lock persistence timer expired, but keeping for continuous playback');
          // 連続再生中はWake Lockを維持
        }
      }, 5 * 60 * 1000); // 5分
      
      setWakeLockPersistenceTimer(timer);
      
      return () => clearTimeout(timer);
    }
  }, [wakeLock, isPlaying]); // wakeLockPersistenceTimerを依存関係から削除

  // ページ可視性の監視（最適化版）
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // ページが可視状態になった時、再生中ならWake Lockを取得
        if (isPlaying && currentTrack && isWakeLockSupported && !wakeLock) {
          console.log('🔒 Page became visible, requesting Wake Lock');
          requestWakeLock();
        }
      } else {
        // ページが非表示になった時、Wake Lockを即座に解放しない
        // モバイルでの連続再生を維持するため、短時間の非表示では維持
        if (wakeLock && isPlaying) {
          console.log('🔒 Page became hidden, but keeping Wake Lock for continuous playback');
          // 再生中の場合、Wake Lockを維持して連続再生を継続
        } else if (wakeLock && !isPlaying) {
          // 再生停止中の場合のみ解放
          console.log('🔒 Page became hidden, releasing Wake Lock (not playing)');
          releaseWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, currentTrack, isWakeLockSupported, wakeLock, requestWakeLock, releaseWakeLock]);

  // プレイヤーを完全に停止する機能
  const stopPlayer = useCallback(() => {
    console.log('🛑 PlayerContext - Stopping player completely');
    
    // 現在の曲の再生を停止
    if (playTracker) {
      playTracker.stopTracking(false); // 中断として記録
    }
    
    // プレイヤー状態を完全にリセット
    setCurrentTrack(null);
    setCurrentTrackIndex(-1);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setTrackList([]);
    currentTrackListSource.current = null;
    
    // SpotifyPlayerに停止指示を送信
    if (spotifyPlayerRef.current && spotifyPlayerRef.current.pause) {
      spotifyPlayerRef.current.pause();
    }
    
    // Wake Lock永続化タイマーをクリア
    if (wakeLockPersistenceTimer) {
      clearTimeout(wakeLockPersistenceTimer);
      setWakeLockPersistenceTimer(null);
    }
    
    // Wake Lockを解放
    if (wakeLock) {
      releaseWakeLock();
    }
    
    console.log('✅ PlayerContext - Player stopped completely');
  }, [playTracker, wakeLock, releaseWakeLock]);

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
    // Wake Lock関連
    wakeLock,
    isWakeLockSupported,
    requestWakeLock,
    releaseWakeLock,
    // プレイヤー停止機能
    stopPlayer,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

// デフォルトエクスポートを追加
export default PlayerProvider; 