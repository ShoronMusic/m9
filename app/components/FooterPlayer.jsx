'use client';

import React, { useEffect, useRef, useState, useContext, useMemo } from 'react';
import { PlayerContext } from './PlayerContext';
import { useSession } from 'next-auth/react';
import SpotifyPlayer from './SpotifyPlayer';
import styles from './FooterPlayer.module.css';
import Image from "next/image";

// CloudinaryのベースURL（正しい形式）
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

// Cloudinaryに存在しない画像のキャッシュ
const cloudinaryNotFoundCache = new Set();
// WebP形式も存在しない画像のキャッシュ
const webpNotFoundCache = new Set();

// JPG/PNG URLをWebP URLに変換する関数
function convertToWebPUrl(originalUrl) {
  if (!originalUrl) return originalUrl;
  
  // ファイル拡張子を取得
  const lastDotIndex = originalUrl.lastIndexOf('.');
  if (lastDotIndex === -1) return originalUrl;
  
  const extension = originalUrl.substring(lastDotIndex + 1).toLowerCase();
  
  // JPG/JPEG/PNGの場合はWebPに変換
  if (['jpg', 'jpeg', 'png'].includes(extension)) {
    const webpUrl = originalUrl.substring(0, lastDotIndex) + '.webp';
        // WebP変換ログを削除（不要なログのため）
    return webpUrl;
  }
  
  // 既にWebPの場合はそのまま返す
  return originalUrl;
}

// サムネイルURLを取得する関数（SongList.jsと同じロジック）
function getThumbnailUrl(track) {
  // プレイリストトラックのthumbnail_urlを優先
  if (track.thumbnail_url) {
    const fileName = track.thumbnail_url.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return track.thumbnail_url;
      }
      return convertToWebPUrl(track.thumbnail_url);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  if (track.thumbnail) {
    const fileName = track.thumbnail.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return track.thumbnail;
      }
      return convertToWebPUrl(track.thumbnail);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  if (track.featured_media_url) {
    const fileName = track.featured_media_url.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return track.featured_media_url;
      }
      return convertToWebPUrl(track.featured_media_url);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  // YouTube IDからサムネイルを生成
  if (track.youtubeId) {
    return `https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg`;
  }
  
  return '/placeholder.jpg';
}

// Helper function to get a valid image URL
const getImageUrl = (track) => {
    if (!track) return '/placeholder.jpg';
    return getThumbnailUrl(track);
};

// PlaylistSongListからformatPlaylistArtists関数をコピー
function formatPlaylistArtists(artists, spotifyArtists = null) {
  
  // spotify_artistsフィールドを最優先で使用
  if (spotifyArtists) {
    try {
      // 配列の場合はそのまま使用
      if (Array.isArray(spotifyArtists) && spotifyArtists.length > 0) {
        return spotifyArtists.join(', ');
      }
      
      // JSON文字列の場合はパース
      if (typeof spotifyArtists === 'string') {
        const parsed = JSON.parse(spotifyArtists);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.join(', ');
        }
      }
    } catch (e) {
      // パースエラーは無視して次の処理に進む
    }
  }
  
  // artistsフィールドからアーティスト名を抽出
  if (artists) {
    try {
      let artistData;
      
      // 文字列の場合はパースを試行
      if (typeof artists === 'string') {
        try {
          // まず通常のJSONとしてパースを試行
          artistData = JSON.parse(artists);
        } catch (parseError) {
          // 通常のJSONパースに失敗した場合は、エスケープされたJSONを処理
          try {
            // エスケープされたJSONを正規化
            let unescaped = artists;
            
            // 複数段階でエスケープを解除
            unescaped = unescaped.replace(/\\\\/g, '\\');
            unescaped = unescaped.replace(/\\"/g, '"');
            
            // 外側のJSONラッパーを処理
            if (unescaped.startsWith('{"') && unescaped.endsWith('"}')) {
              // 外側のJSONラッパーを除去
              unescaped = unescaped.slice(2, -2);
            }
            
            // 複数アーティストの検出と処理
            // パターン2: "}","{" で区切られた複数アーティスト（実際のデータ構造）
            if (unescaped.includes('"}","{')) {
              // 完全なJSONオブジェクトの境界で分割
              const parts = unescaped.split('"}","{');
              
              const parsedArtists = parts.map((part, index) => {
                let cleanPart = part;
                
                // 各部分を正しいJSON形式に修正
                if (index === 0) {
                  // 最初の要素: 最後に"}を追加
                  cleanPart = cleanPart + '"}';
                } else {
                  // 2番目以降の要素: 先頭に{を追加
                  cleanPart = '{' + cleanPart;
                }
                
                try {
                  const parsed = JSON.parse(cleanPart);
                  return parsed;
                } catch (e) {
                  return null;
                }
              }).filter(artist => artist !== null);
              
              artistData = parsedArtists;
            }
            // パターン3: 単一アーティスト
            else {
              artistData = JSON.parse(unescaped);
            }
          } catch (parseError2) {
            // それでも失敗した場合は、パターンマッチングを使用
            const patterns = [
              /\\"name\\":\\"([^"]+)\\"\\"/g, // エスケープされたJSON形式
              /"name":"([^"]+)"/g, // 通常のJSON形式
            ];
            
            for (const pattern of patterns) {
              const matches = [...artists.matchAll(pattern)];
              if (matches.length > 0) {
                const artistNames = matches.map(match => match[1]).filter(name => name && name.trim());
                if (artistNames.length > 0) {
                  return artistNames.join(', ');
                }
              }
            }
            
            // パターンマッチングも失敗した場合は、文字列をそのまま使用
            artistData = artists;
          }
        }
      } else {
        artistData = artists;
      }
      
      // 配列の場合の処理
      if (Array.isArray(artistData) && artistData.length > 0) {
        const artistNames = artistData.map(artist => {
          if (typeof artist === 'object' && artist !== null && artist.name) {
            return artist.name;
          }
          if (typeof artist === 'string') {
            return artist;
          }
          return String(artist);
        }).filter(name => name && name.trim());
        
        if (artistNames.length > 0) {
          return artistNames.join(', ');
        }
      }
      
      // オブジェクトの場合の処理
      if (typeof artistData === 'object' && artistData !== null && !Array.isArray(artistData)) {
        if (artistData.name) {
          return artistData.name;
        }
      }
      
      // 文字列の場合の処理（最終フォールバック）
      if (typeof artistData === 'string' && artistData.trim()) {
        return artistData;
      }
    } catch (e) {
      // エラーは無視して次の処理に進む
    }
  }

  return "Unknown Artist";
}

