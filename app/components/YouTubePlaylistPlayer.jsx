'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function YouTubePlaylistPlayer({ playlistTracks = [], isPlaying = false, onPlayStateChange }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const playerRef = useRef(null);

  // YouTube IFrame Player API の読み込み
  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        setPlayerReady(true);
        return;
      }

      // YouTube IFrame Player API を動的に読み込み
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // グローバルコールバック関数を設定
      window.onYouTubeIframeAPIReady = () => {
        setPlayerReady(true);
      };
    };

    loadYouTubeAPI();
  }, []);

  // YouTubeプレイヤーの初期化
  useEffect(() => {
    if (!playerReady || !playlistTracks.length || !playlistTracks[currentTrackIndex]?.ytvideoid) {
      return;
    }

    const currentTrack = playlistTracks[currentTrackIndex];
    
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    try {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '315',
        width: '560',
        videoId: currentTrack.ytvideoid,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0
        },
        events: {
          onReady: (event) => {
            console.log('YouTube player ready');
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            // 動画が終了した場合、次の曲に移動
            if (event.data === window.YT.PlayerState.ENDED) {
              handleNextTrack();
            }
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
            setPlayerError(`動画の再生に失敗しました: ${event.data}`);
          }
        }
      });
    } catch (error) {
      console.error('YouTube player initialization error:', error);
      setPlayerError('プレイヤーの初期化に失敗しました');
    }

    // クリーンアップ関数
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [playerReady, currentTrackIndex, playlistTracks, isPlaying]);

  // 次のトラックに移動
  const handleNextTrack = () => {
    if (currentTrackIndex < playlistTracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    } else {
      // プレイリストの最後に達した場合
      setCurrentTrackIndex(0);
      if (onPlayStateChange) {
        onPlayStateChange(false);
      }
    }
  };

  // 前のトラックに移動
  const handlePrevTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    } else {
      // プレイリストの最初の場合、最後のトラックに移動
      setCurrentTrackIndex(playlistTracks.length - 1);
    }
  };

  // 特定のトラックを選択
  const handleTrackSelect = (index) => {
    setCurrentTrackIndex(index);
  };

  // 再生/停止の切り替え
  const togglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      if (onPlayStateChange) {
        onPlayStateChange(!isPlaying);
      }
    }
  };

  const currentTrack = playlistTracks[currentTrackIndex];

  if (!playlistTracks.length) {
    return (
      <div className="youtube-playlist-player">
        <div className="no-tracks-message">
          <p>プレイリストにトラックがありません</p>
        </div>
      </div>
    );
  }

  if (playerError) {
    return (
      <div className="youtube-playlist-player">
        <div className="player-error">
          <p>{playerError}</p>
          <button onClick={() => setPlayerError(null)}>再試行</button>
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-playlist-player">
      <style jsx>{`
        .youtube-playlist-player {
          max-width: 800px;
          margin: 0 auto;
          background: #f9f9f9;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .player-container {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .video-section {
          flex: 1;
        }
        
        .playlist-section {
          flex: 1;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .track-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-bottom: 4px;
        }
        
        .track-item:hover {
          background-color: #f0f0f0;
        }
        
        .track-item.active {
          background-color: #e3f2fd;
          border-left: 4px solid #2196f3;
        }
        
        .track-info {
          flex: 1;
        }
        
        .track-title {
          font-weight: 500;
          margin-bottom: 2px;
        }
        
        .track-artists {
          font-size: 0.9em;
          color: #666;
        }
        
        .controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 20px;
        }
        
        .control-button {
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }
        
        .control-button:hover {
          background: #1976d2;
        }
        
        .control-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .current-track-info {
          text-align: center;
          margin-bottom: 15px;
        }
        
        .current-track-title {
          font-size: 1.2em;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .current-track-artists {
          color: #666;
        }
        
        .no-tracks-message, .player-error {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        
        .player-error button {
          background: #2196f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
        
        @media (max-width: 768px) {
          .player-container {
            flex-direction: column;
          }
          
          .youtube-playlist-player {
            padding: 15px;
          }
        }
      `}</style>
      
      <div className="current-track-info">
        <div className="current-track-title">
          {currentTrack?.title || 'Unknown Track'}
        </div>
        <div className="current-track-artists">
          {Array.isArray(currentTrack?.artists) 
            ? currentTrack.artists.map(artist => artist.name).join(', ')
            : 'Unknown Artist'
          }
        </div>
      </div>

      <div className="player-container">
        <div className="video-section">
          <div id="youtube-player"></div>
        </div>
        
        <div className="playlist-section">
          <h4>プレイリスト ({playlistTracks.length}曲)</h4>
          {playlistTracks.map((track, index) => (
            <div
              key={index}
              className={`track-item ${index === currentTrackIndex ? 'active' : ''}`}
              onClick={() => handleTrackSelect(index)}
            >
              <div className="track-info">
                <div className="track-title">
                  {track.title || 'Unknown Track'}
                </div>
                <div className="track-artists">
                  {Array.isArray(track.artists) 
                    ? track.artists.map(artist => artist.name).join(', ')
                    : 'Unknown Artist'
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="controls">
        <button
          className="control-button"
          onClick={handlePrevTrack}
          disabled={playlistTracks.length <= 1}
        >
          ⏮
        </button>
        <button
          className="control-button"
          onClick={togglePlayPause}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="control-button"
          onClick={handleNextTrack}
          disabled={playlistTracks.length <= 1}
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
