'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { usePlayer } from './PlayerContext';

const SpotifyPlayer = forwardRef(({ accessToken, trackId, autoPlay }, ref) => {
  console.log('SpotifyPlayer: Component rendered with props:', {
    hasAccessToken: !!accessToken,
    trackId,
    autoPlay
  });

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
    // シーク機能を外部から呼び出せるようにする
    seekTo: (position) => {
      if (playerRef.current && isReady) {
        // 既にシーク中の場合は無視
        if (isSeekingRef.current) {
          console.log('Seek already in progress, ignoring new seek request');
          return;
        }
        
        console.log('Seeking to position:', position);
        isSeekingRef.current = true;
        
        // 既存のタイマーをクリア
        if (seekProtectionTimerRef.current) {
          clearTimeout(seekProtectionTimerRef.current);
        }
        
        playerRef.current.seek(position);
        console.log('Seek completed, lastPositionRef remains:', lastPositionRef.current);
        
        // シーク操作後、2秒間は終了検知を無効にする
        seekProtectionTimerRef.current = setTimeout(() => {
          isSeekingRef.current = false;
          console.log('Seek protection disabled');
        }, 2000);
      }
    },
    // 音量制御機能を外部から呼び出せるようにする
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
        console.log('SpotifyPlayer: Player state is null');
        return;
      }
      
      console.log('Player state changed:', {
        paused: state.paused,
        position: state.position,
        currentTrack: state.track_window.current_track?.id,
        previousTracks: state.track_window.previous_tracks.length,
        nextTracks: state.track_window.next_tracks.length,
        lastPosition: lastPositionRef.current,
        isNewTrackSelected: isNewTrackSelectedRef.current,
        currentTrackIdRef: currentTrackIdRef.current,
        hasCurrentTrack: !!state.track_window.current_track
      });
      
      // 再生時間と位置を更新
      if (state.track_window.current_track) {
        updatePlaybackState(state.duration, state.position);
      }
      
      // 新しい曲が選択された直後は終了検知を無効にする
      if (isNewTrackSelectedRef.current) {
        console.log('Skipping track end detection (new track selected)');
        lastPositionRef.current = state.position;
        return;
      }
      
      // シーク操作中は終了検知を無効にする
      if (isSeekingRef.current) {
        console.log('Skipping track end detection (seeking)');
        lastPositionRef.current = state.position;
        return;
      }
      
      // 現在再生中の曲のIDを確認
      const currentPlayingTrackId = state.track_window.current_track?.id;
      const expectedTrackId = currentTrackIdRef.current;
      
      console.log('Track ID comparison:', {
        currentPlayingTrackId,
        expectedTrackId,
        isMatch: currentPlayingTrackId === expectedTrackId
      });

      // 期待している曲IDと実際の曲IDが一致しない場合の処理
      if (expectedTrackId && currentPlayingTrackId && currentPlayingTrackId !== expectedTrackId) {
        console.log('Track ID mismatch detected. Spotify may have switched tracks automatically.');
        
        // 期待している曲が前の曲リストにある場合、その曲が終了したとみなす
        const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
        if (expectedTrackInPrevious && lastPositionRef.current > 500) {
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
        if (!expectedTrackInPrevious && lastPositionRef.current > 500) {
          console.log(`Expected track ${expectedTrackId} not found in previous tracks. Forcing playback of expected track.`);
          
          // 期待している曲を強制的に再生
          const forcePlayExpectedTrack = async () => {
            try {
              console.log(`Forcing playback of expected track: ${expectedTrackId} on device: ${deviceId}`);
              if (!deviceId) {
                console.error('No active device ID to force playback.');
                return;
              }
              const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                body: JSON.stringify({ uris: [`spotify:track:${expectedTrackId}`] }),
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
                
                // 5秒後に新しい曲の終了検知を有効にする（より長い時間に延長）
                setTimeout(() => {
                  isNewTrackSelectedRef.current = false;
                  console.log('Track end detection enabled for forced track:', currentTrackIdRef.current);
                }, 5000);
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

      // 位置ベースの終了検知（シーク操作後も動作するように改善）
      const positionBasedEnd = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 500 && // 閾値を下げてシーク操作後も検知できるようにする
        currentPlayingTrackId === expectedTrackId
      );

      // より緩い条件での終了検知
      const trackEnded = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 500 && // 閾値を下げる
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId)
      );

      // 曲が実際に終了したかどうかを判定（より確実な方法）
      const actualTrackEnded = (
        expectedTrackId &&
        state.position === 0 &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId
      );

      // 新しい終了検知：位置が0で、前回の位置が大きかった場合（Spotifyが自動的に次の曲に切り替わった場合も含む）
      const spotifyAutoNext = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 500 &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId
      );

      console.log('Track end detection:', {
        trackJustEnded,
        positionBasedEnd,
        trackEnded,
        actualTrackEnded,
        spotifyAutoNext,
        currentTrackId: expectedTrackId,
        lastPosition: lastPositionRef.current,
        hasPreviousTrack: state.track_window.previous_tracks.find(t => t.id === expectedTrackId) ? true : false,
        currentTrackInPrevious: state.track_window.previous_tracks.find(t => t.id === expectedTrackId) ? true : false
      });

      if (trackJustEnded || positionBasedEnd || trackEnded || actualTrackEnded || spotifyAutoNext) {
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
              console.log('About to call playNext function...');
              playNext();
              console.log('playNext executed successfully');
            } catch (error) {
              console.error('Error executing playNext:', error);
            }
          }, 200); // 遅延時間を短縮
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
        
        console.log('Track end check timer:', {
          position: state.position,
          lastPosition: lastPositionRef.current,
          currentTrackId: currentTrackIdRef.current,
          isNewTrackSelected: isNewTrackSelectedRef.current,
          expectedTrackId: currentTrackIdRef.current
        });
        
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
        if (state.position === 0 && lastPositionRef.current > 500) {
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
  }, [isReady, playNext]);

  // 新しい曲を再生する関数
  const playNewTrack = useCallback(async (newTrackId) => {
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
      
      // A short delay can help ensure the player is ready after transfer.
      await new Promise(resolve => setTimeout(resolve, 250));

      // Step 2: Play the new track
      console.log(`Requesting playback for new track: ${newTrackId} on device ${deviceId}`);
      const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [`spotify:track:${newTrackId}`] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (playResponse.ok) {
        console.log(`Playback request successful for new track: ${newTrackId}`);
        // Update state references
        currentTrackIdRef.current = newTrackId;
        lastTrackIdRef.current = newTrackId;
        lastPositionRef.current = 0;
        isNewTrackSelectedRef.current = true;
        
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
        }, 5000);

      } else {
        const errorBody = await playResponse.json().catch(() => ({}));
        console.error('Failed to start playback for new track:', { status: playResponse.status, body: errorBody });
      }

    } catch (error) {
      console.error('Error during playNewTrack execution:', error);
    }
  }, [isReady, deviceId, accessToken, trackList, updateCurrentTrackState]);

  // Effect to handle play/pause from the context
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    playerRef.current.getCurrentState().then(state => {
      if (!state) return;
      
      if (isPlaying && !state.paused) return; // Already playing
      if (!isPlaying && state.paused) return; // Already paused

      if (isPlaying) {
        playerRef.current.resume().then(() => console.log("Playback resumed."));
      } else {
        playerRef.current.pause().then(() => console.log("Playback paused."));
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
            console.log('Skipping position-based end detection (new track selected)');
            lastPositionRef.current = state.position;
            return;
          }
          
          // シーク操作中は終了検知を無効にする
          if (isSeekingRef.current) {
            console.log('Skipping track end detection (seeking)');
            lastPositionRef.current = state.position;
            return;
          }
          
          // 曲の終了を検知（位置が0に戻り、前回の位置が大きかった場合）
          if (state.position === 0 && lastPositionRef.current > 500) { // 閾値を下げる
            console.log('Track ended detected by position reset');
            console.log('Current position:', state.position, 'Last position:', lastPositionRef.current);
            lastPositionRef.current = 0;
            if (playNext) {
              console.log('Calling playNext from position update...');
              setTimeout(() => {
                console.log('Executing playNext...');
                try {
                  playNext();
                  console.log('playNext executed successfully from position update');
                } catch (error) {
                  console.error('Error executing playNext from position update:', error);
                }
              }, 200);
            } else {
              console.log('playNext function is not available');
            }
          } else if (state && state.position === 0 && lastPositionRef.current > 500) { // 閾値を下げる
            // 現在の曲が存在しないが、位置が0で前回の位置が大きかった場合
            console.log('Track ended detected by position reset (no current track)');
            console.log('Current position:', state.position, 'Last position:', lastPositionRef.current);
            lastPositionRef.current = 0;
            if (playNext) {
              console.log('Calling playNext from position update (no current track)...');
              setTimeout(() => {
                console.log('Executing playNext (no current track)...');
                try {
                  playNext();
                  console.log('playNext executed successfully from position update (no current track)');
                } catch (error) {
                  console.error('Error executing playNext from position update (no current track):', error);
                }
              }, 200);
            } else {
              console.log('playNext function is not available (no current track)');
            }
          } else if (state && state.position === 0 && lastPositionRef.current > 500 && currentTrackIdRef.current) {
            // Spotifyが自動的に次の曲に切り替わった場合の検知
            const expectedTrackId = currentTrackIdRef.current;
            const currentPlayingTrackId = state.track_window.current_track?.id;
            
            if (currentPlayingTrackId !== expectedTrackId && 
                state.track_window.previous_tracks.find(t => t.id === expectedTrackId)) {
              console.log('Track ended detected by Spotify auto-next');
              console.log('Expected track:', expectedTrackId, 'Current track:', currentPlayingTrackId);
              lastPositionRef.current = 0;
              if (playNext) {
                console.log('Calling playNext from position update (Spotify auto-next)...');
                setTimeout(() => {
                  console.log('Executing playNext (Spotify auto-next)...');
                  try {
                    playNext();
                    console.log('playNext executed successfully from position update (Spotify auto-next)');
                  } catch (error) {
                    console.error('Error executing playNext from position update (Spotify auto-next):', error);
                  }
                }, 200);
              } else {
                console.log('playNext function is not available (Spotify auto-next)');
              }
            }
          } else {
            lastPositionRef.current = state.position;
          }
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
          console.log('Could not get player state to toggle play/pause.');
          return;
        }

        if (isPlaying && state.paused) {
          console.log('Context isPlaying=true, player is paused. Resuming...');
          await playerRef.current.resume();
        } else if (!isPlaying && !state.paused) {
          console.log('Context isPlaying=false, player is playing. Pausing...');
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