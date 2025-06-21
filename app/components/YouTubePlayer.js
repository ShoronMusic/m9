"use client";

import React, {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useCallback
} from "react";
import { useRouter, usePathname } from "next/navigation";
import PropTypes from "prop-types";
import styles from "./YouTubePlayer.module.css"; // CSSモジュールをインポート
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { firestore, auth } from "./firebase";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlay, 
  faPause, 
  faForwardStep, 
  faBackwardStep,
  faVolumeHigh,
  faVolumeMute,
  faExpand,
  faCompress
} from '@fortawesome/free-solid-svg-icons';
import { config } from '../config';

// アーティスト名を取得する関数
const getArtistNames = (post) => {
  if (!post || !post.artist) return '';

  // 文字列
  if (typeof post.artist === 'string') return post.artist;

  // 配列
  if (Array.isArray(post.artist)) {
    return post.artist
      .map(a => getArtistNames({ artist: a }))
      .filter(name => !!name && name !== 'Unknown Artist')
      .join(', ');
  }

  // オブジェクトでnameプロパティ
  if (typeof post.artist === 'object' && post.artist.name) return post.artist.name;

  // React要素
  if (typeof post.artist === 'object' && post.artist.props && post.artist.props.children) {
    if (typeof post.artist.props.children === 'string') return post.artist.props.children;
    if (Array.isArray(post.artist.props.children)) {
      return post.artist.props.children
        .map(child => (typeof child === 'string' ? child : getArtistNames({ artist: child })))
        .filter(name => !!name && name !== 'Unknown Artist')
        .join('');
    }
  }

  return '';
};

// アナリティクスイベント送信関数
const sendAnalyticsEvent = (action, label) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: "YouTube Player",
      event_label: label
    });
  }
};

// 時間フォーマット関数
const formatTime = (timeInSeconds) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

// YouTubeプレイヤーのエラーメッセージを取得する関数
const getErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 2:
      return "無効なパラメータ値です";
    case 5:
      return "HTML5プレーヤーでエラーが発生しました";
    case 100:
      return "動画が見つかりません";
    case 101:
    case 150:
      return "この動画は埋め込み再生が許可されていません";
    default:
      return "再生中にエラーが発生しました";
  }
};

const styleIdMapping = {
  alternative: 2845,
  dance: 4686,
  electronica: 2846,
  "hip-hop": 2848,
  others: 2873,
  pop: 2844,
  rb: 2847,
  rock: 6703,
  metal: 2849,
  "drum-and-bass": 4687
};

const ITEMS_PER_PAGE = 20;

