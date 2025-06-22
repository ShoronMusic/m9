'use client';

import React, { useState, useEffect, useRef } from 'react';

const formatTime = (milliseconds) => {
  if (!milliseconds || isNaN(milliseconds)) return '0:00';
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const SongDetailSpotifyPlayer = ({ accessToken, songData }) => {
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.3);
  const [error, setError] = useState(null);
  
  const playerRef = useRef(null);
  const hasPlaybackStartedRef = useRef(false);
  const intervalRef = useRef(null);

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

      player.addListener('ready', ({ device_id }) => {
        console.log('Song Detail Player ready with Device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setError(null);
        player.setVolume(volume).catch(e => console.error("Could not set volume", e));
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Song Detail Player device ID has gone offline', device_id);
        setDeviceId(null);
        setIsReady(false);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        
        setIsPlaying(!state.paused);
        setPosition(state.position);
        setDuration(state.duration);
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

      player.connect();
      playerRef.current = player;
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [accessToken, songData?.spotifyTrackId]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(async () => {
        if (playerRef.current) {
          const state = await playerRef.current.getCurrentState();
          if (state) {
            setPosition(state.position);
            setDuration(state.duration);
          }
        }
      }, 1000);
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
      
      setIsPlaying(true);
      setError(null);
    } catch (e) {
      console.error('Failed to play track:', e);
      setError(`曲の再生に失敗しました: ${e.message}`);
    }
  };

  const togglePlay = async () => {
    if (!isReady || !playerRef.current) return;
    
    try {
      if (hasPlaybackStartedRef.current === false) {
        await playTrack(deviceId, songData.spotifyTrackId);
        hasPlaybackStartedRef.current = true;
      } else {
        await playerRef.current.togglePlay();
      }
    } catch (e) {
      console.error('Failed to toggle play:', e);
      setError(`操作に失敗しました: ${e.message}`);
    }
  };

  const handleSeek = (newPosition) => {
    if (!isReady || !playerRef.current) return;
    
    const newPositionMs = Math.round(newPosition);
    playerRef.current.seek(newPositionMs).catch(e => {
      console.error('Failed to seek:', e);
    });
  };

  const handleVolumeChange = (newVolume) => {
    if (!isReady || !playerRef.current) return;
    const volumeValue = parseFloat(newVolume);
    setVolume(volumeValue);
    playerRef.current.setVolume(volumeValue).catch(e => console.error("Failed to set volume", e));
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
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