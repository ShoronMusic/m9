'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { usePlayer } from './PlayerContext';

const SpotifyPlayer = forwardRef(({ accessToken, trackId, autoPlay }, ref) => {
  const playerRef = useRef(null);
  const { playNext, isPlaying, updatePlaybackState, currentTrack, currentTrackIndex, trackList, updateCurrentTrackState } = usePlayer();
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
          console.log('Seek already in progress, ignoring new seek request');
          return;
        }
        console.log('Seeking to position:', position);
        isSeekingRef.current = true;
        if (seekProtectionTimerRef.current) {
          clearTimeout(seekProtectionTimerRef.current);
        }
        playerRef.current.seek(position);
        console.log('Seek completed, lastPositionRef remains:', lastPositionRef.current);
        seekProtectionTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
          if (playerRef.current) {
            playerRef.current.getCurrentState().then(state => {
              if (state && state.track_window.current_track) {
                lastPositionRef.current = state.position;
                console.log('Seek protection disabled, updated lastPositionRef to:', state.position);
              }
            });
          } else {
            console.log('Seek protection disabled');
          }
        }, 2000);
      }
    },
    setVolume: (volume) => {
      if (playerRef.current && isReady) {
        console.log('Setting volume to:', volume);
        playerRef.current.setVolume(volume);
      }
    }
  }));

  const setPlayerStateListeners = (player) => {
    console.log('SpotifyPlayer: Setting up player state listeners');
    
    player.addListener('ready', ({ device_id }) => {
      console.log('Player is ready with Device ID', device_id);
      setDeviceId(device_id);
      setIsReady(true);
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.log('Device ID has gone offline', device_id);
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
        console.log('Skipping track end detection (new track selected)');
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
        console.log('Skipping track end detection (seeking)');
        // シーク操作中に位置が大きく変わった場合、lastPositionRefを更新
        if (Math.abs(state.position - lastPositionRef.current) > 1000) {
          console.log('Large position change detected during seek (position update), updating lastPositionRef');
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
        console.log('Track ID mismatch detected. Spotify may have switched tracks automatically.');
        
        // 期待している曲が前の曲リストにある場合、その曲が終了したとみなす
        const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
        if (expectedTrackInPrevious && lastPositionRef.current > 1000) {
          console.log(`Expected track ${expectedTrackId} found in previous tracks. Treating as ended.`);
          
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
            console.log('Calling playNext due to track ID mismatch...');
            setTimeout(() => {
              console.log('Executing playNext from track ID mismatch...');
              try {
                playNext();
                console.log('playNext executed successfully from track ID mismatch');
              } catch (error) {
                console.error('Error executing playNext from track ID mismatch:', error);
              }
            }, 200);
          }
          return;
        }
        
        // 期待している曲が前の曲リストにない場合、強制的に期待している曲を再生し直す
        if (!expectedTrackInPrevious && lastPositionRef.current > 1000) {
          console.log(`Expected track ${expectedTrackId} not found in previous tracks. Forcing playback of expected track.`);
          
          // 期待している曲を強制的に再生
          const forcePlayExpectedTrack = async () => {
            try {
              console.log(`Forcing playback of expected track: ${expectedTrackId} on device: ${deviceId}`);
              if (!deviceId) {
                console.error('No active device ID to force playback.');
                return;
              }
              
              // 前の曲を確実に停止するため、pause()を呼び出す
              if (playerRef.current) {
                try {
                  console.log('Pausing current playback before forcing new track...');
                  await playerRef.current.pause();
                  // pause()の後に少し待機して確実に停止させる
                  await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                  console.warn('Failed to pause current playback:', error);
                }
              }
              
              // さらに強力なクリア処理：デバイスを一度リセット
              console.log('Performing device reset to clear all track information...');
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
                console.log('Device reset successful');
                // リセット後に待機
                await new Promise(resolve => setTimeout(resolve, 300));
              } else {
                console.warn('Failed to reset device:', deviceResetResponse.status);
              }

              // さらに強力なクリア処理：デバイスを一度リセット
              console.log('Performing device reset to clear all track information...');
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
                console.log('Device reset successful (second attempt)');
                // リセット後に待機
                await new Promise(resolve => setTimeout(resolve, 500));
              } else {
                console.warn('Failed to reset device (second attempt):', deviceResetResponse2.status);
              }

              // さらに強力なクリア処理：デバイスを一度リセット
              console.log('Performing device reset to clear all track information...');
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
                console.log('Device reset successful (third attempt)');
                // リセット後に待機
                await new Promise(resolve => setTimeout(resolve, 300));
              } else {
                console.warn('Failed to reset device (third attempt):', deviceResetResponse3.status);
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
                console.log(`Forced playback started for expected track: ${expectedTrackId}`);
                currentTrackIdRef.current = expectedTrackId;
                lastPositionRef.current = 0;
                
                // 新しい曲が選択されたことをマーク
                isNewTrackSelectedRef.current = true;
                
                // 保護時間を短縮して前の曲が一瞬鳴る問題を解決
                setTimeout(() => {
                  isNewTrackSelectedRef.current = false;
                  console.log('Track end detection enabled for forced track:', currentTrackIdRef.current);
                }, 8000); // 保護時間を8秒に延長して前の曲が一瞬鳴る問題を完全に防止
              } else {
                console.error('Failed to force playback of expected track:', response.status);
              }
            } catch (error) {
              console.error('Error forcing playback of expected track:', error);
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
        console.log(`Track ${expectedTrackId} ended. Playing next.`);
        
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
          console.log('Calling playNext from state change...');
          setTimeout(() => {
            console.log('Executing playNext from state change...');
            try {
              // PlayerContextの状態を明示的に更新してからplayNextを呼び出す
              // これにより、playNextが正しい現在の曲情報を取得できる
              if (currentTrack && currentTrackIndex >= 0) {
                console.log('Updating PlayerContext state before playNext...');
                updateCurrentTrackState(currentTrack, currentTrackIndex);
              }
              
              console.log('About to call playNext function...');
              playNext();
              console.log('playNext executed successfully');
            } catch (error) {
              console.error('Error executing playNext:', error);
            }
          }, 100); // 遅延時間をさらに短縮
        } else {
          console.log('playNext function is not available in state change');
        }
      } else {
        // 終了していない場合は位置を更新
        lastPositionRef.current = state.position;
      }
    });

    player.addListener('initialization_error', ({ message }) => console.error('Initialization Error:', message));
    player.addListener('authentication_error', ({ message }) => console.error('Authentication Error:', message));
    player.addListener('account_error', ({ message }) => console.error('Account Error:', message));
    player.addListener('playback_error', ({ message }) => console.error('Playback Error:', message));
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
          console.log('Skipping track end check (new track selected)');
          return;
        }
        
        // シーク操作中は終了検知を無効にする
        if (isSeekingRef.current) {
          console.log('Skipping track end check (seeking)');
          return;
        }
        
        // 位置が0で、前回の位置が大きかった場合、曲が終了したとみなす
        if (state.position === 0 && lastPositionRef.current > 50) { // 閾値を50msにさらに緩和
          console.log('Track ended detected by timer check');
          console.log('Current position:', state.position, 'Last position:', lastPositionRef.current);
          
          // 状態をリセット
          lastPositionRef.current = 0;
          currentTrackIdRef.current = null;
          
          // タイマーをクリア
          if (trackEndCheckTimerRef.current) {
            clearTimeout(trackEndCheckTimerRef.current);
            trackEndCheckTimerRef.current = null;
          }
          
          if (playNext) {
            console.log('Calling playNext from timer check...');
            setTimeout(() => {
              console.log('Executing playNext from timer check...');
              try {
                // PlayerContextの状態を明示的に更新してからplayNextを呼び出す
                if (currentTrack && currentTrackIndex >= 0) {
                  console.log('Updating PlayerContext state before playNext (timer check)...');
                  updateCurrentTrackState(currentTrack, currentTrackIndex);
                }
                
                playNext();
                console.log('playNext executed successfully from timer check');
              } catch (error) {
                console.error('Error executing playNext from timer check:', error);
              }
            }, 200);
          }
        }
      } catch (error) {
        console.error('Error in track end check:', error);
      }
    }, 3000); // 3秒後にチェック（より長い時間に延長）
  }, [isReady, playNext, currentTrack, currentTrackIndex, updateCurrentTrackState]);

  // 新しい曲を再生する関数
  const playNewTrack = useCallback(async (newTrackId) => {
    console.log('=== PLAYNEWTRACK START ===');
    console.log('playNewTrack called with ID:', newTrackId);
    
    if (!isReady || !deviceId) {
      console.error('playNewTrack failed: Player not ready or no device ID.');
      return;
    }

    try {
      // Step 1: Transfer playback to this device to ensure it's active
      console.log(`Transferring playback to device ${deviceId}...`);
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
        console.error('Failed to transfer playback:', { status: transferResponse.status, body: errorBody });
        // Don't stop here, as playback might work anyway. We'll proceed to the play command.
      } else {
        console.log('Playback transferred successfully.');
      }
      
      // 前の曲を確実に停止するため、より長い待機時間を設定
      await new Promise(resolve => setTimeout(resolve, 500));

      // 前の曲を確実に停止するため、pause()を呼び出す
      if (playerRef.current) {
        try {
          console.log('Pausing current playback before starting new track...');
          await playerRef.current.pause();
          // pause()の後に少し待機して確実に停止させる
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.warn('Failed to pause current playback:', error);
        }
      }

      // 前の曲を完全にクリアするため、一度停止状態にしてから新しい曲を開始
      console.log('Clearing previous track completely...');
      const clearResponse = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (clearResponse.ok) {
        console.log('Previous track cleared successfully');
        // クリア後に少し待機
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.warn('Failed to clear previous track:', clearResponse.status);
      }

      // さらに強力なクリア処理：デバイスを一度リセット
      console.log('Performing device reset to clear all track information...');
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
        console.log('Device reset successful');
        // リセット後に待機
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.warn('Failed to reset device:', deviceResetResponse.status);
      }

      // さらに強力なクリア処理：デバイスを一度リセット
      console.log('Performing device reset to clear all track information...');
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
        console.log('Device reset successful (second attempt)');
        // リセット後に待機
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.warn('Failed to reset device (second attempt):', deviceResetResponse2.status);
      }

      // Step 2: Play the new track
      console.log(`Requesting playback for new track: ${newTrackId} on device ${deviceId}`);
      
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
        console.log(`=== PLAYBACK REQUEST SUCCESSFUL ===`);
        console.log(`Playback request successful for new track: ${newTrackId}`);
        
        // 状態を完全にリセット
        currentTrackIdRef.current = null;
        lastPositionRef.current = 0;
        isNewTrackSelectedRef.current = true;
        
        // 少し待機してから新しい曲のIDを設定
        await new Promise(resolve => setTimeout(resolve, 200));
        currentTrackIdRef.current = newTrackId;
        lastTrackIdRef.current = newTrackId;
        
        // 新しい曲が開始された時に内部状態をリセット
        console.log('Resetting SpotifyPlayer internal state for new track');
        
        // Update PlayerContext to ensure the rest of the app knows about the new track.
        const trackIndex = trackList.findIndex(track => (track?.spotifyTrackId || track?.id) === newTrackId);
        if (trackIndex !== -1) {
          console.log(`Found track ${newTrackId} in trackList at index ${trackIndex}. Updating context.`);
          updateCurrentTrackState(trackList[trackIndex], trackIndex);
        } else {
          console.warn(`Track ${newTrackId} not found in trackList. Context not updated.`);
        }

        // Set protection timer to avoid false end-detection
        setTimeout(() => {
          isNewTrackSelectedRef.current = false;
          console.log('New track selection protection disabled for:', newTrackId);
        }, 8000); // 保護時間を8秒に延長して前の曲が一瞬鳴る問題を完全に防止

      } else {
        const errorBody = await resetResponse.json().catch(() => ({}));
        console.error('Failed to start playback for new track:', { status: resetResponse.status, body: errorBody });
      }

    } catch (error) {
      console.error('Error during playNewTrack execution:', error);
    }
    console.log('=== PLAYNEWTRACK END ===');
  }, [isReady, deviceId, accessToken, trackList, updateCurrentTrackState]);

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
        console.error('Error updating position:', error);
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
    console.log('SpotifyPlayer: accessToken prop changed:', { 
      accessToken: accessToken ? `(length: ${accessToken.length})` : 'null' 
    });
    if (!accessToken) {
      console.log('SpotifyPlayer: No access token available');
      return;
    }

    console.log('SpotifyPlayer: Initializing with access token');

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (playerRef.current) {
        console.log('SpotifyPlayer: Player already exists, skipping initialization');
        return;
      }

      console.log("Spotify SDK Ready. Initializing Player.");
      const player = new window.Spotify.Player({
          name: 'Music8 Web Player',
          getOAuthToken: cb => { 
            console.log('SpotifyPlayer: Providing OAuth token');
            cb(accessToken); 
          },
          volume: 0.15
      });
      
      playerRef.current = player;
      setPlayerStateListeners(player);
      
      player.connect().then(success => {
          if (success) {
            console.log('The Spotify player has been connected successfully!');
          } else {
            console.error('Failed to connect Spotify player');
          }
      }).catch(error => {
        console.error('Error connecting Spotify player:', error);
      });
    };

    const scriptId = 'spotify-sdk-script';
    
    if (!document.getElementById(scriptId)) {
      console.log('SpotifyPlayer: Loading Spotify SDK script');
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onload = () => {
        console.log('SpotifyPlayer: SDK script loaded');
        if (window.Spotify) {
          window.onSpotifyWebPlaybackSDKReady();
        }
      };
      script.onerror = (error) => {
        console.error('SpotifyPlayer: Failed to load SDK script:', error);
      };
      document.body.appendChild(script);
    } else {
      console.log('SpotifyPlayer: SDK script already exists');
      if (window.Spotify) {
        window.onSpotifyWebPlaybackSDKReady();
      }
    }

    return () => {
      console.log('SpotifyPlayer: Cleaning up');
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
        console.log(`Track ID changed from ${lastTrackIdRef.current || 'null'} to ${trackId}. Starting new track.`);
        playNewTrack(trackId);
      }
    } else {
      console.log('Conditions for starting a new track not met:', { isReady, deviceId, trackId });
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
        console.error('Error toggling player state:', e);
      }
    };

    togglePlayerState();
  }, [isPlaying, isReady]); // isReady is needed to ensure playerRef.current is valid

  return null;
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer; 