const YouTubePlayer = forwardRef(
  (
    {
      videoId,
      onEnd,
      currentTrack,
      currentSongIndex,
      setCurrentSongIndex,
      setCurrentVideoId,
      posts = [],
      setCurrentTrack,
      showPreviousButton = true,
      showPlayPauseButton = true,
      showNextButton = true,
      autoPlay = true,
      styleSlug,
      styleName,
      handlePreviousSong,
      playlistTitle,
      pageType
    },
    ref
  ) => {
    const router = useRouter();
    const currentPathname = usePathname();
    const playerRef = useRef(null);

    // 各種ステート
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [volume, setVolume] = useState(50); // デフォルト値を設定
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [hasCountedView, setHasCountedView] = useState(false);
    const [videoVisible, setVideoVisible] = useState(true);
    const controlsTimeoutRef = useRef(null);
    const playerContainerRef = useRef(null);
    const progressBarRef = useRef(null);
    const volumeBarRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [initialProgress, setInitialProgress] = useState(0);
    const [isVolumeDragging, setIsVolumeDragging] = useState(false);
    const [initialVolume, setInitialVolume] = useState(0);
    const [showVolumeBar, setShowVolumeBar] = useState(false);
    const volumeTimeoutRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [currentQuality, setCurrentQuality] = useState('auto');
    const [availableQualities, setAvailableQualities] = useState([]);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;
    const retryTimeoutRef = useRef(null);
    const [isBuffering, setIsBuffering] = useState(false);
    const [bufferProgress, setBufferProgress] = useState(0);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showCaptionsMenu, setShowCaptionsMenu] = useState(false);
    const [captionsEnabled, setCaptionsEnabled] = useState(false);
    const [availableCaptions, setAvailableCaptions] = useState([]);
    const [currentCaption, setCurrentCaption] = useState(null);
    const [showMiniPlayer, setShowMiniPlayer] = useState(false);
    const miniPlayerRef = useRef(null);
    const [miniPlayerPosition, setMiniPlayerPosition] = useState({ x: 0, y: 0 });
    const [isDraggingMiniPlayer, setIsDraggingMiniPlayer] = useState(false);
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
    const [playlist, setPlaylist] = useState([]);
    const [isShuffled, setIsShuffled] = useState(false);
    const [isRepeating, setIsRepeating] = useState(false);
    const [showAddToPlaylistMenu, setShowAddToPlaylistMenu] = useState(false);
    const [userPlaylists, setUserPlaylists] = useState([]);
    const [showCreatePlaylistPopup, setShowCreatePlaylistPopup] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [showEmbedCode, setShowEmbedCode] = useState(false);
    const [embedCode, setEmbedCode] = useState('');
    const [showReportMenu, setShowReportMenu] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [showThanksMessage, setShowThanksMessage] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [showTheaterModeButton, setShowTheaterModeButton] = useState(false);
    const [showPictureInPicture, setShowPictureInPicture] = useState(false);
    const [isPictureInPictureSupported, setIsPictureInPictureSupported] = useState(false);
    const [showStatsForNerds, setShowStatsForNerds] = useState(false);
    const [stats, setStats] = useState({
      currentTime: 0,
      duration: 0,
      bufferProgress: 0,
      playbackRate: 1,
      volume: 100,
      isMuted: false,
      videoWidth: 0,
      videoHeight: 0,
      fps: 0,
      codecs: '',
      networkActivity: 0,
      droppedFrames: 0,
      totalFrames: 0
    });
    const [showDebugInfo, setShowDebugInfo] = useState(false);
    const [debugInfo, setDebugInfo] = useState({
      videoId,
      currentTrack,
      currentSongIndex,
      isPlaying,
      volume,
      isMuted,
      currentTime,
      duration,
      isReady,
      error,
      isLoading,
      isFullscreen,
      showControls,
      isDragging,
      dragStartX,
      initialProgress,
      isVolumeDragging,
      initialVolume,
      showVolumeBar,
      isMobile,
      showQualityMenu,
      currentQuality,
      availableQualities,
      showSpeedMenu,
      playbackRate,
      showError,
      errorMessage,
      retryCount,
      isBuffering,
      bufferProgress,
      showSettingsMenu,
      showCaptionsMenu,
      captionsEnabled,
      availableCaptions,
      currentCaption,
      showMiniPlayer,
      miniPlayerPosition,
      isDraggingMiniPlayer,
      showPlaylist,
      currentPlaylistIndex,
      playlist,
      isShuffled,
      isRepeating,
      showAddToPlaylistMenu,
      userPlaylists,
      showCreatePlaylistPopup,
      newPlaylistName,
      showShareMenu,
      shareUrl,
      showEmbedCode,
      embedCode,
      showReportMenu,
      reportReason,
      showThanksMessage,
      isTheaterMode,
      showTheaterModeButton,
      showPictureInPicture,
      isPictureInPictureSupported,
      showStatsForNerds,
      stats,
      showDebugInfo
    });

    const onEndRef = useRef(onEnd);
    useEffect(() => {
      onEndRef.current = onEnd;
    }, [onEnd]);

    const autoPlayRef = useRef(autoPlay);
    useEffect(() => {
      autoPlayRef.current = autoPlay;
    }, [autoPlay]);

    useEffect(() => {
      if (!videoId) {
        console.log('[YouTubePlayer] No videoId provided, skipping initialization');
        return;
      }

      console.log('[YouTubePlayer] Initializing player with videoId:', videoId);

      // YouTubeプレイヤーが既に存在する場合は破棄
      if (playerRef.current) {
        console.log('[YouTubePlayer] Destroying existing player');
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // YouTube IframeAPI スクリプトがまだ読み込まれていない場合のみ追加
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }

      const initPlayer = () => {
        console.log('[YouTubePlayer] Creating new player instance');
        playerRef.current = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        // IframeAPI の読み込み完了を待つ
        window.onYouTubeIframeAPIReady = initPlayer;
      }

      return () => {
        if (playerRef.current) {
          console.log('[YouTubePlayer] Cleaning up player instance');
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }, [videoId]);

    const onPlayerReady = (event) => {
      console.log('[YouTubePlayer] Player ready, autoPlay:', autoPlay);
      setIsReady(true);
      setIsLoading(false);
      setError(null);
      setRetryCount(0);

      // 保存されたボリュームを設定
      if (typeof window !== 'undefined') {
        const savedVolume = localStorage.getItem('youtubePlayerVolume');
        if (savedVolume) {
          event.target.setVolume(parseInt(savedVolume));
        }
      }

      if (autoPlay) {
        console.log('[YouTubePlayer] Auto-playing video');
        event.target.playVideo();
        setIsPlaying(true);
      }
    };

    const onPlayerStateChange = (event) => {
      console.log('[YouTubePlayer] Player state changed:', event.data);
      switch (event.data) {
        case window.YT.PlayerState.PLAYING:
          setIsPlaying(true);
          setIsLoading(false);
          setIsBuffering(false);
          break;
        case window.YT.PlayerState.PAUSED:
          setIsPlaying(false);
          break;
        case window.YT.PlayerState.ENDED:
          setIsPlaying(false);
          if (onEndRef.current) {
            onEndRef.current();
          }
          break;
        case window.YT.PlayerState.BUFFERING:
          setIsBuffering(true);
          break;
        case window.YT.PlayerState.CUED:
          setIsLoading(false);
          break;
      }
    };

    const onPlayerError = (event) => {
      console.log('[YouTubePlayer] Error occurred:', event.data);
      setError(event.data);
      
      // エラーコード2（無効なパラメータ）、100（動画が見つからない）、
      // 101/150（埋め込み不可）の場合は次の曲にスキップ
      if ([2, 100, 101, 150].includes(event.data)) {
        console.log('[YouTubePlayer] Invalid video ID or not available, skipping to next song');
        setShowError(false); // エラーメッセージを表示しない
            if (onEndRef.current) {
              onEndRef.current();
        }
        return;
      }
      
      // その他のエラーの場合のみメッセージを表示
      setShowError(true);
      setErrorMessage(getErrorMessage(event.data));
      setIsLoading(false);
      
      // その他のエラーの場合はリトライを試みる
      if (retryCount < maxRetries) {
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          if (playerRef.current) {
            playerRef.current.loadVideoById(videoId);
          }
        }, 2000);
      } else {
        // リトライ回数を超えた場合は次の曲へ
          if (onEndRef.current) {
            onEndRef.current();
        }
      }
    };

    // 再生時間と進捗の更新
    useEffect(() => {
      let progressInterval;

      const updateProgress = () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const currentTime = playerRef.current.getCurrentTime();
            const duration = playerRef.current.getDuration();
            setCurrentTime(currentTime);
            setDuration(duration);
            setProgress((currentTime / duration) * 100);
          } catch (error) {
            console.error('[YouTubePlayer] Error updating progress:', error);
          }
        }
      };

      if (isReady && isPlaying) {
        console.log('[YouTubePlayer] Starting progress updates');
        progressInterval = setInterval(updateProgress, 1000);
      }

      return () => {
        if (progressInterval) {
          console.log('[YouTubePlayer] Cleaning up progress updates');
          clearInterval(progressInterval);
        }
      };
    }, [isReady, isPlaying]);

    // 現在のページ情報を取得する関数
    const getCurrentPageInfo = useCallback(() => {
      if (pageType) {
        return { pageName: pageType, pageUrl: currentPathname };
      }
      let pageName = "Unknown";
      let pageUrl = currentPathname;
      if (currentPathname.startsWith("/tag")) {
        pageName = "Tag";
      } else if (currentPathname === "/") {
        pageName = "Home";
      } else if (currentPathname.startsWith("/charts")) {
        pageName = "Chart";
      } else if (currentPathname.startsWith("/styles")) {
        pageName = "Style";
      } else if (currentPathname.startsWith("/genres")) {
        pageName = "Genre";
      } else if (
        currentPathname.startsWith("/myplaylist") ||
        currentPathname.startsWith("/playlists")
      ) {
        pageName = `MyPageSongList: ${playlistTitle}`;
      } else {
        pageName = "Artist";
      }
      return { pageName, pageUrl };
    }, [pageType, currentPathname, playlistTitle]);

    // スタイル名のフォーマット（必要なら利用）
    const formatStyleName = useCallback((slug) => {
      switch (slug) {
        case "alternative":
          return "Alternative";
        case "electronica":
          return "Electronica";
        case "hip-hop":
          return "Hip-hop";
        case "others":
          return "Others";
        case "pop":
          return "Pop";
        case "rb":
          return "R&B";
        case "rock":
          return "Rock";
        case "dance":
          return "Dance";
        case "drum-and-bass":
          return "Drum and Bass";
        default:
          return "Unknown Style";
      }
    }, []);

    // ビューカウント更新関数
    const updateViewCounts = useCallback(
      async (songId, userId) => {
        if (!songId) return;
        try {
          const songRef = doc(firestore, "songViews", String(songId));
          const songDoc = await getDoc(songRef);
          const userViewRef = doc(
            firestore,
            "usersongViews",
            String(songId),
            "userViews",
            userId || "unknownUser"
          );
          const userViewDoc = await getDoc(userViewRef);
          const currentTimeMillis = Date.now();
          const oneMinuteInMillis = 60 * 1000;
          let lastViewedAt = 0;
          if (userViewDoc.exists()) {
            const data = userViewDoc.data();
            lastViewedAt = data.lastViewedAt && typeof data.lastViewedAt.toMillis === 'function'
              ? data.lastViewedAt.toMillis()
              : 0;
          }
          if (currentTimeMillis - lastViewedAt >= oneMinuteInMillis) {
            if (songDoc.exists()) {
              await updateDoc(songRef, {
                totalViewCount: increment(1),
                lastViewedAt: serverTimestamp()
              });
            } else {
              await setDoc(songRef, {
                totalViewCount: 1,
                songId: String(songId),
                lastViewedAt: serverTimestamp()
              });
            }
            if (userId) {
              if (userViewDoc.exists()) {
                await updateDoc(userViewRef, {
                  viewCount: increment(1),
                  lastViewedAt: serverTimestamp()
                });
              } else {
                await setDoc(userViewRef, {
                  viewCount: 1,
                  songId: String(songId),
                  userId: userId,
                  lastViewedAt: serverTimestamp()
                });
              }
            }
          }
        } catch (error) {
          console.error("Error updating view counts:", error);
        }
      },
      []
    );

    // 視聴履歴保存関数
    const saveViewingHistory = useCallback(
      async (
        videoId,
        songTitle,
        artistNames,
        pageName,
        pageUrl,
        styleIdValue,
        styleNameValue,
        songId
      ) => {
        if (!songId) {
          console.warn("saveViewingHistory: songId is missing");
          return;
        }
        let cleanedPageUrl = pageUrl.split("#")[0];
        const newAnchor = `#song-${songId}`;
        if (!pageUrl.includes(newAnchor)) {
          cleanedPageUrl += newAnchor;
        }
        if (auth.currentUser) {
          try {
            await addDoc(collection(firestore, "viewingHistory"), {
              userId: auth.currentUser.uid,
              videoId,
              artistNames,
              songTitle,
              pageName,
              pageUrl: cleanedPageUrl,
              styleId: styleIdValue || "unknown",
              styleName: styleNameValue || "unknown",
              songId: String(songId),
              viewedAt: serverTimestamp()
            });
          } catch (error) {
            console.error("Error saving viewing history:", error);
          }
        } else {
          console.warn("No authenticated user. Viewing history not saved.");
        }
      },
      []
    );

    // 再生開始時にビューカウント更新
    useEffect(() => {
      setHasCountedView(false);
      if (posts[currentSongIndex]) {
        const selectedPost = posts[currentSongIndex];
        const songId = selectedPost.id;
        updateViewCounts(songId, auth.currentUser ? auth.currentUser.uid : null);
      }
    }, [currentSongIndex, posts, updateViewCounts]);

    // 30秒以上再生で視聴履歴保存
    useEffect(() => {
      if (
        isPlaying &&
        currentTime >= 30 &&
        !hasCountedView &&
        (posts[currentSongIndex] || (currentTrack && currentTrack.songId))
      ) {
        setHasCountedView(true);
        const selectedPost = posts[currentSongIndex] || currentTrack;
        const artistName = getArtistNames(selectedPost);
        const songTitle =
          (typeof selectedPost.title === 'string' 
            ? selectedPost.title 
            : (selectedPost.title?.rendered || 'No Title'));
        const songId = selectedPost.id || currentTrack.songId;
        const { pageName, pageUrl } = getCurrentPageInfo();
        const styleIdValue =
          currentTrack?.styleSlug || currentTrack?.styleId || styleSlug || "unknown";
        const styleNameValue =
          currentTrack?.styleName || styleName || "unknown";
        console.log("Saving viewing history:", {
          videoId,
          songTitle,
          artistName,
          pageName,
          pageUrl,
          styleIdValue,
          styleNameValue,
          songId
        });
        saveViewingHistory(
          videoId,
          songTitle,
          artistName,
          pageName,
          pageUrl,
          styleIdValue,
          styleNameValue,
          songId
        );
      }
    }, [
      currentTime,
      isPlaying,
      posts,
      currentSongIndex,
      videoId,
      styleSlug,
      currentTrack,
      getCurrentPageInfo,
      saveViewingHistory,
      styleName,
      hasCountedView
    ]);

    const handlePreviousInternal = useCallback(() => {
      if (typeof handlePreviousSong === "function") {
        handlePreviousSong();
      } else {
        if (!posts?.length) return;
        let prevIndex = currentSongIndex - 1;
        if (prevIndex < 0) {
          prevIndex = posts.length - 1;
        }
        const prevPost = posts[prevIndex];
        const prevVideoId = prevPost.acf?.ytvideoid || "";
        if (playerRef.current?.loadVideoById) {
          playerRef.current.loadVideoById(prevVideoId);
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
        setCurrentSongIndex(prevIndex);
        setCurrentVideoId(prevVideoId);
      }
      sendAnalyticsEvent("previous", "user clicked previous fallback");
    }, [handlePreviousSong, posts, currentSongIndex]);

    const togglePlayPause = useCallback(() => {
      if (!playerRef.current) return;
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    }, [isPlaying]);

    const handleProgressBarClick = useCallback(
      (event) => {
        const progressBar = event.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const newTime = (clickX / rect.width) * duration;
        if (playerRef.current?.seekTo) {
          playerRef.current.seekTo(newTime, true);
        }
      },
      [duration]
    );

    const handleVolumeChange = (newVolume) => {
      setVolume(newVolume);
      // ボリューム設定をローカルストレージに保存
      if (typeof window !== 'undefined') {
        localStorage.setItem('youtubePlayerVolume', newVolume.toString());
      }
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(newVolume);
      }
    };

    const lastLoggedTrackRef = useRef(null);
    useEffect(() => {
      if (currentTrack && currentTrack.title) {
        const uniqueTrackKey = `${currentTrack.artist}-${currentTrack.title}`;
        if (lastLoggedTrackRef.current !== uniqueTrackKey) {
          lastLoggedTrackRef.current = uniqueTrackKey;
        }
      }
    }, [videoId, currentTrack]);

    // videoVisibleとvideoIdの変更時にiframeの表示状態を更新
    useEffect(() => {
      if (playerRef.current?.getIframe) {
        const ifr = playerRef.current.getIframe();
        ifr.style.display = videoVisible ? "block" : "none";
      }
    }, [videoVisible, videoId]);

    // 前ボタンの無効状態を判定する関数を追加
    const isFirstSongInPage = useCallback(() => {
      // currentSongIndexが0-19なら1ページ目の曲、20-39なら2ページ目の曲...
      const songIndexInPage = currentSongIndex % ITEMS_PER_PAGE;
      return songIndexInPage === 0;
    }, [currentSongIndex]);

    return (
      <div id="sticky-player" className={styles.playerContainer}>
        {currentTrack && (
          <div className={styles.trackInfo}>
            <div className={styles.trackThumbnailContainer}>
              <img
                src={currentTrack.thumbnail || "/placeholder.jpg"}
                className={styles.trackThumbnail}
                alt="Thumb"
                loading="eager"
                onError={(e) => {
                  if (e.target.src !== "/placeholder.jpg") {
                    e.target.src = "/placeholder.jpg";
                  }
                }}
              />
            </div>
            <div className={styles.trackText}>
              <div className={styles.trackTitle}>
                {typeof currentTrack.title === 'string' 
                  ? currentTrack.title 
                  : (currentTrack.title?.rendered || 'No Title')}
              </div>
              <div className={styles.trackArtist}>{getArtistNames(currentTrack) || 'Unknown Artist'}</div>
            </div>
          </div>
        )}
        <div id="youtube-player" className={styles.videoContainer} />
        <div className={styles.progressBar} onClick={handleProgressBarClick}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={styles.controls}>
          {showPreviousButton && (
            <button
              onClick={handlePreviousInternal}
              className={`${styles.controlButton} ${isFirstSongInPage() ? styles.controlButtonDisabled : ''}`}
              disabled={!currentTrack || isFirstSongInPage()}
            >
              <FontAwesomeIcon icon={faBackwardStep} />
            </button>
          )}
          {showPlayPauseButton && (
            <button
              onClick={togglePlayPause}
              className={styles.controlButton}
              disabled={!currentTrack}
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
          )}
          {showNextButton && (
            <button
              onClick={() => {
                if (onEndRef.current) {
                  onEndRef.current();
                }
              }}
              className={styles.controlButton}
              disabled={!currentTrack}
            >
              <FontAwesomeIcon icon={faForwardStep} />
            </button>
          )}
          <span className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className={styles.volumeControls}>
            <button
              onClick={() => {
                const newVolume = volume === 0 ? 50 : 0;
                handleVolumeChange(newVolume);
              }}
              className={styles.controlButton}
            >
              <FontAwesomeIcon icon={volume === 0 ? faVolumeMute : faVolumeHigh} />
            </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
            className={styles.volumeSlider}
          />
          </div>
          <button
            onClick={() => {
              const newVisibility = !videoVisible;
              setVideoVisible(newVisibility);
              if (playerRef.current?.getIframe) {
                const ifr = playerRef.current.getIframe();
                ifr.style.display = newVisibility ? "block" : "none";
              }
            }}
            className={styles.controlButton}
          >
            <FontAwesomeIcon icon={videoVisible ? faCompress : faExpand} />
          </button>
        </div>
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  });
  
  YouTubePlayer.propTypes = {
    videoId: PropTypes.string.isRequired,
    onEnd: PropTypes.func,
    currentTrack: PropTypes.shape({
      artist: PropTypes.string,
      title: PropTypes.string,
      thumbnail: PropTypes.string,
      styleSlug: PropTypes.string,
      styleName: PropTypes.string,
      songId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    }),
    currentSongIndex: PropTypes.number,
    setCurrentSongIndex: PropTypes.func,
    setCurrentVideoId: PropTypes.func,
    posts: PropTypes.array,
    setCurrentTrack: PropTypes.func,
    showPreviousButton: PropTypes.bool,
    showPlayPauseButton: PropTypes.bool,
    showNextButton: PropTypes.bool,
    autoPlay: PropTypes.bool,
    styleSlug: PropTypes.string,
    styleName: PropTypes.string,
    handlePreviousSong: PropTypes.func,
    playlistTitle: PropTypes.string,
    pageType: PropTypes.string
  };
  
  export default YouTubePlayer;