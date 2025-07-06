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
};

const SpotifyPlayer = forwardRef(({ accessToken, trackId, autoPlay }, ref) => {
  const playerRef = useRef(null);
  const { playNext, isPlaying, updatePlaybackState, currentTrack, currentTrackIndex, trackList, updateCurrentTrackState, volume } = usePlayer();
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  
  const currentTrackIdRef = useRef(null);
  const positionUpdateIntervalRef = useRef(null);
  const lastPositionRef = useRef(0);
  const trackEndCheckTimerRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const isNewTrackSelectedRef = useRef(false);
  const isSeekingRef = useRef(false);
  const seekProtectionTimerRef = useRef(null);

  // エラーハンドリング関数
  const handleError = useCallback((error, context) => {
    console.error(`SpotifyPlayer error in ${context}:`, error);
  }, []);

  // デバイスリセット処理の統合
  const resetDevice = useCallback(async () => {
    if (!deviceId || !accessToken) return false;
    
    try {
      const resetResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          uris: [],
          position_ms: 0
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (resetResponse.ok) {
        await new Promise(resolve => setTimeout(resolve, PLAYER_CONFIG.RESET_DELAY));
        return true;
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

  // 次の曲を再生する関数
  const triggerPlayNext = useCallback(() => {
    if (playNext) {
      setTimeout(() => {
        try {
          if (currentTrack && currentTrackIndex >= 0) {
            updateCurrentTrackState(currentTrack, currentTrackIndex);
          }
          playNext();
        } catch (error) {
          handleError(error, 'playNext');
        }
      }, PLAYER_CONFIG.PLAY_NEXT_DELAY);
    }
  }, [playNext, currentTrack, currentTrackIndex, updateCurrentTrackState, handleError]);

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

  const setPlayerStateListeners = (player) => {
    player.addListener('ready', ({ device_id }) => {
      setDeviceId(device_id);
      setIsReady(true);
    });

    player.addListener('not_ready', ({ device_id }) => {
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
        const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
        
        if (expectedTrackInPrevious && lastPositionRef.current > PLAYER_CONFIG.POSITION_CHANGE_THRESHOLD) {
          resetPlayerState();
          triggerPlayNext();
          return;
        }
        
        // 期待している曲を強制的に再生し直す
        if (!expectedTrackInPrevious && lastPositionRef.current > PLAYER_CONFIG.POSITION_CHANGE_THRESHOLD) {
          forcePlayExpectedTrack(expectedTrackId);
          return;
        }
      }
      
      // 曲の終了を検知
      if (isTrackEnded(state, expectedTrackId)) {
        resetPlayerState();
        triggerPlayNext();
      } else {
        // 終了していない場合は位置を更新
        lastPositionRef.current = state.position;
      }
    });

    player.addListener('initialization_error', ({ message }) => {
      handleError(new Error(message), 'initialization_error');
    });
    player.addListener('authentication_error', ({ message }) => {
      handleError(new Error(message), 'authentication_error');
    });
    player.addListener('account_error', ({ message }) => {
      handleError(new Error(message), 'account_error');
    });
    player.addListener('playback_error', ({ message }) => {
      handleError(new Error(message), 'playback_error');
    });
  }

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

  // 新しい曲を再生する関数
  const playNewTrack = useCallback(async (newTrackId) => {
    if (!isReady || !deviceId) {
      return;
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
        await transferResponse.json().catch(() => ({}));
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
      }
    } catch (error) {
      handleError(error, 'playNewTrack');
    }
  }, [isReady, deviceId, accessToken, resetDevice, resetPlayerState, trackList, updateCurrentTrackState, handleError]);

  // Effect to handle play/pause from the context
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    playerRef.current.getCurrentState().then(state => {
      if (!state) return;
      
      if (isPlaying && !state.paused) return;
      if (!isPlaying && state.paused) return;

      if (isPlaying) {
        playerRef.current.resume();
      } else {
        playerRef.current.pause();
      }
    });
  }, [isPlaying, isReady]);

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
        }
      } catch (error) {
        handleError(error, 'updatePosition');
      }
    };

    if (isPlaying) {
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
  }, [isPlaying, isReady, updatePlaybackState, handleError]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (playerRef.current) {
        return;
      }

      const player = new window.Spotify.Player({
          name: 'Music8 Web Player',
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
          }
      }).catch(error => {
        handleError(error, 'connect');
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
        handleError(error, 'script_load');
      };
      document.body.appendChild(script);
    } else {
      if (window.Spotify) {
        window.onSpotifyWebPlaybackSDKReady();
      }
    }

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
    };
  }, [accessToken, handleError]);

  // Effect for starting a new track
  useEffect(() => {
    if (isReady && deviceId && trackId) {
      if (trackId !== lastTrackIdRef.current) {
        playNewTrack(trackId);
      }
    }
  }, [trackId, deviceId, isReady, playNewTrack]);

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

  return null;
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer; 