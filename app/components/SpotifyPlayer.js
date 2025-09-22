'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { usePlayer } from './PlayerContext';

// 定数の抽出
const PLAYER_CONFIG = {
  PROTECTION_TIME: 8000,
  RESET_DELAY: 300,
  CLEAR_DELAY: 500,
  POSITION_UPDATE_INTERVAL: 1000,
  TRACK_END_THRESHOLD: 50,
  SEEK_PROTECTION_TIME: 2000,
  TRACK_END_CHECK_DELAY: 3000,
  PLAY_NEXT_DELAY: 100,
  VOLUME_DEFAULT: 0.2,
  POSITION_CHANGE_THRESHOLD: 1000,
  BACKGROUND_CHECK_INTERVAL: 5000, // バックグラウンド時のチェック間隔
  VISIBILITY_RESTORE_DELAY: 1000, // 可視性復元時の遅延
};

const SpotifyPlayer = forwardRef(({ accessToken, trackId, autoPlay }, ref) => {
  const playerRef = useRef(null);
  const { playNext, isPlaying, updatePlaybackState, currentTrack, currentTrackIndex, trackList, updateCurrentTrackState, volume, isPageVisible, handleTrackEnd } = usePlayer();
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [showAuthError, setShowAuthError] = useState(false);
  
  const currentTrackIdRef = useRef(null);
  const positionUpdateIntervalRef = useRef(null);
  const lastPositionRef = useRef(0);
  const trackEndCheckTimerRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const isNewTrackSelectedRef = useRef(false);
  const isSeekingRef = useRef(false);
  const seekProtectionTimerRef = useRef(null);
  const backgroundCheckIntervalRef = useRef(null);
  const lastApiCallRef = useRef(0);
  const apiCallCountRef = useRef(0);
  const lastTrackEndCheckRef = useRef(0);
  const isAutoPlayInProgressRef = useRef(false);

  // 状態リセット関数
  const resetPlayerState = useCallback(() => {
    currentTrackIdRef.current = null;
    lastPositionRef.current = 0;
    isNewTrackSelectedRef.current = false;
    
    if (trackEndCheckTimerRef.current) {
      clearTimeout(trackEndCheckTimerRef.current);
      trackEndCheckTimerRef.current = null;
    }
  }, []);

  // プレイヤー初期化関数
  const initializePlayer = useCallback(() => {
    if (!accessToken) {
      return;
    }

    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }

    if (typeof window !== 'undefined') {
      window.onSpotifyWebPlaybackSDKReady = () => {
        if (playerRef.current) {
          return;
        }

        const player = new window.Spotify.Player({
        name: 'TuneDive Web Player',
        getOAuthToken: cb => { 
          cb(accessToken); 
        },
        volume: PLAYER_CONFIG.VOLUME_DEFAULT
      });
      
      playerRef.current = player;
      setPlayerStateListeners(player);
      
      player.connect().then(success => {
        if (!success) {
          console.error('❌ SpotifyPlayer - Connection failed');
        }
      }).catch(error => {
        console.error('❌ SpotifyPlayer - Connection error:', error);
      });
    };

    const scriptId = 'spotify-sdk-script';
    
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onload = () => {
        if (typeof window !== 'undefined' && window.Spotify) {
          window.onSpotifyWebPlaybackSDKReady();
        }
      };
      script.onerror = (error) => {
        console.error('❌ SpotifyPlayer - Script load error:', error);
      };
      document.body.appendChild(script);
    } else {
      if (typeof window !== 'undefined' && window.Spotify) {
        window.onSpotifyWebPlaybackSDKReady();
      }
    }
    }
  }, [accessToken]);

  // トークンの有効性をチェックする関数
  const checkTokenValidity = useCallback(async () => {
    // トークンが存在しない場合は認証エラーを発生させない
    if (!accessToken) {
      console.log('🔄 CONTINUOUS PLAY - No access token available, skipping validation');
      return false;
    }
    
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.status === 401) {
        // トークンが無効
        console.warn('Spotify token is invalid (401)');
        sessionStorage.setItem('spotify_auth_error', 'true');
        return false;
      }
      
      if (!response.ok) {
        console.warn('Spotify token validation failed:', response.status);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }, [accessToken]);

  // エラーハンドリング関数
  const handleError = useCallback((error, context) => {
    console.error(`SpotifyPlayer error in ${context}:`, error);
    
    // 401 Unauthorizedエラーの処理（最優先）
    if (error.status === 401 || error.message?.includes('401')) {
      console.warn('Spotify API 401 Unauthorized - トークンの期限切れ');
      sessionStorage.setItem('spotify_auth_error', 'true');
      setShowAuthError(true);
      
      // プレイヤーを完全にリセット
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      setIsReady(false);
      setDeviceId(null);
      resetPlayerState();
      
      // バックグラウンドチェックも停止
      if (backgroundCheckIntervalRef.current) {
        clearInterval(backgroundCheckIntervalRef.current);
        backgroundCheckIntervalRef.current = null;
      }
      
      return;
    }
    
    // 429 Too Many Requestsエラーの処理
    if (error.status === 429 || error.message?.includes('429')) {
      console.warn('Spotify API 429 Too Many Requests - レート制限に達しました');
      
      // レート制限の場合は長時間待機
      setTimeout(() => {
        if (accessToken) {
          // トークンの有効性をチェックしてから再初期化
          checkTokenValidity().then(isValid => {
            if (isValid) {
              initializePlayer();
            }
          });
        }
      }, 60000); // 1分待機
      
      return;
    }
    
    // 403 Forbiddenエラーの特別な処理
    if (error.status === 403 || error.message?.includes('403')) {
      console.warn('Spotify API 403 Forbidden - デバイスまたはトークンの問題');
      
      // デバイスIDをリセットして再試行
      if (deviceId) {
        setDeviceId(null);
      }
      
      // トークンの有効性をチェック
      checkTokenValidity().then(isValid => {
        if (!isValid) {
          sessionStorage.setItem('spotify_auth_error', 'true');
          setShowAuthError(true);
        }
      });
      
      return;
    }
    
    // 404 Not Foundエラーの処理
    if (error.status === 404 || error.message?.includes('404')) {
      console.warn('Spotify API 404 Not Found - デバイスが見つからない');
      
      // デバイスエラーフラグを設定
      sessionStorage.setItem('spotify_device_error', 'true');
      setDeviceId(null);
      
      return;
    }
    
    // WebSocket接続エラーの処理
    if (error.message?.includes('WebSocket') || error.message?.includes('Connection failed')) {
      console.warn('WebSocket接続エラー - プレイヤーを再初期化します');
      
      // プレイヤーを切断して再初期化
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      
      // デバイスIDをリセット
      setDeviceId(null);
      setIsReady(false);
      
      // トークンの有効性をチェックしてから再初期化
      setTimeout(() => {
        if (accessToken) {
          checkTokenValidity().then(isValid => {
            if (isValid) {
              initializePlayer();
            } else {
              sessionStorage.setItem('spotify_auth_error', 'true');
              setShowAuthError(true);
            }
          });
        }
      }, 3000);
      
      return;
    }
    
    // その他のエラーの場合
    console.warn(`Unhandled error in ${context}:`, error);
  }, [deviceId, accessToken, initializePlayer, checkTokenValidity, resetPlayerState]);

  // 次の曲を再生する関数
  const triggerPlayNext = useCallback(() => {
    if (playNext) {
      console.log('🔄 CONTINUOUS PLAY - Triggering playNext from SpotifyPlayer');
      // 自動再生フラグを設定
      isAutoPlayInProgressRef.current = true;
      setTimeout(() => {
        try {
          // PlayerContextから最新の楽曲情報を取得
          // 現在再生中の楽曲IDを直接取得（currentTrackの状態に依存しない）
          const currentTrackId = currentTrackIdRef.current || lastTrackIdRef.current;
          let latestTrackIndex = trackList.findIndex(track => 
            track.spotifyTrackId === currentTrackId || 
            track.id === currentTrackId
          );
          
          // インデックスが見つからない場合は現在のインデックスを使用
          if (latestTrackIndex === -1) {
            latestTrackIndex = currentTrackIndex;
          }
          
          // デバッグログを削減（重要な情報のみ）
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 CONTINUOUS PLAY - Triggering next track:', {
              currentTrack: currentTrack?.title || currentTrack?.name,
              currentTrackIndex,
              latestTrackIndex
            });
          }
          
          // 直接playNextを呼び出し（handleTrackEndは重複を避けるため呼び出さない）
          console.log('🔄 CONTINUOUS PLAY - Calling playNext directly from SpotifyPlayer');
          if (currentTrack && latestTrackIndex >= 0) {
            updateCurrentTrackState(currentTrack, latestTrackIndex);
          }
          
          // playNextを呼び出し
          console.log('🔄 [SpotifyPlayer] About to call playNext function');
          try {
            playNext();
            console.log('🔄 [SpotifyPlayer] playNext function called successfully');
          } catch (error) {
            console.error('❌ [SpotifyPlayer] Error calling playNext:', error);
          }
          
          // playNext後に次の曲のIDを更新（非同期で実行）
          setTimeout(() => {
            if (currentTrack && latestTrackIndex >= 0) {
              const nextIndex = (latestTrackIndex + 1) % trackList.length;
              const nextTrack = trackList[nextIndex];
              if (nextTrack) {
                const nextTrackId = nextTrack?.spotifyTrackId || nextTrack?.id;
                if (nextTrackId) {
                  currentTrackIdRef.current = nextTrackId;
                  lastTrackIdRef.current = nextTrackId;
                  console.log('🔄 CONTINUOUS PLAY - Updated currentTrackIdRef for next track:', {
                    nextTrackId,
                    nextTrackName: nextTrack?.title || nextTrack?.name,
                    nextIndex,
                    previousIndex: latestTrackIndex
                  });
                }
              }
            }
          }, 200); // タイミングを200msに延長
        } catch (error) {
          console.error('❌ CONTINUOUS PLAY - Error in triggerPlayNext:', error);
          handleError(error, 'playNext');
        }
      }, PLAYER_CONFIG.PLAY_NEXT_DELAY);
    } else {
      console.log('❌ CONTINUOUS PLAY - playNext function not available');
    }
  }, [playNext, currentTrack, currentTrackIndex, updateCurrentTrackState, handleError, handleTrackEnd, trackList]);

  // プレイヤー状態リスナー設定関数
  const setPlayerStateListeners = useCallback((player) => {
    player.addListener('ready', ({ device_id }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Spotify player ready:', { device_id });
      }
      
      // デバイスIDを設定
      setDeviceId(device_id);
      setIsReady(true);
      
      // 認証エラーフラグをクリア
      sessionStorage.removeItem('spotify_auth_error');
      sessionStorage.removeItem('spotify_device_error');
      
      // デバイスIDが設定されたことを確認
      setTimeout(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Device ID confirmed:', device_id);
        }
      }, 100);
    });

    player.addListener('not_ready', ({ device_id }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Spotify player not ready:', { device_id });
      }
      setDeviceId(null);
      setIsReady(false);
    });

    player.addListener('player_state_changed', (state) => {
      if (!state) {
        return;
      }
      
      // 新しい曲が選択された直後は、前の曲の情報を完全に無視する
      if (isNewTrackSelectedRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('New track selected, ignoring previous track state completely');
        }
        // 新しい曲の情報のみを更新し、前の曲の状態は一切処理しない
        if (state.track_window.current_track) {
          const currentTrackId = state.track_window.current_track.id;
          const expectedTrackId = currentTrackIdRef.current;
          
          // 期待している曲IDと一致する場合のみ状態を更新
          if (currentTrackId === expectedTrackId) {
            updatePlaybackState(state.duration, state.position);
            lastPositionRef.current = state.position;
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('Track ID mismatch during new track selection:', {
                currentTrackId,
                expectedTrackId
              });
            }
          }
        }
        return;
      }
      
      // 新しい曲が選択されていない場合でも、期待している曲IDと一致しない場合は無視
      if (state.track_window.current_track) {
        const currentTrackId = state.track_window.current_track.id;
        const expectedTrackId = currentTrackIdRef.current;
        
        if (expectedTrackId && currentTrackId !== expectedTrackId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Ignoring state change for unexpected track:', {
              currentTrackId,
              expectedTrackId
            });
          }
          return;
        }
      }
      
      // 再生時間と位置を更新
      if (state.track_window.current_track) {
        updatePlaybackState(state.duration, state.position);
      }
      
      // シーク操作中は終了検知を無効にする
      if (isSeekingRef.current) {
        if (Math.abs(state.position - lastPositionRef.current) > PLAYER_CONFIG.POSITION_CHANGE_THRESHOLD) {
          lastPositionRef.current = state.position;
        } else {
          lastPositionRef.current = state.position;
        }
        return;
      }
      
      // 現在再生中の曲のIDを確認
      const currentPlayingTrackId = state.track_window.current_track?.id;
      const expectedTrackId = currentTrackIdRef.current;

      // 期待している曲IDと実際の曲IDが一致しない場合の処理
      if (expectedTrackId && currentPlayingTrackId && currentPlayingTrackId !== expectedTrackId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Track mismatch detected:', {
            expected: expectedTrackId,
            actual: currentPlayingTrackId,
            currentTrack: state.track_window.current_track?.name
          });
        }
        
        const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
        
        if (expectedTrackInPrevious && lastPositionRef.current > PLAYER_CONFIG.POSITION_CHANGE_THRESHOLD) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Expected track found in previous tracks, triggering next');
          }
          resetPlayerState();
          triggerPlayNext();
          return;
        }
      }

      // 曲の終了検知（頻度制限付き）
      const now = Date.now();
      if (now - lastTrackEndCheckRef.current > 1000) { // 1秒間隔でチェック
        lastTrackEndCheckRef.current = now;
        
        if (isTrackEnded(state, currentTrackIdRef.current)) {
          console.log('🔄 CONTINUOUS PLAY - Track ended, triggering next track');
          
          // 終了検知タイマーを設定
          if (trackEndCheckTimerRef.current) {
            clearTimeout(trackEndCheckTimerRef.current);
          }
          
          trackEndCheckTimerRef.current = setTimeout(() => {
            console.log('🔄 CONTINUOUS PLAY - Track end timer triggered, calling triggerPlayNext');
            triggerPlayNext();
          }, PLAYER_CONFIG.TRACK_END_CHECK_DELAY);
        }
      }
    });

    player.addListener('initialization_error', ({ message }) => {
      console.error('Spotify player initialization error:', message);
      handleError(new Error(message), 'initialization');
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error('Spotify player authentication error:', message);
      sessionStorage.setItem('spotify_auth_error', 'true');
      handleError(new Error(message), 'authentication');
    });

    player.addListener('account_error', ({ message }) => {
      console.error('Spotify player account error:', message);
      sessionStorage.setItem('spotify_auth_error', 'true');
      handleError(new Error(message), 'account');
    });

    player.addListener('playback_error', ({ message }) => {
      console.error('Spotify player playback error:', message);
      handleError(new Error(message), 'playback');
    });

    // 音量設定
    if (volume !== undefined) {
      playerRef.current.setVolume(volume);
    }
  }, [deviceId, updatePlaybackState, resetPlayerState, triggerPlayNext, handleError, volume]);

  // 認証エラーの監視
  useEffect(() => {
    const checkAuthError = async () => {
      const hasAuthError = sessionStorage.getItem('spotify_auth_error');
      const wasShowingError = showAuthError;
      
      // トークンが存在しない場合は認証エラーを発生させない
      if (!accessToken) {
        console.log('No access token available, clearing auth error state');
        sessionStorage.removeItem('spotify_auth_error');
        setShowAuthError(false);
        return;
      }
      
      // トークンの有効性をチェック
      const isTokenValid = await checkTokenValidity();
      
      if (!isTokenValid && !hasAuthError) {
        // トークンが無効だがエラーフラグが設定されていない場合
        sessionStorage.setItem('spotify_auth_error', 'true');
        setShowAuthError(true);
      } else if (isTokenValid && hasAuthError) {
        // トークンが有効でエラーフラグが設定されている場合
        sessionStorage.removeItem('spotify_auth_error');
        setShowAuthError(false);
      } else {
        setShowAuthError(!!hasAuthError);
      }
      
      // 認証エラーが発生している場合はプレイヤーをリセット
      if (hasAuthError || !isTokenValid) {
        if (playerRef.current) {
          playerRef.current.disconnect();
          playerRef.current = null;
        }
        setIsReady(false);
        setDeviceId(null);
        resetPlayerState();
        
        // バックグラウンドチェックも停止
        if (backgroundCheckIntervalRef.current) {
          clearInterval(backgroundCheckIntervalRef.current);
          backgroundCheckIntervalRef.current = null;
        }
      }
      
      // 認証エラーが解決された場合はプレイヤーを再初期化
      if (wasShowingError && !hasAuthError && isTokenValid && accessToken) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Authentication error resolved, reinitializing player');
        }
        setTimeout(() => {
          initializePlayer();
        }, 1000);
      }
    };

    // 初回チェック
    checkAuthError();

    // 定期的にチェック（5秒間隔）
    const interval = setInterval(checkAuthError, 5000);
    return () => clearInterval(interval);
  }, [resetPlayerState, showAuthError, accessToken, initializePlayer, checkTokenValidity]);

  // バックグラウンド時の状態チェック（モバイル最適化版）
  const checkBackgroundState = useCallback(async () => {
    if (!isReady || !playerRef.current || isPageVisible) return;
    
    // トークンが存在しない場合はバックグラウンドチェックを停止
    if (!accessToken) {
      console.log('No access token available, stopping background monitoring');
      if (backgroundCheckIntervalRef.current) {
        clearInterval(backgroundCheckIntervalRef.current);
        backgroundCheckIntervalRef.current = null;
      }
      return;
    }
    
    try {
      // まずトークンの有効性をチェック
      const isTokenValid = await checkTokenValidity();
      if (!isTokenValid) {
        // トークンが無効な場合はバックグラウンドチェックを停止
        console.warn('Token invalid during background check, stopping background monitoring');
        if (backgroundCheckIntervalRef.current) {
          clearInterval(backgroundCheckIntervalRef.current);
          backgroundCheckIntervalRef.current = null;
        }
        return;
      }
      
      const state = await playerRef.current.getCurrentState();
      if (state && state.track_window.current_track) {
        // バックグラウンドでも状態を更新
        updatePlaybackState(state.duration, state.position);
        lastPositionRef.current = state.position;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Background state check:', {
            track: state.track_window.current_track.name,
            position: state.position,
            duration: state.duration,
            paused: state.paused
          });
        }
        
        // 曲が終了したかチェック（モバイルでの誤検知を防ぐ）
        if (isTrackEnded(state, currentTrackIdRef.current)) {
          // モバイルでは少し遅延してから次の曲に移行
          setTimeout(() => {
            resetPlayerState();
            triggerPlayNext();
          }, 1000); // 1秒の遅延
        }
      }
    } catch (error) {
      console.error('Background state check error:', error);
      
      // エラーが401の場合は認証エラーとして処理
      if (error.status === 401 || error.message?.includes('401')) {
        console.warn('Authentication error during background check');
        sessionStorage.setItem('spotify_auth_error', 'true');
        setShowAuthError(true);
        
        // バックグラウンドチェックを停止
        if (backgroundCheckIntervalRef.current) {
          clearInterval(backgroundCheckIntervalRef.current);
          backgroundCheckIntervalRef.current = null;
        }
      } else {
        handleError(error, 'backgroundCheck');
      }
    }
  }, [isReady, isPageVisible, updatePlaybackState, handleError, checkTokenValidity, resetPlayerState, triggerPlayNext]);

  // バックグラウンドチェックの開始/停止
  useEffect(() => {
    if (!isPageVisible && isReady) {
      // ページが非表示でプレイヤーが準備完了の場合、バックグラウンドチェックを開始
      backgroundCheckIntervalRef.current = setInterval(checkBackgroundState, PLAYER_CONFIG.BACKGROUND_CHECK_INTERVAL);
    } else {
      // ページが表示されている場合、バックグラウンドチェックを停止
      if (backgroundCheckIntervalRef.current) {
        clearInterval(backgroundCheckIntervalRef.current);
        backgroundCheckIntervalRef.current = null;
      }
    }

    return () => {
      if (backgroundCheckIntervalRef.current) {
        clearInterval(backgroundCheckIntervalRef.current);
        backgroundCheckIntervalRef.current = null;
      }
    };
  }, [isPageVisible, isReady, checkBackgroundState]);

  // ページ可視性変更時の処理
  useEffect(() => {
    if (isPageVisible && isReady && playerRef.current) {
      // 画面復帰時にトークンの有効性をチェック
      const handleVisibilityRestore = async () => {
        try {
          // トークンが存在しない場合は処理をスキップ
          if (!accessToken) {
            console.log('No access token available on visibility restore, skipping validation');
            return;
          }
          
          // まずトークンの有効性をチェック
          const isTokenValid = await checkTokenValidity();
          
          if (!isTokenValid) {
            // トークンが無効な場合は再認証を促す
            console.warn('Token invalid on visibility restore, showing auth error');
            setShowAuthError(true);
            return;
          }
          
          // トークンが有効な場合は状態を復元
          const state = await playerRef.current.getCurrentState();
          if (state && state.track_window.current_track) {
            updatePlaybackState(state.duration, state.position);
            lastPositionRef.current = state.position;
            
            if (process.env.NODE_ENV === 'development') {
              console.log('Playback state restored on visibility change:', {
                track: state.track_window.current_track.name,
                position: state.position,
                duration: state.duration
              });
            }
          }
        } catch (error) {
          console.error('Error during visibility restore:', error);
          
          // エラーが401の場合は認証エラーとして処理
          if (error.status === 401 || error.message?.includes('401')) {
            sessionStorage.setItem('spotify_auth_error', 'true');
            setShowAuthError(true);
          } else {
            handleError(error, 'visibilityRestore');
          }
        }
      };
      
      // 少し遅延してから状態を確認
      const timer = setTimeout(handleVisibilityRestore, PLAYER_CONFIG.VISIBILITY_RESTORE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isPageVisible, isReady, updatePlaybackState, handleError, checkTokenValidity]);

  // デバイスリセット処理の統合
  const resetDevice = useCallback(async () => {
    if (!deviceId || !accessToken) {
      return false;
    }

    try {
      const resetResponse = await fetch('https://api.spotify.com/v1/me/player/pause', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
              });
              
      if (resetResponse.ok) {
        await new Promise(resolve => setTimeout(resolve, PLAYER_CONFIG.RESET_DELAY));
        return true;
      }
      
      // エラーレスポンスの詳細をログ
      if (process.env.NODE_ENV === 'development') {
        console.log('Reset device response:', {
          status: resetResponse.status,
          statusText: resetResponse.statusText
        });
      }
      
      // 403エラーの場合はデバイスIDをリセットし、認証エラーフラグを設定
      if (resetResponse.status === 403) {
        console.warn('Device reset failed with 403 - resetting device ID');
        setDeviceId(null);
        sessionStorage.setItem('spotify_auth_error', 'true');
        return false;
      }
      
      // 401エラーの場合は認証エラーフラグを設定
      if (resetResponse.status === 401) {
        console.warn('Device reset failed with 401 - authentication error');
        sessionStorage.setItem('spotify_auth_error', 'true');
        return false;
      }
      
      return false;
    } catch (error) {
      handleError(error, 'resetDevice');
      return false;
    }
  }, [deviceId, accessToken, handleError]);

  // 曲の終了検知ロジックの改善（モバイル対応）
  const isTrackEnded = useCallback((state, expectedTrackId) => {
    if (!expectedTrackId || !state) return false;
    
    // 曲終了検出の条件を適切に設定（誤検知を防ぐため）
    const basicConditions = (
      !isSeekingRef.current && // シーク操作中は終了検知を無効化
      !isNewTrackSelectedRef.current && // 新しい曲選択中は終了検知を無効化
      lastPositionRef.current > 5000 // 5秒以上再生していた場合のみ
    );
    
    console.log('🔄 CONTINUOUS PLAY - isTrackEnded check:', 
      'expectedTrackId:', expectedTrackId,
      'position:', state.position,
      'lastPosition:', lastPositionRef.current,
      'threshold:', PLAYER_CONFIG.TRACK_END_THRESHOLD,
      'isSeeking:', isSeekingRef.current,
      'basicConditions:', basicConditions
    );
    
    if (!basicConditions) return false;
    
    // 改善された曲終了検出ロジック
    const currentPlayingTrackId = state.track_window.current_track?.id;
    
    // 現在の曲が期待している曲と異なる場合、前の曲が終了したとみなす
    if (currentPlayingTrackId && currentPlayingTrackId !== expectedTrackId) {
      console.log('🔄 CONTINUOUS PLAY - Track changed, previous track ended:', {
        expectedTrackId,
        currentPlayingTrackId
      });
      
      // 期待されるトラックが実際に再生されていない場合、トラック切り替えが失敗している可能性
      if (isNewTrackSelectedRef.current) {
        console.warn('⚠️ CONTINUOUS PLAY - Track switch may have failed during protection period');
        return false; // 保護期間中は曲終了検出を無効化
      }
      
      return true;
    }
    
    // 位置が0に戻った場合（曲が終了した）- より厳密な条件
    if (state.position === 0 && lastPositionRef.current > 10000) {
      console.log('🔄 CONTINUOUS PLAY - Track position reset to 0, track ended');
      return true;
    }
    
    // 位置が大幅に戻った場合（曲が終了した）- より厳密な条件
    if (state.position < lastPositionRef.current - 10000 && lastPositionRef.current > 10000) {
      console.log('🔄 CONTINUOUS PLAY - Track position jumped back, track ended');
      return true;
    }
    
    // 一時停止状態で現在の曲がない場合
    if (state.paused && !currentPlayingTrackId) {
      console.log('🔄 CONTINUOUS PLAY - Track paused with no current track');
      return true;
    }
    
    return false;
  }, []);

  useImperativeHandle(ref, () => ({
    seekTo: (position) => {
      if (playerRef.current && isReady) {
        if (isSeekingRef.current) {
          return;
        }
        isSeekingRef.current = true;
        if (seekProtectionTimerRef.current) {
          clearTimeout(seekProtectionTimerRef.current);
        }
        playerRef.current.seek(position);
        seekProtectionTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
          if (playerRef.current) {
            playerRef.current.getCurrentState().then(state => {
              if (state && state.track_window.current_track) {
                lastPositionRef.current = state.position;
              }
            });
          }
        }, PLAYER_CONFIG.SEEK_PROTECTION_TIME);
      }
    },
    setVolume: (volume) => {
      if (playerRef.current && isReady) {
        playerRef.current.setVolume(volume);
      }
    },
    playNewTrack: (trackId) => {
      if (isReady && deviceId) {
        playNewTrack(trackId);
      } else {
        console.warn('SpotifyPlayer not ready or device ID not available');
      }
    },
    updateCurrentTrackIndex: (newIndex) => {
      console.log('🔄 [SpotifyPlayer] updateCurrentTrackIndex called:', {
        newIndex,
        currentTrackIndex,
        timestamp: new Date().toISOString()
      });
      // インデックスを更新（usePlayerから取得するため、ここではログのみ）
    },
    getCurrentTrackId: () => {
      return currentTrackIdRef.current || lastTrackIdRef.current;
    },
    currentTrackIdRef: currentTrackIdRef,
    lastTrackIdRef: lastTrackIdRef
  }));

  // 期待している曲を強制的に再生する関数
  const forcePlayExpectedTrack = useCallback(async (expectedTrackId) => {
    try {
      if (!deviceId) {
        return;
      }
      
      // 前の曲を確実に停止
      if (playerRef.current) {
        try {
          await playerRef.current.pause();
          await new Promise(resolve => setTimeout(resolve, PLAYER_CONFIG.RESET_DELAY));
        } catch (error) {
          handleError(error, 'pause');
        }
      }
      
      // デバイスをリセット
      await resetDevice();
      await resetDevice(); // 2回実行して確実にクリア
      
      // 期待している曲を再生
              const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                  uris: [`spotify:track:${expectedTrackId}`],
          position_ms: 0
                }),
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
              });

              if (response.ok) {
                currentTrackIdRef.current = expectedTrackId;
                lastPositionRef.current = 0;
                isNewTrackSelectedRef.current = true;
                
                setTimeout(() => {
                  isNewTrackSelectedRef.current = false;
        }, 500); // 保護時間を500msに短縮
              }
            } catch (error) {
      handleError(error, 'forcePlayExpectedTrack');
    }
  }, [deviceId, accessToken, resetDevice, handleError]);

  // API呼び出し制限機能
  const canMakeApiCall = useCallback((isAutoPlay = false) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallRef.current;
    
    // 楽曲の自動切り替え時はより緩い制限を適用
    if (isAutoPlay) {
      // 自動再生時：30ms間隔、1分間に300回まで
      if (timeSinceLastCall < 30) {
        return false;
      }
      if (apiCallCountRef.current > 300) {
        return false;
      }
    } else {
      // 通常時：50ms間隔、1分間に200回まで
      if (timeSinceLastCall < 50) {
        return false;
      }
      if (apiCallCountRef.current > 200) {
        return false;
      }
    }
    
    lastApiCallRef.current = now;
    apiCallCountRef.current++;
    
    // 1分後にカウントをリセット
    setTimeout(() => {
      apiCallCountRef.current = Math.max(0, apiCallCountRef.current - 1);
    }, 60000);
    
    return true;
  }, []);

  // 新しい曲を再生する関数
  const playNewTrack = useCallback(async (newTrackId) => {
    // PlayerContextから最新のcurrentTrackIndexを取得
    const latestTrackIndex = trackList.findIndex(track => 
      track.spotifyTrackId === newTrackId || track.id === newTrackId || track.spotify_track_id === newTrackId
    );
    
    console.log('🎵 [SpotifyPlayer] playNewTrack called:', {
      newTrackId,
      isReady,
      deviceId,
      currentTrackIndex,
      latestTrackIndex,
      trackListLength: trackList.length,
      currentTrack: currentTrack?.title || currentTrack?.name,
      currentTrackId: currentTrack?.id,
      spotifyTrackId: currentTrack?.spotify_track_id || currentTrack?.spotifyTrackId,
      timestamp: new Date().toISOString()
    });
    
    if (!isReady) {
      console.log('❌ Cannot play new track: player not ready');
      return;
    }

    // track_idのバリデーション
    if (!newTrackId || typeof newTrackId !== 'string' || newTrackId.trim() === '') {
      console.error('❌ Invalid track ID provided:', {
        newTrackId,
        type: typeof newTrackId,
        isEmpty: newTrackId?.trim() === ''
      });
      // 無効なIDの場合は次の曲にスキップ
      console.log('⏭️ Skipping to next track due to invalid track ID');
      setTimeout(() => {
        playNext();
      }, 500);
      return;
    }

    // Spotify track IDの形式チェック（22文字の英数字）
    if (!/^[a-zA-Z0-9]{22}$/.test(newTrackId)) {
      console.error('❌ Invalid Spotify track ID format:', {
        newTrackId,
        length: newTrackId.length,
        pattern: /^[a-zA-Z0-9]{22}$/.test(newTrackId)
      });
      // 無効な形式のIDの場合は次の曲にスキップ
      console.log('⏭️ Skipping to next track due to invalid track ID format');
      setTimeout(() => {
        playNext();
      }, 500);
      return;
    }
    
    if (!deviceId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cannot play new track: device ID is null, waiting for device...');
      }
      // デバイスIDが設定されるまで待機
      const waitForDevice = () => {
        if (deviceId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Device ID now available, retrying playback');
          }
          playNewTrack(newTrackId);
      } else {
          if (waitForDevice.attempts < 20) {
            waitForDevice.attempts = (waitForDevice.attempts || 0) + 1;
            setTimeout(waitForDevice, 500);
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('Device ID not available after 10 seconds, aborting playback');
            }
            // デバイスIDが取得できない場合はプレイヤーを再初期化
            if (playerRef.current) {
              playerRef.current.disconnect();
              setTimeout(() => {
                initializePlayer();
              }, 1000);
            }
          }
        }
      };
      setTimeout(waitForDevice, 500);
          return;
        }
        
    // API呼び出し制限をチェック（楽曲の自動切り替え時は緩和）
    // 楽曲の自動切り替えかどうかを判定（現在の楽曲IDと異なる、または自動再生フラグが設定されている場合）
    const currentTrackId = currentTrackIdRef.current || lastTrackIdRef.current;
    const isAutoPlay = currentTrackId !== newTrackId || 
                      isAutoPlayInProgressRef.current;
    
    // デバッグログを削減（自動再生時のみ）
    if (isAutoPlay && process.env.NODE_ENV === 'development') {
      console.log('🔄 CONTINUOUS PLAY - Auto play detected:', {
        currentTrackIndex,
        latestTrackIndex,
        isAutoPlay
      });
    }
    
    if (!canMakeApiCall(isAutoPlay)) {
      if (isAutoPlay) {
        // 自動再生の場合はレート制限を無視して強制実行（連続再生を最優先）
        console.log('🔄 CONTINUOUS PLAY - Rate limited during auto play, forcing execution');
        // 少し待ってから強制実行
        setTimeout(() => {
          playNewTrack(newTrackId);
        }, 50);
        return;
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('API call rate limited, skipping track playback');
        }
        return;
      }
    }



    try {
      // Step 1: Transfer playback to this device
      const transferResponse = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false,
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') {
          console.log('Transfer playback response:', {
            status: transferResponse.status,
            statusText: transferResponse.statusText,
            error: errorData
          });
        }
        
        // 403エラーの場合はデバイスIDをリセットし、認証エラーフラグを設定
        if (transferResponse.status === 403) {
          console.warn('Transfer playback failed with 403 - resetting device ID');
          setDeviceId(null);
          sessionStorage.setItem('spotify_auth_error', 'true');
          return;
        }
        
        // 401エラーの場合は認証エラーフラグを設定
        if (transferResponse.status === 401) {
          console.warn('Transfer playback failed with 401 - authentication error');
          sessionStorage.setItem('spotify_auth_error', 'true');
          return;
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('Transfer playback successful');
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, PLAYER_CONFIG.CLEAR_DELAY));

      // 前の曲を確実に停止
      if (playerRef.current) {
        try {
          await playerRef.current.pause();
          await new Promise(resolve => setTimeout(resolve, PLAYER_CONFIG.RESET_DELAY));
        } catch (error) {
          handleError(error, 'pause');
        }
      }

      // 前の曲を完全にクリア
      const clearResponse = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (clearResponse.ok) {
        await new Promise(resolve => setTimeout(resolve, PLAYER_CONFIG.CLEAR_DELAY));
      }

      // デバイスをリセット
      await resetDevice();
      await resetDevice(); // 2回実行して確実にクリア

      // Step 2: Play the new track
      if (process.env.NODE_ENV === 'development') {
        console.log('Playing track with device ID:', deviceId);
      }
      
      console.log('🎵 [SpotifyPlayer] Making Spotify API call:', {
        url: `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        trackId: newTrackId,
        deviceId,
        timestamp: new Date().toISOString()
      });
      
      const resetResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          uris: [`spotify:track:${newTrackId}`],
          position_ms: 0
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      console.log('🎵 [SpotifyPlayer] Spotify API response:', {
        status: resetResponse.status,
        statusText: resetResponse.statusText,
        ok: resetResponse.ok,
        trackId: newTrackId,
        timestamp: new Date().toISOString()
      });
      
      if (resetResponse.ok) {

        
        resetPlayerState();
        isNewTrackSelectedRef.current = true;
        
        // 即座に新しい曲IDを設定
        currentTrackIdRef.current = newTrackId;
        lastTrackIdRef.current = newTrackId;
        
        // 自動再生フラグをリセット
        isAutoPlayInProgressRef.current = false;
        
        console.log('🔄 CONTINUOUS PLAY - Track switched successfully:', {
          newTrackId,
          trackName: trackList.find(track => (track?.spotifyTrackId || track?.id) === newTrackId)?.title || 'Unknown'
        });
        
        // Update PlayerContext - 確実に状態を更新
        const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
        if (trackIndex !== -1) {
          updateCurrentTrackState(trackList[trackIndex], trackIndex);
          console.log('🔄 CONTINUOUS PLAY - PlayerContext state updated:', {
            trackIndex,
            trackName: trackList[trackIndex]?.title || 'Unknown',
            newTrackId
          });
        } else {
          console.warn('⚠️ CONTINUOUS PLAY - Track not found in trackList:', {
            newTrackId,
            trackListLength: trackList.length
          });
        }

        // トラック切り替えの検証を追加
        setTimeout(async () => {
          try {
            const verifyResponse = await fetch('https://api.spotify.com/v1/me/player', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            });
            
            if (verifyResponse.ok) {
              const playerState = await verifyResponse.json();
              const actualTrackId = playerState?.item?.id;
              
              if (actualTrackId === newTrackId) {
                console.log('✅ CONTINUOUS PLAY - Track switch verified successfully:', {
                  expectedTrackId: newTrackId,
                  actualTrackId: actualTrackId
                });
              } else {
                console.warn('⚠️ CONTINUOUS PLAY - Track switch verification failed:', {
                  expectedTrackId: newTrackId,
                  actualTrackId: actualTrackId,
                  trackName: trackList.find(track => (track?.spotifyTrackId || track?.id) === newTrackId)?.title || 'Unknown'
                });
                
                // トラック切り替えが失敗した場合、リトライを実行
                console.log('🔄 CONTINUOUS PLAY - Retrying track switch...');
                
                // リトライ前にPlayerContextの状態を更新
                const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
                if (trackIndex !== -1) {
                  updateCurrentTrackState(trackList[trackIndex], trackIndex);
                  console.log('🔄 CONTINUOUS PLAY - Updated PlayerContext state for retry:', {
                    trackIndex,
                    trackName: trackList[trackIndex]?.title || 'Unknown'
                  });
                }
                
                // リトライ前にcurrentTrackIdRefを更新
                currentTrackIdRef.current = newTrackId;
                lastTrackIdRef.current = newTrackId;
                console.log('🔄 CONTINUOUS PLAY - Updated currentTrackIdRef for retry:', {
                  newTrackId,
                  trackName: trackList[trackIndex]?.title || 'Unknown'
                });
                
                await playNewTrack(newTrackId, trackList);
                return;
              }
            }
          } catch (error) {
            console.error('❌ CONTINUOUS PLAY - Track switch verification error:', error);
          }
          
          isNewTrackSelectedRef.current = false;
          console.log('🔄 CONTINUOUS PLAY - Track switch protection lifted');
        }, 3000); // 検証時間を3秒に延長
      } else {
        // エラーレスポンスの詳細をログ
        const errorData = await resetResponse.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') {
          console.log('Play track response:', {
            status: resetResponse.status,
            statusText: resetResponse.statusText,
            error: errorData
          });
        }
        
        // 403エラーの場合はデバイスIDをリセットし、認証エラーフラグを設定
        if (resetResponse.status === 403) {
          console.warn('🚨 Play track failed with 403 - resetting device ID');
          setDeviceId(null);
          sessionStorage.setItem('spotify_auth_error', 'true');
          
          // 403エラーの場合もスキップを試行（認証エラーまたは制限エラー）
          console.error('🚨 Track access denied (403), skipping to next track:', newTrackId);
          
          // 現在のトラックインデックスを更新してから次の曲にスキップ
          const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
          console.log('🔍 Track search result for 403 error:', {
            trackIndex,
            searchedTrackId: newTrackId,
            foundTrack: trackIndex !== -1 ? trackList[trackIndex] : null
          });
          
          if (trackIndex !== -1) {
            // 現在のトラックインデックスを更新
            updateCurrentTrackState(trackList[trackIndex], trackIndex);
            console.log('🔄 Track access denied - Updated current track index:', trackIndex);
          } else {
            console.warn('⚠️ Track not found in trackList for 403 error, using current index:', currentTrackIndex);
          }
          
          // プレイヤーを停止してから次の曲にスキップ
          if (playerRef.current) {
            console.log('🛑 Disconnecting player before skip (403 error)');
            playerRef.current.disconnect();
          }
          
          // 次の曲にスキップ（即座に実行）
          console.log('⏭️ Skipping to next track immediately (403 error)');
          console.log('🔄 Calling playNext() from 403 error handler');
          playNext();
          return;
        }
        
        // 401エラーの場合は認証エラーフラグを設定
        if (resetResponse.status === 401) {
          console.warn('🚨 Play track failed with 401 - authentication error');
          sessionStorage.setItem('spotify_auth_error', 'true');
          
          // 401エラーの場合もスキップを試行（認証エラー）
          console.error('🚨 Authentication error (401), skipping to next track:', newTrackId);
          
          // 現在のトラックインデックスを更新してから次の曲にスキップ
          const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
          console.log('🔍 Track search result for 401 error:', {
            trackIndex,
            searchedTrackId: newTrackId,
            foundTrack: trackIndex !== -1 ? trackList[trackIndex] : null
          });
          
          if (trackIndex !== -1) {
            // 現在のトラックインデックスを更新
            updateCurrentTrackState(trackList[trackIndex], trackIndex);
            console.log('🔄 Authentication error - Updated current track index:', trackIndex);
          } else {
            console.warn('⚠️ Track not found in trackList for 401 error, using current index:', currentTrackIndex);
          }
          
          // プレイヤーを停止してから次の曲にスキップ
          if (playerRef.current) {
            console.log('🛑 Disconnecting player before skip (401 error)');
            playerRef.current.disconnect();
          }
          
          // 次の曲にスキップ（即座に実行）
          console.log('⏭️ Skipping to next track immediately (401 error)');
          console.log('🔄 Calling playNext() from 401 error handler');
          playNext();
          return;
        }
        
        // 404エラーの場合はトラックが存在しないか、プレイヤーを再初期化
        if (resetResponse.status === 404) {
          console.warn('🚨 Play track failed with 404 - track may not exist or player needs reinitialization:', {
            trackId: newTrackId,
            error: errorData,
            errorReason: errorData.error?.reason,
            errorMessage: errorData.error?.message
          });
          
          // 404エラーの場合は基本的にトラックが存在しないと判断してスキップ
          console.error('🚨 Track not found on Spotify (404), skipping to next track:', {
            trackId: newTrackId,
            currentTrackIndex: currentTrackIndex,
            trackListLength: trackList.length
          });
          
          // 現在のトラックインデックスを更新してから次の曲にスキップ
          const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
          console.log('🔍 Track search result:', {
            trackIndex,
            searchedTrackId: newTrackId,
            foundTrack: trackIndex !== -1 ? trackList[trackIndex] : null
          });
          
          if (trackIndex !== -1) {
            // 現在のトラックインデックスを更新
            updateCurrentTrackState(trackList[trackIndex], trackIndex);
            console.log('🔄 Track not found - Updated current track index:', trackIndex);
          } else {
            console.warn('⚠️ Track not found in trackList, using current index:', currentTrackIndex);
          }
          
          // プレイヤーを停止してから次の曲にスキップ
          if (playerRef.current) {
            console.log('🛑 Disconnecting player before skip');
            playerRef.current.disconnect();
          }
          
          // 次の曲にスキップ（即座に実行）
          console.log('⏭️ Skipping to next track immediately');
          console.log('🔄 Calling playNext() from 404 error handler');
          playNext();
          return;
        }
      }
    } catch (error) {
      handleError(error, 'playNewTrack');
    }
  }, [isReady, deviceId, accessToken, resetDevice, resetPlayerState, trackList, updateCurrentTrackState, handleError, canMakeApiCall, currentTrack, currentTrackIndex, initializePlayer]);

  // Effect to handle play/pause from the context
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('Play/pause effect triggered:', { isPlaying, isReady, deviceId });
    }

    playerRef.current.getCurrentState().then(state => {
      if (!state) {
        if (process.env.NODE_ENV === 'development') {
          console.log('No current state from Spotify player');
        }
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Current Spotify state:', { 
          paused: state.paused, 
          isPlaying, 
          currentTrack: state.track_window.current_track?.name 
        });
      }
      
      if (isPlaying && !state.paused) return;
      if (!isPlaying && state.paused) return;

      if (isPlaying) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Resuming playback');
        }
        playerRef.current.resume();
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('Pausing playback');
        }
        playerRef.current.pause();
      }
    }).catch(error => {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error getting current state:', error);
      }
    });
  }, [isPlaying, isReady, deviceId]);

  // Effect to handle volume changes
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    // ボリューム変更時は音量設定のみを行い、再生状態は変更しない
    playerRef.current.setVolume(volume).catch(error => {
      handleError(error, 'setVolume');
    });
  }, [volume, isReady, handleError]);

  // 再生位置を定期的に更新するエフェクト
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const updatePosition = async () => {
      try {
        const state = await playerRef.current.getCurrentState();
        if (state && state.track_window.current_track) {
          updatePlaybackState(state.duration, state.position);
          
          if (isNewTrackSelectedRef.current) {
            lastPositionRef.current = state.position;
            return;
          }
          
          if (isSeekingRef.current) {
            if (Math.abs(state.position - lastPositionRef.current) > PLAYER_CONFIG.POSITION_CHANGE_THRESHOLD) {
              lastPositionRef.current = state.position;
            } else {
              lastPositionRef.current = state.position;
            }
            return;
          }
          
          lastPositionRef.current = state.position;
        } else {
          // 状態が取得できない場合は、プレイヤーが切断されている可能性
          // プレイヤーの状態を確認
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating position:', error);
        }
        handleError(error, 'updatePosition');
      }
    };

    if (isPlaying) {
      // 再生中は画面の可視性に関係なく位置更新を継続
      positionUpdateIntervalRef.current = setInterval(updatePosition, PLAYER_CONFIG.POSITION_UPDATE_INTERVAL);
      updatePosition();
    } else {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
    }

    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying, isReady, isPageVisible, updatePlaybackState, handleError]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    initializePlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
      if (trackEndCheckTimerRef.current) {
        clearTimeout(trackEndCheckTimerRef.current);
        trackEndCheckTimerRef.current = null;
      }
      if (seekProtectionTimerRef.current) {
        clearTimeout(seekProtectionTimerRef.current);
        seekProtectionTimerRef.current = null;
      }
      if (backgroundCheckIntervalRef.current) {
        clearInterval(backgroundCheckIntervalRef.current);
        backgroundCheckIntervalRef.current = null;
      }
    };
  }, [accessToken, initializePlayer]);

  // Effect for starting a new track
  useEffect(() => {
    if (isReady && deviceId && trackId) {
      // 認証エラーやデバイスエラーが発生している場合は再生しない
      const hasAuthError = sessionStorage.getItem('spotify_auth_error');
      const hasDeviceError = sessionStorage.getItem('spotify_device_error');
      
      if (hasAuthError || hasDeviceError) {
        return;
      }
      
      // エラーフラグがなければクリア
      sessionStorage.removeItem('spotify_auth_error');
      sessionStorage.removeItem('spotify_device_error');
      
      if (trackId !== lastTrackIdRef.current) {
        playNewTrack(trackId);
      } else {
        // Track ID unchanged, skipping playback silently
      }
    }
  }, [trackId, deviceId, isReady, playNewTrack, currentTrack, currentTrackIndex, trackList]);

  // デバイスIDがリセットされた場合の再接続処理
  useEffect(() => {
    if (isReady && !deviceId && trackId) {
      // 認証エラーやデバイスエラーが発生している場合は再接続しない
      const hasAuthError = sessionStorage.getItem('spotify_auth_error');
      const hasDeviceError = sessionStorage.getItem('spotify_device_error');
      
      if (hasAuthError || hasDeviceError) {
        console.log('🔄 Skipping reconnection due to authentication or device error, but will try to play next track');
        
        // 認証エラーでも次の曲を再生を試行
        if (currentTrack && currentTrack.spotifyTrackId) {
          console.log('🎵 Attempting to play next track despite auth error:', currentTrack.spotifyTrackId);
          // 少し遅延してから再生を試行
          setTimeout(() => {
            playNewTrack(currentTrack.spotifyTrackId);
          }, 1000);
        }
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Device ID was reset, attempting to reconnect...');
      }
      const timer = setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.connect().then(success => {
            if (success) {
              if (process.env.NODE_ENV === 'development') {
                console.log('Reconnected to Spotify Web Playback SDK');
              }
              
                             // デバイスIDが設定されるまで待機してから再生状態を復元
               const waitForDeviceAndPlay = () => {
                 if (deviceId) {
                   if (process.env.NODE_ENV === 'development') {
                     console.log('Device ID available, attempting to resume playback');
                   }
                   if (isPlaying && trackId) {
                     setTimeout(() => {
                       playNewTrack(trackId);
                     }, 500);
                   }
                 } else {
                   if (process.env.NODE_ENV === 'development') {
                     console.log('Waiting for device ID...');
                   }
                   // 最大10秒間待機
                   if (waitForDeviceAndPlay.attempts < 20) {
                     waitForDeviceAndPlay.attempts = (waitForDeviceAndPlay.attempts || 0) + 1;
                     setTimeout(waitForDeviceAndPlay, 500);
                   } else {
                     if (process.env.NODE_ENV === 'development') {
                       console.log('Device ID not available after 10 seconds, skipping playback');
                     }
                   }
                 }
               };
               
               // 少し遅延してからデバイスIDの確認を開始
               setTimeout(waitForDeviceAndPlay, 1000);
            }
          }).catch(error => {
            handleError(error, 'reconnect');
          });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [deviceId, isReady, trackId, handleError, isPlaying, playNewTrack]);

  // Effect to handle manual play/pause toggle from context
  useEffect(() => {
    if (!isReady || !playerRef.current || !lastTrackIdRef.current) {
      return;
    }

    const togglePlayerState = async () => {
      try {
        const state = await playerRef.current.getCurrentState();
        if (!state) {
          return;
        }

        if (isPlaying && state.paused) {
          await playerRef.current.resume();
        } else if (!isPlaying && !state.paused) {
          await playerRef.current.pause();
        }
      } catch (e) {
        handleError(e, 'togglePlayerState');
      }
    };

    togglePlayerState();
  }, [isPlaying, isReady, handleError]);

  // 再ログイン処理
  const handleReLogin = useCallback(() => {
    console.log('🔄 CONTINUOUS PLAY - Re-login initiated');
    
    // 認証エラーフラグをクリア
    sessionStorage.removeItem('spotify_auth_error');
    sessionStorage.removeItem('spotify_device_error');
    
    // プレイヤー状態をリセット
    setShowAuthError(false);
    setIsReady(false);
    setDeviceId(null);
    resetPlayerState();
    
    // ページをリロードしてSpotify認証を再実行
    if (typeof window !== 'undefined') {
      console.log('🔄 CONTINUOUS PLAY - Reloading page for re-authentication');
      window.location.reload();
    }
  }, [resetPlayerState]);

  // 認証エラーを閉じる
  const handleDismissAuthError = useCallback(() => {
    setShowAuthError(false);
  }, []);

  return (
    <>
      {showAuthError && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#ff6b6b',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxWidth: '300px',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            🔄 Spotify再ログインが必要
          </div>
          <div style={{ marginBottom: '15px' }}>
            連続再生中にSpotifyの認証が期限切れになりました。再ログインボタンを押してページをリロードしてください。
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleReLogin}
              style={{
                backgroundColor: '#1db954',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              再ログイン
            </button>
            <button
              onClick={handleDismissAuthError}
              style={{
                backgroundColor: 'transparent',
                color: 'white',
                border: '1px solid white',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer; 