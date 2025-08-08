'use client';

import React, { useEffect, useRef, useState, useContext } from 'react';
import { PlayerContext } from './PlayerContext'; // Import context directly
import { useSession } from 'next-auth/react';
import SpotifyPlayer from './SpotifyPlayer'; // The non-visual player engine
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
    return artists.map(artist => artist.name).join(', ');
};

// Helper function to format time in MM:SS format
const formatTime = (milliseconds) => {
    if (!milliseconds) return '0:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Progress Bar Component - Now without time display
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

// Volume Control Component
const VolumeControl = ({ volume, onVolumeChange, isMuted, onMuteToggle, isVolumeVisible, onVolumeIconClick }) => {
    
    // In mobile view, the volume icon toggles visibility of the slider
    const handleVolumeIconClick = () => {
        // The check for mobile is handled by CSS, so we just toggle state
        onVolumeIconClick();
    };
    
    return (
        <div className={`${styles.volumeControlContainer} ${isVolumeVisible ? styles['mobile-volume-visible'] : ''}`}>
            {/* When muted, unmutes. Otherwise, it toggles volume slider visibility. */}
            <button onClick={isMuted ? onMuteToggle : handleVolumeIconClick} className={styles.muteButton}>
                <img 
                    src={isMuted ? "/svg/volume-off-solid.svg" : "/svg/volume-high-solid.svg"} 
                    alt={isMuted ? "Unmute" : "Mute"}
                />
            </button>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={onVolumeChange}
                className={styles.volumeSlider}
                // The problematic inline style is removed. CSS will handle visibility.
            />
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

export default function FooterPlayer({ accessToken }) {
    const playerContext = useContext(PlayerContext); // Use context directly
    const [isVolumeVisible, setIsVolumeVisible] = useState(false); // ボリューム表示状態を管理
    const { data: session } = useSession();

    if (!playerContext) return null; // Early return if context is not available

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
        progress,
        isShuffling,
        toggleShuffle,
        currentTrackIndex
    } = playerContext; // Destructure from the context value
    
    // ログイン前はプレイヤーを表示しない
    if (!session || !accessToken) {
        return null;
    }
    
    // 曲が選択されていない場合もプレイヤーを表示しない
    if (!currentTrack) {
        return null; 
    }
    
    // A track is selected, render the full player
    const imageUrl = getImageUrl(currentTrack);
    const trackTitle = getSafeTitle(currentTrack);
    const artistName = formatArtists(currentTrack.artists);

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

    const handleVolumeIconClick = () => {
        setIsVolumeVisible(!isVolumeVisible);
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
                        <div className={styles.volumeContainer}>
                            <button
                                onClick={() => {
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
                                }}
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
                                value={volume}
                                onChange={(e) => {
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
                                }}
                                className={`${styles.volumeSlider} ${
                                    isVolumeVisible ? styles.visible : ""
                                }`}
                            />
                            {currentTrack.spotify_url && (
                                <a
                                    href={currentTrack.spotify_url}
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
            </div>

            {session && session.accessToken && (
                <SpotifyPlayer 
                    ref={spotifyPlayerRef}
                    accessToken={session.accessToken} 
                    trackId={currentTrack?.spotifyTrackId || currentTrack?.id}
                    autoPlay={isPlaying}
                />
            )}
        </>
    );
} 