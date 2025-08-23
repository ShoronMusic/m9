'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const formatTime = (milliseconds) => {
  if (!milliseconds || isNaN(milliseconds)) return '0:00';
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const SongDetailSpotifyPlayer = ({ accessToken, songData }) => {
  const { data: session } = useSession();
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.3);
  const [error, setError] = useState(null);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'track', 'context'
  
  const playerRef = useRef(null);
  const hasPlaybackStartedRef = useRef(false);
  const intervalRef = useRef(null);
  const playStartTimeRef = useRef(null);
  const playDurationRef = useRef(0);
  const hasRecordedRef = useRef(false); // 重複記録を防ぐフラグ

  // 視聴履歴記録関数
  const recordPlayHistory = async (completed = false) => {
    console.log('🎯 recordPlayHistory called:', { completed, session: session?.user, songData });
    
    if (!session?.user?.id || !songData) {
      console.log('❌ recordPlayHistory: Missing session or songData:', { 
        hasSession: !!session, 
        hasUserId: !!session?.user?.id, 
        hasSongData: !!songData 
      });
      return;
    }
    
    const playDuration = playDurationRef.current;
    console.log('⏱️ Play duration:', playDuration, 'ms');
    
    // 30秒未満は記録しない（ミリ秒単位）
    if (playDuration < 30000) {
      console.log('⏭️ Skipping record: duration too short (< 30 seconds)');
      return;
    }
    
    // 重複記録を防ぐ（完了時は除く）
    if (hasRecordedRef.current && !completed) {
      console.log('⏭️ Skipping record: already recorded for this session');
      return;
    }
    
    try {
      const requestBody = {
        track_id: songData.spotifyTrackId,
        song_id: songData.id,
        play_duration: Math.round(playDuration / 1000), // 秒単位に変換
        completed: completed,
        source: 'song-detail',
        artist_name: songData.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        track_title: songData.title || 'Unknown Track',
        is_favorite: false,
        style_id: songData.styles?.[0] || null,
        style_name: songData.styles?.[0] ? getStyleName(songData.styles[0]) : null,
        genre_id: songData.genres?.[0]?.term_id || null,
        genre_name: songData.genres?.[0]?.name || null
      };
      
      console.log('📤 Sending play history request:', requestBody);
      
      const response = await fetch('/api/play-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ 視聴履歴を記録しました:', {
          track: songData.title,
          duration: playDuration,
          completed: completed,
          response: responseData
        });
        
        // 記録成功フラグを設定
        if (!completed) {
          hasRecordedRef.current = true;
        }
      } else {
        const errorData = await response.text();
        console.error('❌ 視聴履歴の記録に失敗しました:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
      }
    } catch (error) {
      console.error('❌ 視聴履歴記録エラー:', error);
    }
  };

  // スタイル名を取得するヘルパー関数
  const getStyleName = (styleId) => {
    const styleMap = {
      2844: 'Pop',
      4686: 'Dance',
      2845: 'Alternative',
      2846: 'Electronica',
      2847: 'R&B',
      2848: 'Hip-Hop',
      6703: 'Rock',
      2849: 'Metal',
      2873: 'Others'
    };
    return styleMap[styleId] || 'Unknown';
  };

  useEffect(() => {
    if (!accessToken || !songData?.spotifyTrackId) {
      setError('アクセストークンまたはSpotify IDがありません');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Song Detail Player',
        getOAuthToken: cb => { cb(accessToken); }
      });

      player.addListener('ready', async ({ device_id }) => {
        console.log('Song Detail Player ready with Device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setError(null);
        player.setVolume(volume).catch(e => console.error("Could not set volume", e));
        
        // プレーヤー準備完了後、現在の状態を取得して時間を初期化
        try {
          const currentState = await player.getCurrentState();
          if (currentState) {
            console.log('🎯 Initial player state:', {
              position: currentState.position,
              duration: currentState.duration,
              paused: currentState.paused
            });
            
            // 現在の再生状態に基づいて時間を設定
            setPosition(currentState.position || 0);
            setDuration(currentState.duration || 0);
            setIsPlaying(!currentState.paused);
            
            // 再生中の場合は開始時刻を設定
            if (!currentState.paused) {
              playStartTimeRef.current = Date.now() - (currentState.position || 0);
              playDurationRef.current = currentState.position || 0;
              console.log('▶️ Player was already playing, setting start time:', playStartTimeRef.current);
            }
          }
        } catch (error) {
          console.log('⚠️ Could not get initial player state:', error);
        }
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Song Detail Player device ID has gone offline', device_id);
        setDeviceId(null);
        setIsReady(false);
      });

      player.addListener('initialization_error', ({ message }) => {
        console.error('Song Detail Player initialization error:', message);
        setError(`初期化エラー: ${message}`);
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('Song Detail Player authentication error:', message);
        setError(`認証エラー: ${message}`);
      });

      player.addListener('account_error', ({ message }) => {
        console.error('Song Detail Player account error:', message);
        setError(`アカウントエラー: ${message}`);
      });

      player.addListener('playback_error', ({ message }) => {
        console.error('Song Detail Player playback error:', message);
        setError(`再生エラー: ${message}`);
      });

      // 曲が終了した時の処理
      player.addListener('player_state_changed', (state) => {
        console.log('🎵 Player state changed:', { 
          hasState: !!state, 
          isPlaying: isPlaying,
          state: state ? { paused: state.paused, position: state.position, duration: state.duration } : null
        });
        
        if (!state) {
          // 曲が終了した場合
          if (playStartTimeRef.current && isPlaying) {
            const endTime = Date.now();
            playDurationRef.current = endTime - playStartTimeRef.current;
            console.log('🎬 Track ended, recording completion:', { duration: playDurationRef.current });
            recordPlayHistory(true); // 完了として記録
            playStartTimeRef.current = null;
            hasRecordedRef.current = false; // リセット
          }
          return;
        }
        
        const wasPlaying = isPlaying;
        const newIsPlaying = !state.paused;
        
        console.log('🔄 Playback state update:', { wasPlaying, newIsPlaying, position: state.position, duration: state.duration });
        
        // 再生開始時（一元化）
        if (!wasPlaying && newIsPlaying) {
          // 初回再生開始時のみ設定
          if (!playStartTimeRef.current) {
            playStartTimeRef.current = Date.now();
            playDurationRef.current = 0;
            hasRecordedRef.current = false; // リセット
            console.log('▶️ Playback started, recording start time:', playStartTimeRef.current);
          }
        }
        
        // 再生停止時
        if (wasPlaying && !newIsPlaying) {
          if (playStartTimeRef.current) {
            const endTime = Date.now();
            playDurationRef.current = endTime - playStartTimeRef.current;
            console.log('⏸️ Playback paused, recording interruption:', { duration: playDurationRef.current });
            
            // 30秒以上再生した場合のみ記録
            if (playDurationRef.current >= 30000) {
              recordPlayHistory(false);
            } else {
              console.log('⏭️ Skipping record: duration too short for pause:', playDurationRef.current);
            }
          }
        }
        
        // 状態を更新（最後に実行）
        setIsPlaying(newIsPlaying);
        
        // 時間の更新（Spotifyプレーヤーの状態変更時）
        if (state.position !== undefined) {
          // シーク操作後の位置変更を検出
          if (playStartTimeRef.current && Math.abs(state.position - position) > 1000) {
            // 大きな位置変更（シーク操作）を検出
            const currentTime = Date.now();
            const newStartTime = currentTime - state.position;
            playStartTimeRef.current = newStartTime;
            
            console.log('🎯 Position change detected (likely seek):', {
              oldPosition: position,
              newPosition: state.position,
              oldStartTime: playStartTimeRef.current,
              newStartTime: newStartTime
            });
          }
          
          setPosition(state.position);
        }
        if (state.duration !== undefined) {
          setDuration(state.duration);
        }
        
        // デバッグ用：時間更新の詳細ログ
        console.log('⏱️ Time update from player state:', {
          position: state.position,
          duration: state.duration,
          newPosition: state.position !== undefined ? state.position : 'unchanged',
          newDuration: state.duration !== undefined ? state.duration : 'unchanged'
        });
      });

      player.connect();
      playerRef.current = player;
    };

    return () => {
      if (playerRef.current) {
        // 再生中の場合、視聴履歴を記録
        if (playStartTimeRef.current && isPlaying) {
          const endTime = Date.now();
          playDurationRef.current = endTime - playStartTimeRef.current;
          console.log('🚪 Component unmounting, recording interruption:', { duration: playDurationRef.current });
          recordPlayHistory(false); // 中断として記録
        }
        playerRef.current.disconnect();
      }
    };
  }, [accessToken, songData?.spotifyTrackId]);

  useEffect(() => {
    if (isPlaying) {
      // 時間更新と視聴履歴記録の両方を実行
      intervalRef.current = setInterval(async () => {
        if (playerRef.current) {
          try {
            // 現在のプレーヤー状態を取得して時間を更新
            const state = await playerRef.current.getCurrentState();
            if (state) {
              // 時間の更新（Spotifyプレーヤーの実際の状態に基づく）
              if (state.position !== undefined) {
                setPosition(state.position);
              }
              if (state.duration !== undefined) {
                setDuration(state.duration);
              }
              
              // 視聴履歴記録のための30秒チェック
              if (playStartTimeRef.current) {
                const currentTime = Date.now();
                playDurationRef.current = currentTime - playStartTimeRef.current;
                
                // 30秒以上再生した場合、視聴履歴を記録（重複防止のため一度だけ）
                if (playDurationRef.current >= 30000 && !hasRecordedRef.current) {
                  console.log('⏱️ 30秒以上再生中、視聴履歴を記録:', { duration: playDurationRef.current });
                  recordPlayHistory(false);
                  hasRecordedRef.current = true; // 重複記録を防ぐ
                }
                
                // デバッグ用：再生時間を定期的に表示（10秒ごと）
                if (playDurationRef.current % 10000 < 1000) {
                  console.log('⏱️ Current play duration:', playDurationRef.current, 'ms');
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Error getting player state in interval:', error);
          }
        }
      }, 100); // 100ミリ秒ごとにチェック（滑らかな時間更新と視聴履歴記録）
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [isPlaying]);

  const playTrack = async (deviceId, trackId) => {
    if (!isReady || !deviceId) {
      console.log('Player not ready or no device ID');
      return;
    }
    
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody?.error?.message || `HTTP error! status: ${response.status}`);
      }
      
      // 再生開始時の時間初期化
      setPosition(0);
      setDuration(0);
      setIsPlaying(true);
      setError(null);
      
      console.log('🎯 Track play initiated, time reset to 0:00');
    } catch (e) {
      console.error('Failed to play track:', e);
      setError(`曲の再生に失敗しました: ${e.message}`);
    }
  };

  const togglePlay = async () => {
    if (!isReady || !playerRef.current) return;
    
    try {
      if (hasPlaybackStartedRef.current === false) {
        // 初回再生開始
        console.log('🎯 First time play, starting track...');
        await playTrack(deviceId, songData.spotifyTrackId);
        hasPlaybackStartedRef.current = true;
        
        // 再生開始時刻は player_state_changed で設定されるため、ここでは設定しない
        console.log('▶️ First time play initiated, start time will be set by player_state_changed');
      } else {
        // 再生/一時停止の切り替え
        console.log('🔄 Toggling play/pause state');
        
        // 現在の状態を取得して適切な操作を実行
        const currentState = await playerRef.current.getCurrentState();
        if (currentState) {
          if (currentState.paused) {
            // 一時停止中なので再生
            await playerRef.current.resume();
            console.log('▶️ Resuming playback');
          } else {
            // 再生中なので一時停止
            await playerRef.current.pause();
            console.log('⏸️ Pausing playback');
          }
        } else {
          // 状態が取得できない場合は togglePlay を使用
          await playerRef.current.togglePlay();
          console.log('🔄 Using togglePlay fallback');
        }
      }
    } catch (e) {
      console.error('Failed to toggle play:', e);
      setError(`操作に失敗しました: ${e.message}`);
    }
  };

  const handleSeek = (newPosition) => {
    if (!isReady || !playerRef.current) return;
    
    const newPositionMs = Math.round(newPosition);
    console.log('🎯 Seek operation requested:', { oldPosition: position, newPosition: newPositionMs });
    
    // シーク操作時の時間管理を改善
    if (playStartTimeRef.current) {
      // 新しい位置に基づいて開始時刻を調整
      const currentTime = Date.now();
      const newStartTime = currentTime - newPositionMs;
      playStartTimeRef.current = newStartTime;
      
      console.log('🎯 Seek operation time adjustment:', {
        oldStartTime: playStartTimeRef.current,
        newStartTime: newStartTime
      });
    }
    
    // Spotifyプレーヤーにシーク命令を送信
    playerRef.current.seek(newPositionMs).then(() => {
      console.log('✅ Seek operation completed successfully');
      
      // シーク完了後、即座に位置を更新
      setPosition(newPositionMs);
    }).catch(e => {
      console.error('❌ Failed to seek:', e);
      setError(`シーク操作に失敗しました: ${e.message}`);
    });
  };

  const handleVolumeChange = (newVolume) => {
    if (!isReady || !playerRef.current) return;
    const volumeValue = parseFloat(newVolume);
    setVolume(volumeValue);
    playerRef.current.setVolume(volumeValue).catch(e => console.error("Failed to set volume", e));
  }

  const toggleRepeat = async () => {
    if (!isReady || !deviceId) return;
    const newRepeatMode = repeatMode === 'off' ? 'track' : 'off';
    try {
      await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${newRepeatMode}&device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      setRepeatMode(newRepeatMode);
    } catch (e) {
      console.error('Failed to set repeat mode:', e);
      setError(`リピート設定の変更に失敗しました: ${e.message}`);
    }
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fff0f0', 
        borderRadius: '8px', 
        margin: '20px 0',
        border: '1px solid #ffcccc'
      }}>
        <div style={{ color: '#dc3545', marginBottom: '10px', fontWeight: 'bold' }}>
          {error}
        </div>
        <div style={{ fontSize: '0.9em', color: '#6c757d' }}>
          Spotify Premiumアカウントでログインしているかご確認ください。問題が解決しない場合は、ページを再読み込みしてください。
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px', 
        margin: '20px 0',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>
          Spotifyプレーヤーを読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#000', 
      borderRadius: '8px', 
      margin: '20px 0',
      border: '1px solid #333'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <svg width="auto" height="30" viewBox="0 0 823.46 225.25" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>{`.cls-1{fill:#1ed760;stroke-width:0px;}`}</style>
            </defs>
            <path className="cls-1" d="m125.52,3.31C65.14.91,14.26,47.91,11.86,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C232.89,56.59,185.89,5.7,125.52,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"/>
            <path className="cls-1" d="m318.54,169.81c-18.87,0-35.07-6.53-41.84-13.95-.64-.73-.73-1.13-.73-2.02v-22.09c0-1.05.89-1.45,1.61-.56,8.14,10.16,25.48,18.46,39.67,18.46,11.29,0,18.87-3.06,18.87-13.06,0-5.97-2.82-9.84-18.22-14.19l-8.87-2.5c-20.56-5.8-33.06-12.66-33.06-32.33,0-17.41,16.12-32.73,43.05-32.73,13.22,0,26.36,4.11,33.94,9.76.64.48.89.97.89,1.85v20.08c0,1.37-1.13,1.77-2.18.89-6.13-5.08-17.98-11.93-32.01-11.93s-20.64,6.29-20.64,12.09c0,6.13,4.27,7.82,19.51,12.34l7.58,2.26c23.46,7.01,33.06,16.85,33.06,33.14,0,20.96-17.41,34.51-40.63,34.51Zm164.39-42.09c0-12.82,8.87-22.33,21.37-22.33s21.28,9.51,21.28,22.33-8.87,22.33-21.28,22.33-21.37-9.51-21.37-22.33Zm21.28,42.09c26.04,0,44.18-18.62,44.18-42.09s-18.14-42.09-44.18-42.09-44.1,18.46-44.1,42.09,17.98,42.09,44.1,42.09Zm157.22-89.01v6.77h-13.71c-.73,0-1.13.4-1.13,1.13v16.12c0,.73.4,1.13,1.13,1.13h13.71v60.79c0,.73.4,1.13,1.13,1.13h20.64c.73,0,1.13-.4,1.13-1.13v-60.79h17.66l25.64,55.71-13.79,30.31c-.4.89.08,1.29.89,1.29h22.01c.73,0,1.05-.16,1.37-.89l45.55-103.52c.32-.73-.08-1.29-.89-1.29h-20.64c-.73,0-1.05.16-1.37.89l-20.8,49.99-20.88-49.99c-.32-.73-.64-.89-1.37-.89h-33.38v-5.32c0-8.71,5.89-12.74,13.46-12.74,4.51,0,9.43,2.34,12.9,4.43.81.48,1.37-.08,1.05-.81l-7.26-17.33c-.24-.56-.56-.89-1.13-1.21-3.55-1.85-9.35-3.47-15-3.47-17.09,0-26.93,13.06-26.93,29.67Zm-243,88.52c20.64,0,35.47-17.82,35.47-41.76s-15-41.44-35.64-41.44c-15.32,0-24.19,9.35-29.35,18.7v-16.12c0-.73-.4-1.13-1.13-1.13h-20.24c-.73,0-1.13.4-1.13,1.13v103.44c0,.73.4,1.13,1.13,1.13h20.24c.73,0,1.13-.4,1.13-1.13v-41.36c5.16,9.35,13.87,18.54,29.51,18.54Zm172.21-.32c6.77,0,13.3-1.77,17.17-4.03.56-.32.64-.64.64-1.21v-15.32c0-.81-.4-1.05-1.13-.64-2.34,1.29-5.4,2.34-9.59,2.34-6.61,0-10.8-3.87-10.8-12.42v-31.77h20.16c.73,0,1.13-.4,1.13-1.13v-16.12c0-.73-.4-1.13-1.13-1.13h-20.16v-21.04c0-.89-.56-1.37-1.37-.73l-36.04,28.38c-.48.4-.64.81-.64,1.45v9.19c0,.73.4,1.13,1.13,1.13h14.03v35.15c0,19.03,10.96,27.9,26.61,27.9Zm23.3-105.29c0,7.26,5.64,12.74,13.38,12.74s13.54-5.48,13.54-12.74-5.64-12.74-13.54-12.74-13.38,5.48-13.38,12.74Zm3.14,104.17h20.64c.73,0,1.13-.4,1.13-1.13v-78.04c0-.73-.4-1.13-1.13-1.13h-20.64c-.73,0-1.13.4-1.13,1.13v78.04c0,.73.4,1.13,1.13,1.13Zm-228.65-40.47c3.71-12.42,12.25-21.93,23.86-21.93s18.7,8.38,18.7,22.09-7.66,22.25-18.7,22.25-20.16-10.64-23.86-22.41Z"/>
            <path className="cls-1" d="m810.1,92.31c-1.06-1.83-2.53-3.26-4.41-4.3-1.88-1.03-3.98-1.55-6.32-1.55s-4.44.52-6.32,1.55c-1.88,1.04-3.35,2.47-4.41,4.3-1.06,1.83-1.59,3.9-1.59,6.21s.53,4.34,1.59,6.17c1.06,1.83,2.53,3.26,4.41,4.3,1.88,1.04,3.98,1.55,6.32,1.55s4.44-.52,6.32-1.55,3.35-2.47,4.41-4.3c1.06-1.83,1.59-3.88,1.59-6.17s-.53-4.38-1.59-6.21Zm-1.93,11.36c-.86,1.52-2.06,2.7-3.59,3.56-1.53.85-3.27,1.28-5.2,1.28s-3.72-.43-5.25-1.28c-1.53-.85-2.72-2.04-3.57-3.56-.85-1.51-1.27-3.23-1.27-5.15s.42-3.63,1.27-5.13c.85-1.5,2.04-2.68,3.57-3.53,1.53-.85,3.28-1.28,5.25-1.28s3.67.43,5.2,1.28c1.53.85,2.73,2.04,3.59,3.56.86,1.52,1.29,3.23,1.29,5.15s-.43,3.59-1.29,5.11Z"/>
            <path className="cls-1" d="m803.56,98.29c.82-.6,1.23-1.4,1.23-2.39s-.4-1.83-1.2-2.43c-.8-.6-1.96-.9-3.48-.9h-5.36v11.2h2.59v-4.45h1.41l3.41,4.45h3.18l-3.73-4.72c.79-.15,1.46-.4,1.96-.77Zm-3.86-.99h-2.36v-2.74h2.45c.73,0,1.29.11,1.68.34.39.23.59.58.59,1.06,0,.45-.21.79-.61,1.01-.41.23-.99.34-1.75.34Z"/>
          </svg>
          <div>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>{songData?.title || 'Track'}</div>
              <div style={{ color: '#ccc', fontSize: '0.9em' }}>{songData?.artists?.map(a => a.name).join(', ') || 'Artist'}</div>
          </div>
        </div>
        <button 
          onClick={toggleRepeat}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px'
          }}
          title={repeatMode === 'track' ? 'リピート再生中' : 'リピート再生オフ'}
        >
          <img
            src="/icons/repeat-white.svg"
            alt="Repeat"
            style={{
              width: '20px',
              height: '20px',
              opacity: repeatMode === 'track' ? 1 : 0.4,
              transition: 'opacity 0.2s ease-in-out'
            }}
          />
        </button>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
        <button 
          onClick={togglePlay}
          disabled={!isReady}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#1DB954',
            color: 'white',
            fontSize: '20px',
            cursor: isReady ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#ccc', marginBottom: '5px' }}>
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '6px', 
            backgroundColor: '#555', 
            borderRadius: '3px',
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            handleSeek(clickPosition * duration);
          }}
          >
            <div style={{ 
              width: `${progressPercentage}%`, 
              height: '100%', 
              backgroundColor: '#1DB954', 
              borderRadius: '3px',
              transition: 'width 0.1s linear'
            }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15.54 8.46C16.4816 9.40422 17.0099 10.6695 17.0099 11.995C17.0099 13.3205 16.4816 14.5858 15.54 15.53" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input 
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => handleVolumeChange(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>
      
      {/* 
      <div style={{ fontSize: '0.8em', color: '#666', textAlign: 'center' }}>
        Spotifyアプリで再生されます
      </div> 
      */}
    </div>
  );
};

export default SongDetailSpotifyPlayer; 