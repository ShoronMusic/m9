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
        if (success) {
          // 接続成功
          if (process.env.NODE_ENV === 'development') {
            console.log('Spotify Web Playback SDK connected successfully');
          }
        } else {
          console.error('Spotify Web Playback SDK connection failed');
          // エラーハンドリングは後で行う
        }
      }).catch(error => {
        console.error('Spotify Web Playback SDK connection error:', error);
        // エラーハンドリングは後で行う
      });
    };

    const scriptId = 'spotify-sdk-script';
    
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onload = () => {
        if (window.Spotify) {
          window.onSpotifyWebPlaybackSDKReady();
        }
      };
      script.onerror = (error) => {
        console.error('Script load error:', error);
      };
      document.body.appendChild(script);
    } else {
      if (window.Spotify) {
        window.onSpotifyWebPlaybackSDKReady();
      }
    }
  }, [accessToken]);

  // エラーハンドリング関数
  const handleError = useCallback((error, context) => {
    console.error(`SpotifyPlayer error in ${context}:`, error);
    
    // 429 Too Many Requestsエラーの処理
    if (error.status === 429 || error.message?.includes('429')) {
      console.warn('Spotify API 429 Too Many Requests - レート制限に達しました');
      
      // レート制限の場合は長時間待機
      setTimeout(() => {
        if (accessToken) {
          initializePlayer();
        }
      }, 60000); // 1分待機
      
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
      
      // 少し遅延してから再初期化を試行
      setTimeout(() => {
        if (accessToken) {
          initializePlayer();
        }
      }, 3000);
      
      return;
    }
    
    // 403 Forbiddenエラーの特別な処理
    if (error.status === 403 || error.message?.includes('403')) {
      console.warn('Spotify API 403 Forbidden - デバイスまたはトークンの問題');
      
      // デバイスIDをリセットして再試行
      if (deviceId) {
        console.log('Resetting device ID due to 403 error');
        setDeviceId(null);
      }
      
      // アクセストークンの再取得を促す
      if (context === 'play' || context === 'resetDevice') {
        console.log('Access token may be expired or invalid');
      }
    }
    
    // 401 Unauthorizedエラーの処理
    if (error.status === 401 || error.message?.includes('401')) {
      console.warn('Spotify API 401 Unauthorized - トークンの期限切れ');
    }
    
    // 404 Not Foundエラーの処理
    if (error.status === 404 || error.message?.includes('404')) {
      console.warn('Spotify API 404 Not Found - デバイスが見つからない');
      
      // デバイスエラーフラグを設定
      sessionStorage.setItem('spotify_device_error', 'true');
      
      setDeviceId(null);
    }
  }, [deviceId, accessToken, initializePlayer]);

  // 次の曲を再生する関数
  const triggerPlayNext = useCallback(() => {
    if (playNext) {
      console.log('Triggering playNext from SpotifyPlayer');
      setTimeout(() => {
        try {
          // 現在の状態をログ出力
          console.log('Current state before playNext:', {
            currentTrack: currentTrack?.title || currentTrack?.name,
            currentTrackIndex,
            trackListLength: trackList.length,
            currentTrackId: currentTrack?.spotifyTrackId || currentTrack?.id,
            currentTrackTitle: currentTrack?.title || currentTrack?.name
          });
          
          // 視聴履歴を記録
          if (handleTrackEnd) {
            console.log('Calling handleTrackEnd');
            handleTrackEnd();
          } else {
            // フォールバック: 直接playNextを呼び出し
            console.log('handleTrackEnd not available, calling playNext directly');
            if (currentTrack && currentTrackIndex >= 0) {
              updateCurrentTrackState(currentTrack, currentTrackIndex);
            }
            playNext();
          }
        } catch (error) {
          console.error('Error in triggerPlayNext:', error);
          handleError(error, 'playNext');
        }
      }, PLAYER_CONFIG.PLAY_NEXT_DELAY);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('playNext function not available');
      }
    }
  }, [playNext, currentTrack, currentTrackIndex, updateCurrentTrackState, handleError, handleTrackEnd]);

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
        if (state.track_window.current_track) {
          updatePlaybackState(state.duration, state.position);
          lastPositionRef.current = state.position;
        }
        return;
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

      // 曲の終了検知
      if (isTrackEnded(state, expectedTrackId)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Track ended, triggering next track');
        }
        
        // 終了検知タイマーを設定
        if (trackEndCheckTimerRef.current) {
          clearTimeout(trackEndCheckTimerRef.current);
        }
        
        trackEndCheckTimerRef.current = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Track end timer triggered');
          }
          triggerPlayNext();
        }, PLAYER_CONFIG.TRACK_END_CHECK_DELAY);
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
    const checkAuthError = () => {
      const hasAuthError = sessionStorage.getItem('spotify_auth_error');
      const wasShowingError = showAuthError;
      setShowAuthError(!!hasAuthError);
      
      // 認証エラーが発生している場合はプレイヤーをリセット
      if (hasAuthError) {
        if (playerRef.current) {
          playerRef.current.disconnect();
          playerRef.current = null;
        }
        setIsReady(false);
        setDeviceId(null);
        resetPlayerState();
      }
      
      // 認証エラーが解決された場合はプレイヤーを再初期化
      if (wasShowingError && !hasAuthError && accessToken) {
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

    // 定期的にチェック
    const interval = setInterval(checkAuthError, 5000);
    return () => clearInterval(interval);
  }, [resetPlayerState, showAuthError, accessToken, initializePlayer]);

  // バックグラウンド時の状態チェック
  const checkBackgroundState = useCallback(async () => {
    if (!isReady || !playerRef.current || isPageVisible) return;
    
    try {
      const state = await playerRef.current.getCurrentState();
      if (state && state.track_window.current_track) {
        // バックグラウンドでも状態を更新
        updatePlaybackState(state.duration, state.position);
        lastPositionRef.current = state.position;
        
        // 曲が終了したかチェック
        if (isTrackEnded(state, currentTrackIdRef.current)) {
          resetPlayerState();
          triggerPlayNext();
        }
      }
    } catch (error) {
      handleError(error, 'backgroundCheck');
    }
  }, [isReady, isPageVisible, updatePlaybackState, handleError]);

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
      // ページが表示された時、少し遅延してから状態を確認
      const timer = setTimeout(async () => {
        try {
          const state = await playerRef.current.getCurrentState();
          if (state && state.track_window.current_track) {
            updatePlaybackState(state.duration, state.position);
            lastPositionRef.current = state.position;
          }
        } catch (error) {
          handleError(error, 'visibilityRestore');
        }
      }, PLAYER_CONFIG.VISIBILITY_RESTORE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isPageVisible, isReady, updatePlaybackState, handleError]);

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

  // 曲の終了検知ロジックの簡素化
  const isTrackEnded = useCallback((state, expectedTrackId) => {
    if (!expectedTrackId || !state) return false;
    
    const basicConditions = (
      state.position === 0 &&
      lastPositionRef.current > PLAYER_CONFIG.TRACK_END_THRESHOLD
    );
    
    if (!basicConditions) return false;
    
    // 前の曲リストに期待している曲がある場合
    const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
    if (expectedTrackInPrevious) {
      const currentPlayingTrackId = state.track_window.current_track?.id;
      // 新しい曲が再生されているか、同じ曲のループの場合
      return currentPlayingTrackId !== expectedTrackId || currentPlayingTrackId === expectedTrackId;
    }
    
    // 一時停止状態で現在の曲がない場合
    return state.paused && !state.track_window.current_track;
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
    }
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
        }, PLAYER_CONFIG.PROTECTION_TIME);
      }
    } catch (error) {
      handleError(error, 'forcePlayExpectedTrack');
    }
  }, [deviceId, accessToken, resetDevice, handleError]);

  // API呼び出し制限機能
  const canMakeApiCall = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallRef.current;
    
    // 1秒間に最大10回のAPI呼び出しを制限
    if (timeSinceLastCall < 100) {
      return false;
    }
    
    // 1分間に最大100回のAPI呼び出しを制限
    if (apiCallCountRef.current > 100) {
      return false;
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
    if (!isReady) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cannot play new track: player not ready');
      }
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

    // API呼び出し制限をチェック
    if (!canMakeApiCall()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('API call rate limited, skipping track playback');
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Starting to play new track:', { 
        newTrackId, 
        deviceId, 
        isReady,
        currentTrack: currentTrack?.title || currentTrack?.name,
        currentTrackIndex,
        trackListLength: trackList.length
      });
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
      
      if (resetResponse.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Track playback started successfully');
        }
        
        resetPlayerState();
        isNewTrackSelectedRef.current = true;
        
        await new Promise(resolve => setTimeout(resolve, 200));
        currentTrackIdRef.current = newTrackId;
        lastTrackIdRef.current = newTrackId;
        
        // Update PlayerContext
        const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
        if (trackIndex !== -1) {
          updateCurrentTrackState(trackList[trackIndex], trackIndex);
        }

        setTimeout(() => {
          isNewTrackSelectedRef.current = false;
        }, PLAYER_CONFIG.PROTECTION_TIME);
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
          console.warn('Play track failed with 403 - resetting device ID');
          setDeviceId(null);
          sessionStorage.setItem('spotify_auth_error', 'true');
        }
        
        // 401エラーの場合は認証エラーフラグを設定
        if (resetResponse.status === 401) {
          console.warn('Play track failed with 401 - authentication error');
          sessionStorage.setItem('spotify_auth_error', 'true');
        }
        
        // 404エラーの場合はプレイヤーを再初期化
        if (resetResponse.status === 404) {
          console.warn('Play track failed with 404 - reinitializing player');
          if (playerRef.current) {
            playerRef.current.disconnect();
            setTimeout(() => {
              initializePlayer();
            }, 1000);
          }
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
          if (process.env.NODE_ENV === 'development') {
            console.log('No player state available - player may be disconnected');
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating position:', error);
        }
        handleError(error, 'updatePosition');
      }
    };

    if (isPlaying && isPageVisible) {
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
    if (process.env.NODE_ENV === 'development') {
      console.log('Track playback effect triggered:', { 
        isReady, 
        deviceId, 
        trackId, 
        lastTrackId: lastTrackIdRef.current,
        currentTrack: currentTrack?.title || currentTrack?.name,
        currentTrackIndex,
        trackListLength: trackList.length
      });
    }
    
    if (isReady && deviceId && trackId) {
      // 認証エラーやデバイスエラーが発生している場合は再生しない
      const hasAuthError = sessionStorage.getItem('spotify_auth_error');
      const hasDeviceError = sessionStorage.getItem('spotify_device_error');
      
      if (hasAuthError || hasDeviceError) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Skipping track playback due to authentication or device error');
        }
        return;
      }
      
      // エラーフラグがなければクリア
      sessionStorage.removeItem('spotify_auth_error');
      sessionStorage.removeItem('spotify_device_error');
      
      if (trackId !== lastTrackIdRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Starting new track playback:', { 
            trackId, 
            deviceId, 
            isReady,
            currentTrack: currentTrack?.title || currentTrack?.name,
            currentTrackIndex,
            trackListLength: trackList.length
          });
        }
        playNewTrack(trackId);
      } else {
        // Track ID unchanged, skipping playback silently
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cannot start track playback:', { 
          isReady, 
          deviceId, 
          trackId,
          currentTrack: currentTrack?.title || currentTrack?.name,
          currentTrackIndex,
          trackListLength: trackList.length
        });
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
        if (process.env.NODE_ENV === 'development') {
          console.log('Skipping reconnection due to authentication or device error');
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
            Spotify認証エラー
          </div>
          <div style={{ marginBottom: '15px' }}>
            Spotifyログインが必要です。音楽を再生するには、Spotifyアカウントにログインしてください。
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                sessionStorage.removeItem('spotify_auth_error');
                setShowAuthError(false);
                window.location.href = '/auth/signin';
              }}
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
              Spotifyログイン
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('spotify_auth_error');
                setShowAuthError(false);
              }}
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