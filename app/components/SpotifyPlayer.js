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
      player.setVolume(volume).catch(() => {});
    });

    player.addListener('not_ready', ({ device_id }) => {
      setDeviceId(null);
      setIsReady(false);
    });

    player.addListener('player_state_changed', (state) => {
      if (!state) {
        return;
      }
      
      if (isNewTrackSelectedRef.current) {
        if (state.track_window.current_track) {
          updatePlaybackState(state.duration, state.position);
          lastPositionRef.current = state.position;
        }
        return;
      }
      
      if (state.track_window.current_track) {
        updatePlaybackState(state.duration, state.position);
      }
      
      if (isSeekingRef.current) {
        return;
      }
      
      const currentPlayingTrackId = state.track_window.current_track?.id;
      const expectedTrackId = currentTrackIdRef.current;

      if (expectedTrackId && currentPlayingTrackId && currentPlayingTrackId !== expectedTrackId) {
        const expectedTrackInPrevious = state.track_window.previous_tracks.find(t => t.id === expectedTrackId);
        if (expectedTrackInPrevious && lastPositionRef.current > 1000) {
          currentTrackIdRef.current = null;
          lastPositionRef.current = 0;
          isNewTrackSelectedRef.current = false;
          
          if (trackEndCheckTimerRef.current) {
            clearTimeout(trackEndCheckTimerRef.current);
            trackEndCheckTimerRef.current = null;
          }
          
          if(playNext) {
            setTimeout(() => {
              try {
                playNext();
              } catch (error) {
              }
            }, 200);
          }
          return;
        }
        
        if (!expectedTrackInPrevious && lastPositionRef.current > 1000) {
          const forcePlayExpectedTrack = async () => {
            try {
              currentTrackIdRef.current = null;
              lastPositionRef.current = 0;
              isNewTrackSelectedRef.current = true;

              if (!deviceId) {
                return;
              }
              
              if (playerRef.current) {
                try {
                  await playerRef.current.pause();
                  await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                }
              }
              
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
              } else {
              }

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
              } else {
              }

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
              } else {
              }

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
                }, 8000);
              } else {
              }
            } catch (error) {
            }
          };
          
          forcePlayExpectedTrack();
          return;
        }
      }
      
      const trackJustEnded = (
        expectedTrackId && 
        state.paused &&
        state.position === 0 &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        !state.track_window.current_track
      );

      const spotifyAutoNext = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 50 &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId
      );

      const trackFullyEnded = (
        expectedTrackId &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId &&
        currentPlayingTrackId &&
        lastPositionRef.current > 50
      );

      const trackCompletelyEnded = (
        expectedTrackId &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId) &&
        currentPlayingTrackId !== expectedTrackId &&
        currentPlayingTrackId &&
        state.position > 0 &&
        lastPositionRef.current > 50
      );

      const trackLoopEnded = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 50 &&
        currentPlayingTrackId === expectedTrackId
      );

      const simpleTrackEnded = (
        expectedTrackId &&
        state.position === 0 &&
        lastPositionRef.current > 50 &&
        state.track_window.previous_tracks.find(t => t.id === expectedTrackId)
      );

      if (trackJustEnded || spotifyAutoNext || trackFullyEnded || trackCompletelyEnded || trackLoopEnded || simpleTrackEnded) {
        currentTrackIdRef.current = null;
        lastPositionRef.current = 0;
        isNewTrackSelectedRef.current = false;
        
        if (trackEndCheckTimerRef.current) {
          clearTimeout(trackEndCheckTimerRef.current);
          trackEndCheckTimerRef.current = null;
        }
        
        if(playNext) {
          setTimeout(() => {
            try {
              if (currentTrack && currentTrackIndex >= 0) {
                updateCurrentTrackState(currentTrack, currentTrackIndex);
              }
              
              playNext();
            } catch (error) {
            }
          }, 100);
        }
      } else {
        lastPositionRef.current = state.position;
      }
    });

    player.addListener('initialization_error', ({ message }) => console.error('Initialization Error:', message));
    player.addListener('authentication_error', ({ message }) => console.error('Authentication Error:', message));
    player.addListener('account_error', ({ message }) => console.error('Account Error:', message));
    player.addListener('playback_error', ({ message }) => console.error('Playback Error:', message));
  }

  const startTrackEndCheck = useCallback(() => {
    if (trackEndCheckTimerRef.current) {
      clearTimeout(trackEndCheckTimerRef.current);
    }
    
    trackEndCheckTimerRef.current = setTimeout(async () => {
      if (!playerRef.current || !isReady) return;
      
      try {
        const state = await playerRef.current.getCurrentState();
        if (!state) return;
        
        if (isNewTrackSelectedRef.current) {
          return;
        }
        
        if (isSeekingRef.current) {
          return;
        }
        
        if (state.position === 0 && lastPositionRef.current > 50) {
          console.log('Track ended detected by timer check');
          console.log('Current position:', state.position, 'Last position:', lastPositionRef.current);
          
          lastPositionRef.current = 0;
          currentTrackIdRef.current = null;
          
          if (trackEndCheckTimerRef.current) {
            clearTimeout(trackEndCheckTimerRef.current);
            trackEndCheckTimerRef.current = null;
          }
          
          if (playNext) {
            setTimeout(() => {
              try {
                if (currentTrack && currentTrackIndex >= 0) {
                  updateCurrentTrackState(currentTrack, currentTrackIndex);
                }
                
                playNext();
              } catch (error) {
              }
            }, 200);
          }
        }
      } catch (error) {
      }
    }, 3000);
  }, [isReady, playNext, currentTrack, currentTrackIndex, updateCurrentTrackState]);

  const playNewTrack = useCallback(async (newTrackId) => {
    currentTrackIdRef.current = null;
    lastPositionRef.current = 0;
    isNewTrackSelectedRef.current = true;

    if (!isReady || !deviceId) {
      return;
    }

    try {
      const pauseResponse = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!pauseResponse.ok) {
        // pause失敗は無視（既に停止している可能性）
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

      const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          uris: [`spotify:track:${newTrackId}`],
          position_ms: 0
        }),
      });

      if (playResponse.ok) {
        currentTrackIdRef.current = newTrackId;
        lastPositionRef.current = 0;
        isNewTrackSelectedRef.current = true;
        
        setTimeout(() => {
          isNewTrackSelectedRef.current = false;
        }, 5000);
      } else {
        const errorBody = await playResponse.json().catch(() => ({}));
        console.error('Failed to start playback for new track:', { status: playResponse.status, body: errorBody });
      }
    } catch (error) {
      console.error('Error during playNewTrack execution:', error);
    }
  }, [isReady, deviceId, accessToken, trackList, updateCurrentTrackState]);

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
      }
    };

    if (isPlaying) {
      positionUpdateIntervalRef.current = setInterval(updatePosition, 1000);
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
      });

      // 初期ボリュームを即時反映
      player.setVolume(volume).catch(() => {});

      setPlayerStateListeners(player);

      playerRef.current = player;

      player.connect().then(success => {
        if (success) {
          // 接続成功
        } else {
          console.error('Failed to connect Spotify player');
        }
      }).catch(error => {
        console.error('Error connecting Spotify player:', error);
      });
    };

    if (window.Spotify) {
      window.onSpotifyWebPlaybackSDKReady();
    } else {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onload = () => {
        if (window.Spotify) {
          window.onSpotifyWebPlaybackSDKReady();
        }
      };
      script.onerror = (error) => {
        console.error('SpotifyPlayer: Failed to load SDK script:', error);
      };
      document.body.appendChild(script);
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
    };
  }, [accessToken, volume]);

  useEffect(() => {
    if (isReady && deviceId && trackId) {
      if (trackId !== lastTrackIdRef.current) {
        playNewTrack(trackId);
        lastTrackIdRef.current = trackId;
      }
    }
  }, [trackId, deviceId, isReady, playNewTrack]);

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
      }
    };

    togglePlayerState();
  }, [isPlaying, isReady]);

  return null;
});

SpotifyPlayer.displayName = 'SpotifyPlayer';

export default SpotifyPlayer; 