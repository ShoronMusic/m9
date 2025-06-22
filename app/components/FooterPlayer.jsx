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

export default function FooterPlayer() {
    const playerContext = useContext(PlayerContext); // Use context directly
    const [isVolumeVisible, setIsVolumeVisible] = useState(false); // ボリューム表示状態を管理

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
        toggleShuffle
    } = playerContext; // Destructure from the context value
    
    const { data: session } = useSession();

    if (!currentTrack) {
        return null; 
    }
    
    console.log('FooterPlayer: Rendering with current track:', {
        trackName: currentTrack.name || currentTrack.title?.rendered,
        trackId: currentTrack.spotifyTrackId || currentTrack.id
    });
    
    // A track is selected, render the full player
    const imageUrl = getImageUrl(currentTrack);
    const trackTitle = currentTrack.name || currentTrack.title?.rendered || 'Untitled';
    const artistName = formatArtists(currentTrack.artists);

    const handleSeek = (newPosition) => {
        console.log('FooterPlayer handleSeek called:', {
            newPosition,
            spotifyPlayerRef: !!spotifyPlayerRef,
            spotifyPlayerRefCurrent: !!spotifyPlayerRef?.current,
            seekToMethod: !!(spotifyPlayerRef?.current?.seekTo)
        });
        console.log('Seeking to:', formatTime(newPosition));
        seekTo(newPosition);
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        
        // SpotifyPlayerの音量を更新
        if (spotifyPlayerRef.current && spotifyPlayerRef.current.setVolume) {
            spotifyPlayerRef.current.setVolume(newVolume);
        }
    };

    const handleMuteToggle = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        
        if (spotifyPlayerRef.current && spotifyPlayerRef.current.setVolume) {
            if (newMutedState) {
                spotifyPlayerRef.current.setVolume(0);
            } else {
                // Unmute to the last known volume, or a default if volume was 0
                const newVolume = volume > 0 ? volume : 0.5;
                if(volume === 0) setVolume(newVolume);
                spotifyPlayerRef.current.setVolume(newVolume);
            }
        }
    };

    const handleVolumeIconClick = () => {
        setIsVolumeVisible(!isVolumeVisible);
    };

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
                        <button onClick={playPrevious} className={styles.controlButton}>
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
                                onClick={() => setIsVolumeVisible(!isVolumeVisible)}
                                className={styles.volumeButton}
                            >
                                <Image
                                    src={volume > 0 ? "/svg/volume-high-solid.svg" : "/svg/volume-off-solid.svg"}
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
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
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