// Helper function to format artist names（spotify_artistsの順番を優先）
const formatArtists = (artists, currentTrack = null) => {
    
    // プレイリストトラックの場合、formatPlaylistArtists関数を使用
    if (currentTrack && currentTrack.artists) {
        return formatPlaylistArtists(currentTrack.artists, currentTrack.spotify_artists);
    }
    
    // 従来の処理（artistsパラメータを使用）
    if (!artists || artists.length === 0) return 'Unknown Artist';
    
    // spotify_artistsの順番を優先（currentTrackから取得）
    const spotifyArtists = currentTrack?.acf?.spotify_artists || 
                          currentTrack?.custom_fields?.spotify_artists || 
                          currentTrack?.spotify_artists ||
                          artists[0]?.acf?.spotify_artists || 
                          artists[0]?.custom_fields?.spotify_artists || 
                          artists[0]?.spotify_artists;
    
    if (spotifyArtists) {
        // 文字列の場合（カンマ区切り）
        if (typeof spotifyArtists === 'string') {
            return spotifyArtists.replace(/"/g, '');
        }
        
        // 配列の場合
        if (Array.isArray(spotifyArtists)) {
            const sortedArtists = [...artists].sort((a, b) => {
                const aName = a.name || '';
                const bName = b.name || '';
                
                const aIndex = spotifyArtists.findIndex(name => 
                    name.toLowerCase().includes(aName.toLowerCase()) || 
                    aName.toLowerCase().includes(name.toLowerCase())
                );
                const bIndex = spotifyArtists.findIndex(name => 
                    name.toLowerCase().includes(bName.toLowerCase()) || 
                    bName.toLowerCase().includes(name.toLowerCase())
                );
                
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                
                return aIndex - bIndex;
            });
            return sortedArtists.map(a => a.name).join(', ');
        }
    }
    
    // プレイリストトラック用の処理（artistsが文字列の場合）
    if (typeof artists === 'string') {
        try {
            const parsedArtists = JSON.parse(artists);
            if (Array.isArray(parsedArtists)) {
                return parsedArtists.map(artist => {
                    if (typeof artist === 'object' && artist.name) {
                        return artist.name;
                    }
                    return artist;
                }).join(', ');
            }
        } catch (e) {
            // JSONパースに失敗した場合、文字列として扱う
            return artists;
        }
    }
    
    // フォールバック: 元のartists配列の順番
    if (Array.isArray(artists)) {
        return artists.map(artist => {
            if (typeof artist === 'string') {
                try {
                    const parsed = JSON.parse(artist);
                    return parsed.name || 'Unknown Artist';
                } catch {
                    return artist;
                }
            }
            return artist.name || 'Unknown Artist';
        }).join(', ');
    }
    return 'Unknown Artist';
};

// Helper function to format time in MM:SS format
const formatTime = (milliseconds) => {
    if (!milliseconds) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Progress Bar Component
const ProgressBar = ({ position, duration, onSeek }) => {
    const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;
    const seekTimeoutRef = useRef(null);
    
    const handleClick = (e) => {
        if (!onSeek || duration === 0) return;
        
        if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
        }
        
        const rect = e.currentTarget.getBoundingClientRect();
        const clickPosition = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newPosition = clickPosition * duration;
        
        seekTimeoutRef.current = setTimeout(() => {
            onSeek(newPosition);
        }, 100);
    };

    return (
        <div className={styles.progressBarContainer} onClick={handleClick}>
            <div className={styles.progressBar}>
                <div 
                    className={styles.progressFill} 
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
        </div>
    );
};

const getSafeTitle = (track) => {
    if (!track) return 'Untitled';
    if (typeof track.title === 'string') return track.title;
    if (track.title && typeof track.title === 'object' && typeof track.title.rendered === 'string') return track.title.rendered;
    if (typeof track.name === 'string') return track.name;
    return 'Untitled';
};


export default function FooterPlayer() {
    const playerContext = useContext(PlayerContext);
    const { data: session } = useSession();
    const [forceUpdate, setForceUpdate] = useState(0);

    // 初期化時のログ
    useEffect(() => {
        // 初期化完了
    }, []);

    // PlayerContextの状態変化を監視
    useEffect(() => {
        // 強制的に再レンダリングを発生させる
        setForceUpdate(prev => prev + 1);
    }, [playerContext?.currentTrack, playerContext?.isPlaying, playerContext?.currentTrackIndex]);

    // 強制的な再レンダリングのためのタイマー
    useEffect(() => {
        if (playerContext?.currentTrack) {
            const timer = setTimeout(() => {
                setForceUpdate(prev => prev + 1);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [playerContext?.currentTrack]);



    if (!playerContext) {
        return null;
    }

    // PlayerContextから必要な値を取得
    const { 
        currentTrack, 
        isPlaying, 
        duration,
        position,
        volume,
        setVolume,
        isMuted,
        setIsMuted,
        togglePlay,
        playNext,
        playPrevious,
        seekTo,
        spotifyPlayerRef,
        currentTrackIndex,
        // Wake Lock関連
        wakeLock,
        isWakeLockSupported,
        requestWakeLock,
        releaseWakeLock
    } = playerContext;

    // 現在の曲の状態を確認
    const hasCurrentTrack = currentTrack && Object.keys(currentTrack).length > 0;
    
    if (!hasCurrentTrack) {
        return null;
    }

    // ログイン前はプレイヤーを表示しない
    if (!session || !session.accessToken) {
        return null;
    }

    // 現在の曲を表示用に設定
    const displayTrack = currentTrack;
    
    if (!displayTrack) {
        return null; 
    }
    
    // A track is selected, render the full player
    
    const imageUrl = getImageUrl(displayTrack);
    const trackTitle = getSafeTitle(displayTrack);
    
    const artistName = formatArtists(displayTrack.artists, displayTrack);

    const handleSeek = (newPosition) => {
        seekTo(newPosition);
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        
        // まずSpotifyPlayerの音量を更新
        if (spotifyPlayerRef.current && spotifyPlayerRef.current.setVolume) {
            try {
                spotifyPlayerRef.current.setVolume(newVolume);
            } catch (error) {
                console.error('Volume change error:', error);
            }
        }
        
        // その後で状態を更新
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const handleMuteToggle = () => {
        const newMutedState = !isMuted;
        
        if (spotifyPlayerRef.current && spotifyPlayerRef.current.setVolume) {
            try {
                if (newMutedState) {
                    spotifyPlayerRef.current.setVolume(0);
                } else {
                    const newVolume = volume > 0 ? volume : 0.5;
                    if(volume === 0) setVolume(newVolume);
                    spotifyPlayerRef.current.setVolume(newVolume);
                }
            } catch (error) {
                console.error('Mute toggle error:', error);
            }
        }
        
        setIsMuted(newMutedState);
    };

    // trackListの先頭（index 0）のみ無効
    const isFirstOfPage = currentTrackIndex === 0;

    return (
        <>
            <div className={styles.playerContainer}>
                {/* Top Section: Progress Bar */}
                <ProgressBar 
                    position={position} 
                    duration={duration} 
                    onSeek={handleSeek} 
                />

                {/* Bottom Section: Controls */}
                <div className={styles.bottomControls}>
                    {/* Left: Track Info */}
                    <div className={styles.trackInfo}>
                        <img 
                            src={imageUrl} 
                            alt={trackTitle} 
                            className={styles.albumArt}
                            onError={(e) => {
                                console.log('🖼️ FooterPlayer - Image load error:', {
                                    failedUrl: e.target.src,
                                    trackId: displayTrack.id,
                                    trackTitle: trackTitle,
                                    hasTriedOriginal: e.target.dataset.triedOriginal,
                                    hasTriedWebP: e.target.dataset.triedWebP
                                });

                                if (!e.target.dataset.triedOriginal) { // First attempt (Cloudinary failed)
                                    e.target.dataset.triedOriginal = "1";
                                    if (e.target.src.includes('cloudinary.com')) {
                                        const fileName = e.target.src.split("/").pop();
                                        cloudinaryNotFoundCache.add(fileName);
                                        console.log('🖼️ FooterPlayer - Added to not found cache:', fileName);
                                    }
                                    const src = displayTrack.thumbnail || displayTrack.featured_media_url;
                                    if (src) {
                                        const webpUrl = convertToWebPUrl(src);
                                        console.log('🖼️ FooterPlayer - Trying WebP URL (99% success rate):', webpUrl);
                                        e.target.src = webpUrl;
                                    }
                                } else if (!e.target.dataset.triedWebP) { // Second attempt (WebP failed)
                                    e.target.dataset.triedWebP = "1";
                                    if (e.target.src.includes('.webp')) {
                                        const fileName = e.target.src.split("/").pop();
                                        webpNotFoundCache.add(fileName);
                                        console.log('🖼️ FooterPlayer - Added to WebP not found cache (1% case):', fileName);
                                    }
                                    const src = displayTrack.thumbnail || displayTrack.featured_media_url;
                                    if (src) {
                                        console.log('🖼️ FooterPlayer - Trying original URL as last resort:', src);
                                        e.target.src = src;
                                    }
                                } else { // All attempts failed
                                    console.log('🖼️ FooterPlayer - Falling back to placeholder');
                                    e.target.onerror = null;
                                    e.target.src = '/placeholder.jpg';
                                }
                            }}
                        />
                        <div className={styles.trackDetails}>
                            <p className={styles.trackName}>{trackTitle}</p>
                            <p className={styles.artistName}>{artistName}</p>
                        </div>
                    </div>

                    {/* Center: Playback Controls */}
                    <div className={styles.centerControls}>
                        <button onClick={playPrevious} className={styles.controlButton} disabled={isFirstOfPage}>
                            <img src="/svg/backward-step-solid.svg" alt="Previous" />
                        </button>
                        <button onClick={togglePlay} className={`${styles.controlButton} ${styles.playPauseButton}`}>
                            <img src={isPlaying ? "/svg/pause-solid.svg" : "/svg/play-solid.svg"} alt={isPlaying ? "Pause" : "Play"} />
                        </button>
                        <button onClick={playNext} className={styles.controlButton}>
                            <img src="/svg/forward-step-solid.svg" alt="Next" />
                        </button>
                    </div>
                    
                    {/* Time Display - Independent element for mobile grid layout */}
                    <div className={styles.timeDisplay}>
                       <span>{formatTime(position)}</span>
                       <span style={{ margin: '0 0.25rem' }}>/</span>
                       <span>{formatTime(duration)}</span>
                    </div>
                    
                    {/* Right: Volume Controls */}
                    <div className={styles.rightControls}>
                        <button
                            onClick={handleMuteToggle}
                            className={styles.volumeButton}
                        >
                            <Image
                                src={isMuted || volume === 0 ? "/svg/volume-off-solid.svg" : "/svg/volume-high-solid.svg"}
                                alt="Volume"
                                width={20}
                                height={20}
                            />
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className={styles.volumeSlider}
                        />
                        {/* Wake Lock状態表示 */}
                        {isWakeLockSupported && (
                            <div className={styles.wakeLockIndicator}>
                                <Image
                                    src={wakeLock ? "/svg/lock-solid.svg" : "/svg/lock-open-solid.svg"}
                                    alt={wakeLock ? "Wake Lock Active" : "Wake Lock Inactive"}
                                    width={20}
                                    height={20}
                                    title={wakeLock ? "画面オフ時も再生継続中" : "画面オフ時は再生停止"}
                                />
                            </div>
                        )}
                        
                        {displayTrack.spotify_url && (
                            <a
                                href={displayTrack.spotify_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.spotifyLink}
                            >
                                <Image
                                    src="/icons/Spotify_logo_without_text.svg"
                                    alt="Listen on Spotify"
                                    width={24}
                                    height={24}
                                />
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {session && session.accessToken && (
                <>
                    <SpotifyPlayer 
                        ref={spotifyPlayerRef}
                        accessToken={session.accessToken} 
                        trackId={displayTrack?.spotify_track_id || displayTrack?.spotifyTrackId || displayTrack?.id}
                        autoPlay={isPlaying}
                    />



                </>
            )}
        </>
    );
} 