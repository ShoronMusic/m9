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
          <img 
              src="/images/Full_Logo_Green_RGB.svg" 
              alt="Spotify" 
              style={{ height: '30px', width: 'auto' }} 
          />
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