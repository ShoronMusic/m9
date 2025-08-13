'use client';

import React, { useEffect, useRef, useState, useContext, useMemo } from 'react';
import { PlayerContext } from './PlayerContext';
import { useSession } from 'next-auth/react';
import SpotifyPlayer from './SpotifyPlayer';
import styles from './FooterPlayer.module.css';
import Image from "next/image";

// Helper function to get a valid image URL
const getImageUrl = (track) => {
    if (!track) return '/placeholder.jpg';
    if (track.featured_media_url_thumbnail) return track.featured_media_url_thumbnail;
    if (track.featured_media_url) return track.featured_media_url;
    if (track.album?.images?.[0]?.url) return track.album.images[0].url;
    if (track.thumbnail) return track.thumbnail;
    return '/placeholder.jpg';
};

// Helper function to format artist names
const formatArtists = (artists) => {
    if (!artists || artists.length === 0) return 'Unknown Artist';
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
        console.log('🚀 FooterPlayer - Component initialized:', {
            hasPlayerContext: !!playerContext,
            hasSession: !!session,
            playerContextKeys: playerContext ? Object.keys(playerContext) : [],
            currentTrack: playerContext?.currentTrack
        });
    }, []);

    // PlayerContextの状態変化を監視
    useEffect(() => {
        console.log('🔍 FooterPlayer - PlayerContext state changed:', {
            currentTrack: playerContext?.currentTrack,
            isPlaying: playerContext?.isPlaying,
            currentTrackIndex: playerContext?.currentTrackIndex,
            hasPlayerContext: !!playerContext
        });
        
        // 強制的に再レンダリングを発生させる
        setForceUpdate(prev => prev + 1);
    }, [playerContext?.currentTrack, playerContext?.isPlaying, playerContext?.currentTrackIndex]);

    // 強制的な再レンダリングのためのタイマー
    useEffect(() => {
        if (playerContext?.currentTrack) {
            const timer = setTimeout(() => {
                console.log('🔄 FooterPlayer - Force re-render triggered');
                setForceUpdate(prev => prev + 1);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [playerContext?.currentTrack]);

    console.log('🎵 FooterPlayer - Render attempt:', {
        hasPlayerContext: !!playerContext,
        hasSession: !!session,
        hasAccessToken: !!session?.accessToken,
        currentTrack: playerContext?.currentTrack,
        isPlaying: playerContext?.isPlaying,
        forceUpdate
    });

    if (!playerContext) {
        console.log('❌ FooterPlayer - No PlayerContext, returning null');
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
        currentTrackIndex
    } = playerContext;

    // 現在の曲の状態を確認
    const hasCurrentTrack = currentTrack && Object.keys(currentTrack).length > 0;
    
    console.log('🎵 FooterPlayer - Track state check:', {
        hasCurrentTrack,
        currentTrackKeys: currentTrack ? Object.keys(currentTrack) : [],
        currentTrackValue: currentTrack
    });
    
    if (!hasCurrentTrack) {
        console.log('❌ FooterPlayer - No currentTrack in PlayerContext, returning null');
        return null;
    }

    // ログイン前はプレイヤーを表示しない
    if (!session || !session.accessToken) {
        console.log('❌ FooterPlayer - No session or accessToken, returning null');
        return null;
    }

    // 現在の曲を表示用に設定
    const displayTrack = currentTrack;
    
    console.log('🎵 FooterPlayer - Track check:', {
        currentTrack: !!currentTrack,
        displayTrack: !!displayTrack
    });
    
    if (!displayTrack) {
        console.log('❌ FooterPlayer - No displayTrack, returning null');
        return null; 
    }
    
    // A track is selected, render the full player
    console.log('✅ FooterPlayer - Rendering player for track:', {
        trackTitle: getSafeTitle(displayTrack),
        artistName: formatArtists(displayTrack.artists),
        imageUrl: getImageUrl(displayTrack)
    });
    
    const imageUrl = getImageUrl(displayTrack);
    const trackTitle = getSafeTitle(displayTrack);
    const artistName = formatArtists(displayTrack.artists);

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
                        <img src={imageUrl} alt={trackTitle} className={styles.albumArt} />
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
                    
                    {/* Right: Time and Volume */}
                    <div className={styles.rightControls}>
                        <div className={styles.timeDisplay}>
                           <span>{formatTime(position)}</span>
                           <span style={{ margin: '0 0.25rem' }}>/</span>
                           <span>{formatTime(duration)}</span>
                        </div>
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