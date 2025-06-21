'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerContext';
import { useSession } from 'next-auth/react';
import SpotifyPlayer from './SpotifyPlayer'; // The non-visual player engine
import styles from './FooterPlayer.module.css';

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

// Progress Bar Component
const ProgressBar = ({ position, duration, onSeek }) => {
    const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;
    const seekTimeoutRef = useRef(null);
    
    const handleClick = (e) => {
        console.log('ProgressBar handleClick called:', {
            onSeek: !!onSeek,
            duration,
            clientX: e.clientX,
            target: e.currentTarget
        });
        
        if (!onSeek || duration === 0) {
            console.log('ProgressBar click ignored:', { onSeek: !!onSeek, duration });
            return;
        }
        
        // 既存のタイマーをクリア
        if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
        }
        
        const rect = e.currentTarget.getBoundingClientRect();
        const clickPosition = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newPosition = clickPosition * duration;
        
        console.log('Progress bar clicked:', {
            clickX: e.clientX,
            rectLeft: rect.left,
            rectWidth: rect.width,
            clickPosition,
            newPosition,
            duration
        });
        
        // デバウンス処理（100ms後に実行）
        seekTimeoutRef.current = setTimeout(() => {
            console.log('ProgressBar calling onSeek with position:', newPosition);
            onSeek(newPosition);
        }, 100);
    };

    return (
        <div className={styles.progressContainer}>
            <div className={styles.progressBar} onClick={handleClick}>
                <div 
                    className={styles.progressFill} 
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
            <div className={styles.timeDisplay}>
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
            </div>
        </div>
    );
};

export default function FooterPlayer() {
    console.log('FooterPlayer: Component function called');
    
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
        spotifyPlayerRef
    } = usePlayer();
    const { data: session } = useSession();

    // 認証状態を確認
    useEffect(() => {
        console.log('FooterPlayer: Session check:', {
            hasSession: !!session,
            hasAccessToken: !!session?.accessToken
        });
    }, [session]);

    // 認証状態とSpotifyPlayerのpropsを確認
    useEffect(() => {
        console.log('FooterPlayer: Authentication and props check:', {
            session: !!session,
            accessToken: !!session?.accessToken,
            currentTrack: !!currentTrack,
            trackId: currentTrack?.spotifyTrackId || currentTrack?.id,
            isPlaying,
            spotifyPlayerRef: !!spotifyPlayerRef
        });
    }, [session, currentTrack, isPlaying, spotifyPlayerRef]);

    // SpotifyPlayerのrefをPlayerContextに設定
    useEffect(() => {
        console.log('FooterPlayer useEffect - spotifyPlayerRef:', {
            spotifyPlayerRef: !!spotifyPlayerRef,
            spotifyPlayerRefCurrent: !!spotifyPlayerRef?.current
        });
        
        if (spotifyPlayerRef) {
            // refは自動的に設定されるので、ここでは何もしない
            console.log('spotifyPlayerRef is available');
        }
    }, [spotifyPlayerRef]);

    if (!currentTrack) {
        console.log('FooterPlayer: No current track, not rendering');
        return null; // Don't render anything if no track is selected
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
        setIsMuted(!isMuted);
        
        // SpotifyPlayerのミュート状態を更新
        if (spotifyPlayerRef.current && spotifyPlayerRef.current.setVolume) {
            if (!isMuted) {
                // ミュートする
                spotifyPlayerRef.current.setVolume(0);
            } else {
                // ミュートを解除する
                spotifyPlayerRef.current.setVolume(volume);
            }
        }
    };

    return (
        <>
            <div className={styles.playerContainer}>
                <div className={styles.trackInfo}>
                    <img src={imageUrl} alt={trackTitle} className={styles.albumArt} />
                    <div className={styles.trackDetails}>
                        <div className={styles.trackName}>{trackTitle}</div>
                        <div className={styles.artistName}>{artistName}</div>
                    </div>
                </div>
                <div className={styles.controls}>
                    <button onClick={playPrevious} className={styles.controlButton}>
                        <i className="fas fa-step-backward"></i>
                    </button>
                    <button onClick={togglePlay} className={`${styles.controlButton} ${styles.playButton}`}>
                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button onClick={playNext} className={styles.controlButton}>
                        <i className="fas fa-step-forward"></i>
                    </button>
                </div>
                <div className={styles.progressSection}>
                    <ProgressBar 
                        position={position} 
                        duration={duration} 
                        onSeek={handleSeek}
                    />
                </div>
                <div className={styles.volumeContainer}>
                    <button onClick={handleMuteToggle} className={styles.volumeButton}>
                        <i className={`fas ${isMuted || volume === 0 ? 'fa-volume-mute' : volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'}`}></i>
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className={styles.volumeSlider}
                        title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                    />
                    <a 
                        href={`https://open.spotify.com/track/${currentTrack?.spotifyTrackId || currentTrack?.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.spotifyLink}
                        title="Open in Spotify"
                    >
                        <i className="fab fa-spotify"></i>
                    </a>
                </div>
            </div>

            {/* The actual player logic, invisible */}
            <SpotifyPlayer
                ref={spotifyPlayerRef}
                accessToken={session?.accessToken}
                trackId={currentTrack?.spotifyTrackId || currentTrack?.id}
                autoPlay={isPlaying}
            />
        </>
    );
} 