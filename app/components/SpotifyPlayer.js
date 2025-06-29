'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { usePlayer } from './PlayerContext';

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
        }, 2000);
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
      // デバイスIDをクリアして、無効なIDを使い続けないようにする
      setDeviceId(null);
      setIsReady(false);
    });

    player.addListener('player_state_changed', (state) => {
      if (!state) {
        return;
      }
      
      // 新しい曲が選択された直後は、前の曲の情報を完全に無視する
      if (isNewTrackSelectedRef.current) {
        // 新しい曲の情報のみを更新
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
        // シーク操作中に位置が大きく変わった場合、lastPositionRefを更新
        if (Math.abs(state.position - lastPositionRef.current) > 1000) {
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
        // 期待している曲が前の曲リストにある場合、その曲が終了したとみなす
        const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
        if (expectedTrackInPrevious && lastPositionRef.current > 1000) {
          // 状態を完全にリセット
          currentTrackIdRef.current = null;
          lastPositionRef.current = 0;
          isNewTrackSelectedRef.current = false;
          
          // タイマーをクリア
          if (trackEndCheckTimerRef.current) {
            clearTimeout(trackEndCheckTimerRef.current);
            trackEndCheckTimerRef.current = null;
          }
          
          if(playNext) {
            setTimeout(() => {
              try {
                playNext();
              } catch (error) {
                // エラーハンドリング
              }
            }, 200);
          }
          return;
        }
        
        // 期待している曲が前の曲リストにない場合、強制的に期待している曲を再生し直す
        if (!expectedTrackInPrevious && lastPositionRef.current > 1000) {
          // 期待している曲を強制的に再生
          const forcePlayExpectedTrack = async () => {
            try {
              if (!deviceId) {
                return;
              }
              
              // 前の曲を確実に停止するため、pause()を呼び出す
              if (playerRef.current) {
                try {
                  await playerRef.current.pause();
                  // pause()の後に少し待機して確実に停止させる
                  await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                  // エラーハンドリング
                }
              }
              
              // さらに強力なクリア処理：デバイスを一度リセット
              const deviceResetResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
              
              if (deviceResetResponse.ok) {
                // リセット後に待機
                await new Promise(resolve => setTimeout(resolve, 300));
              }

              // さらに強力なクリア処理：デバイスを一度リセット
              const deviceResetResponse2 = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
              
              if (deviceResetResponse2.ok) {
                // リセット後に待機
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              // さらに強力なクリア処理：デバイスを一度リセット
              const deviceResetResponse3 = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
              
              if (deviceResetResponse3.ok) {
                // リセット後に待機
                await new Promise(resolve => setTimeout(resolve, 300));
              }

              const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                  uris: [`spotify:track:${expectedTrackId}`],
                  position_ms: 0 // 確実に最初から再生
                }),
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
              });

              if (response.ok) {
                currentTrackIdRef.current = expectedTrackId;
                lastPositionRef.current = 0;
                
                // 新しい曲が選択されたことをマーク
                isNewTrackSelectedRef.current = true;
                
                // 保護時間を短縮して前の曲が一瞬鳴る問題を解決
                setTimeout(() => {
                  isNewTrackSelectedRef.current = false;
                }, 8000); // 保護時間を8秒に延長して前の曲が一瞬鳴る問題を完全に防止
              }
            } catch (error) {
              // エラーハンドリング
            }
          };
          
          forcePlayExpectedTrack();
          return;
        }
      }
      
      // 曲の終了を検知する（より確実な条件に改善）
      const trackJustEnded = (
        expectedTrackId && 
        state.paused &&
        state.position === 0 &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        !state.track_window.current_track
      );

      // Spotifyが自動的に次の曲に切り替わった場合の検知（actualTrackEndedと統合）
      const spotifyAutoNext = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 50 && // 閾値を50msにさらに緩和
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId
      );

      // より確実な終了検知：現在の曲が前の曲リストに移動し、新しい曲が再生されている場合
      const trackFullyEnded = (
        expectedTrackId &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId &&
        currentPlayingTrackId && // 新しい曲が実際に再生されている
        lastPositionRef.current > 50 // 閾値を50msにさらに緩和
      );

      // 最も厳密な終了検知：新しい曲が確実に開始され、前の曲が完全に終了した場合
      const trackCompletelyEnded = (
        expectedTrackId &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId &&
        currentPlayingTrackId && // 新しい曲が実際に再生されている
        state.position > 0 && // 新しい曲が実際に再生位置を持っている
        lastPositionRef.current > 50 // 閾値を50msにさらに緩和
      );

      // 同じ曲のループ再生を可能にする終了検知：位置が0に戻り、十分な再生時間があった場合
      const trackLoopEnded = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 50 && // 閾値を50msにさらに緩和
        currentPlayingTrackId === expectedTrackId // 同じ曲が再生されている（ループの場合）
      );

      // より簡単な終了検知：位置が0に戻り、前回の位置が十分大きかった場合
      const simpleTrackEnded = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 50 && // 閾値を50msにさらに緩和
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId)
      );

      if (trackJustEnded || spotifyAutoNext || trackFullyEnded || trackCompletelyEnded || trackLoopEnded || simpleTrackEnded) {
        // 状態を完全にリセット
        currentTrackIdRef.current = null;
        lastPositionRef.current = 0;
        isNewTrackSelectedRef.current = false;
        
        // タイマーをクリア
        if (trackEndCheckTimerRef.current) {
          clearTimeout(trackEndCheckTimerRef.current);
          trackEndCheckTimerRef.current = null;
        }
        
        if(playNext) {
          setTimeout(() => {
            try {
              // PlayerContextの状態を明示的に更新してからplayNextを呼び出す
              // これにより、playNextが正しい現在の曲情報を取得できる
              if (currentTrack && currentTrackIndex >= 0) {
                updateCurrentTrackState(currentTrack, currentTrackIndex);
              }
              
              playNext();
            } catch (error) {
              // エラーハンドリング
            }
          }, 100); // 遅延時間をさらに短縮
        }
      } else {
        // 終了していない場合は位置を更新
        lastPositionRef.current = state.position;
      }
    });

    player.addListener('initialization_error', ({ message }) => {
      // エラーハンドリング
    });
    player.addListener('authentication_error', ({ message }) => {
      // エラーハンドリング
    });
    player.addListener('account_error', ({ message }) => {
      // エラーハンドリング
    });
    player.addListener('playback_error', ({ message }) => {
      // エラーハンドリング
    });
  }

  // 曲の終了をチェックするタイマー
  const startTrackEndCheck = useCallback(() => {
    if (trackEndCheckTimerRef.current) {
      clearTimeout(trackEndCheckTimerRef.current);
    }
    
    trackEndCheckTimerRef.current = setTimeout(async () => {
      if (!playerRef.current || !isReady) return;
      
      try {
        const state = await playerRef.current.getCurrentState();
        if (!state) return;
        
        // 新しい曲が選択された直後は終了検知を無効にする
        if (isNewTrackSelectedRef.current) {
          return;
        }
        
        // シーク操作中は終了検知を無効にする
        if (isSeekingRef.current) {
          return;
        }
        
        // 位置が0で、前回の位置が大きかった場合、曲が終了したとみなす
        if (state.position === 0 && lastPositionRef.current > 50) { // 閾値を50msにさらに緩和
          // 状態をリセット
          lastPositionRef.current = 0;
          currentTrackIdRef.current = null;
          
          // タイマーをクリア
          if (trackEndCheckTimerRef.current) {
            clearTimeout(trackEndCheckTimerRef.current);
            trackEndCheckTimerRef.current = null;
          }
          
          if (playNext) {
            setTimeout(() => {
              try {
                // PlayerContextの状態を明示的に更新してからplayNextを呼び出す
                if (currentTrack && currentTrackIndex >= 0) {
                  updateCurrentTrackState(currentTrack, currentTrackIndex);
                }
                
                playNext();
              } catch (error) {
                // エラーハンドリング
              }
            }, 200);
          }
        }
      } catch (error) {
        // エラーハンドリング
      }
    }, 3000); // 3秒後にチェック（より長い時間に延長）
  }, [isReady, playNext]);

  // 新しい曲を再生する関数
  const playNewTrack = useCallback(async (newTrackId) => {
    if (!isReady || !deviceId) {
      return;
    }

    try {
      // Step 1: Transfer playback to this device to ensure it's active
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
        const errorBody = await transferResponse.json().catch(() => ({}));
        // Don't stop here, as playback might work anyway. We'll proceed to the play command.
      }
      
      // 前の曲を確実に停止するため、より長い待機時間を設定
      await new Promise(resolve => setTimeout(resolve, 500));

      // 前の曲を確実に停止するため、pause()を呼び出す
      if (playerRef.current) {
        try {
          await playerRef.current.pause();
          // pause()の後に少し待機して確実に停止させる
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          // エラーハンドリング
        }
      }

      // 前の曲を完全にクリアするため、一度停止状態にしてから新しい曲を開始
      const clearResponse = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (clearResponse.ok) {
        // クリア後に少し待機
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // さらに強力なクリア処理：デバイスを一度リセット
      const deviceResetResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
      
      if (deviceResetResponse.ok) {
        // リセット後に待機
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // さらに強力なクリア処理：デバイスを一度リセット
      const deviceResetResponse2 = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
      
      if (deviceResetResponse2.ok) {
        // リセット後に待機
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 2: Play the new track
      // 新しい曲を再生する前に、デバイスをリセットして前の曲を完全にクリア
      const resetResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          uris: [`spotify:track:${newTrackId}`],
          position_ms: 0 // 確実に最初から再生
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      // 新しい曲が開始された後に、内部状態を完全にリセット
      if (resetResponse.ok) {
        // 状態を完全にリセット
        currentTrackIdRef.current = null;
        lastPositionRef.current = 0;
        isNewTrackSelectedRef.current = true;
        
        // 少し待機してから新しい曲のIDを設定
        await new Promise(resolve => setTimeout(resolve, 200));
        currentTrackIdRef.current = newTrackId;
        lastTrackIdRef.current = newTrackId;
        
        // 新しい曲が開始された時に内部状態をリセット
        
        // Update PlayerContext to ensure the rest of the app knows about the new track.
        const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
        if (trackIndex !== -1) {
          updateCurrentTrackState(trackList[trackIndex], trackIndex);
        }

        // Set protection timer to avoid false end-detection
        setTimeout(() => {
          isNewTrackSelectedRef.current = false;
        }, 8000); // 保護時間を8秒に延長して前の曲が一瞬鳴る問題を完全に防止

      }
    } catch (error) {
      // エラーハンドリング
    }
  }, [isReady, deviceId, accessToken]);

  // Effect to handle play/pause from the context
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    playerRef.current.getCurrentState().then(state => {
      if (!state) return;
      
      if (isPlaying && !state.paused) return; // Already playing
      if (!isPlaying && state.paused) return; // Already paused

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
    
    playerRef.current.setVolume(volume).catch(error => {
      console.error("Failed to set volume:", error);
    });
  }, [volume, isReady]);

  // 再生位置を定期的に更新するエフェクト
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const updatePosition = async () => {
      try {
        const state = await playerRef.current.getCurrentState();
        if (state && state.track_window.current_track) {
          updatePlaybackState(state.duration, state.position);
          
          // 新しい曲が選択された直後は終了検知を無効にする
          if (isNewTrackSelectedRef.current) {
            lastPositionRef.current = state.position;
            return;
          }
          
          // シーク操作中は終了検知を無効にする
          if (isSeekingRef.current) {
            // シーク操作中に位置が大きく変わった場合、lastPositionRefを更新
            if (Math.abs(state.position - lastPositionRef.current) > 1000) {
              lastPositionRef.current = state.position;
            } else {
              lastPositionRef.current = state.position;
            }
            return;
          }
          
          lastPositionRef.current = state.position;
        }
      } catch (error) {
        // エラーハンドリング
      }
    };

    // 再生中は1秒ごとに位置を更新
    if (isPlaying) {
      positionUpdateIntervalRef.current = setInterval(updatePosition, 1000);
      updatePosition(); // 即座に一度実行
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
  }, [isPlaying, isReady, updatePlaybackState, playNext]);

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
          volume: volume ?? 0.2
      });
      
      playerRef.current = player;
      setPlayerStateListeners(player);
      
      player.connect().then(success => {
          if (success) {
            // 接続成功
          }
      }).catch(error => {
        // エラーハンドリング
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
        // エラーハンドリング
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
  }, [accessToken]);

  // Effect for starting a new track
  useEffect(() => {
    if (isReady && deviceId && trackId) {
      // Only play new tracks. Toggling play/pause for the same track is handled in another effect.
      if (trackId !== lastTrackIdRef.current) {
        playNewTrack(trackId);
      }
    }
  }, [trackId, deviceId, isReady, playNewTrack]); // Depends on playNewTrack now

  // Effect to handle manual play/pause toggle from context
  useEffect(() => {
    if (!isReady || !playerRef.current || !lastTrackIdRef.current) {
      // Don't do anything if player isn't ready or no track has been loaded yet
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
        // エラーハンドリング
      }
    };

    togglePlayerState();
  }, [isPlaying, isReady]); // isReady is needed to ensure playerRef.current is valid

  return null;
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer; 