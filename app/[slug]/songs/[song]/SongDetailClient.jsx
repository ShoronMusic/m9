"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import CreatePlaylistModal from '../../../components/CreatePlaylistModal';
import CreateNewPlaylistModal from '../../../components/CreateNewPlaylistModal';
import SongDetailSpotifyPlayer from '../../../components/SongDetailSpotifyPlayer';
import MicrophoneIcon from "../../../components/MicrophoneIcon";
import ScrollToTopButton from "../../../components/ScrollToTopButton";
import Link from "next/link";
import Head from "next/head";
import theme from "../../../css/theme";
import Image from "next/image";
import artistStyles from "../../ArtistPage.module.css";

// モバイル最適化対応のインポート
import { useAuthToken } from '@/components/useAuthToken';
import { useSpotifyLikes } from '@/components/SpotifyLikes';
import { useErrorHandler, ERROR_TYPES, ERROR_SEVERITY, createError } from '@/components/useErrorHandler';
import AuthErrorBanner from '@/components/AuthErrorBanner';
import SpotifyErrorHandler from '@/components/SpotifyErrorHandler';
import SessionRecoveryIndicator from '@/components/SessionRecoveryIndicator';
import MobileLifecycleManager from '@/components/MobileLifecycleManager';
import NetworkStatusIndicator from '@/components/NetworkStatusIndicator';
import UnifiedErrorDisplay from '@/components/UnifiedErrorDisplay';

const styleIdMap = {
  pop: 2844,
  dance: 4686,
  alternative: 2845,
  electronica: 2846,
  rb: 2847,
  "hip-hop": 2848,
  rock: 6703,
  metal: 2849,
  others: 2873,
};

const styleDisplayMap = {
  2844: "Pop",
  4686: "Dance",
  2845: "Alternative",
  2846: "Electronica",
  2847: "R&B",
  2848: "Hip-Hop",
  2849: "Rock",
  2873: "Others",
};

// アーティスト順序決定関数（SongList.jsと同じロジック）
function removeLeadingThe(str = "") {
  return str.replace(/^The\s+/i, "").trim();
}
function determineArtistOrder(song) {
  const categories = song.artists || [];
  function getComparableCatName(cat) {
    return removeLeadingThe(cat.name || "").toLowerCase();
  }
  // 1. artist_order
  if (song.custom_fields?.artist_order) {
    const orderNames = song.custom_fields.artist_order.split(",").map(n => n.trim().toLowerCase());
    const matched = [];
    orderNames.forEach(artistNameLower => {
      const foundCat = categories.find(cat => getComparableCatName(cat) === removeLeadingThe(artistNameLower));
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return matched;
  }
  // 2. spotify_artists
  if (song.custom_fields?.spotify_artists) {
    const spotifyNames = song.custom_fields.spotify_artists.split(",").map(n => n.trim().toLowerCase());
    const matched = [];
    spotifyNames.forEach(artistNameLower => {
      const foundCat = categories.find(cat => getComparableCatName(cat) === removeLeadingThe(artistNameLower));
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return matched;
  }
  // 3. fallback
  return categories;
}

// 日付をYYYY.MM形式に整形
function formatYearMonth(dateStr) {
  if (!dateStr) return "Unknown";
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return "Unknown";
  const year = dt.getFullYear();
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  return `${year}.${month}`;
}

// ボーカルアイコンの表示（SongList.jsと同じロジック）
function renderVocalIcons(vocalData = []) {
  if (!Array.isArray(vocalData) || vocalData.length === 0) return null;
  // nameがカンマ区切りや複数形でも対応
  const names = vocalData
    .flatMap(v => (v.name ? v.name.split(',').map(s => s.trim().toLowerCase()) : []));
  const hasF = names.includes("f");
  const hasM = names.includes("m");
  const icons = [];
  if (hasF) {
    icons.push(<MicrophoneIcon key="F" color="#fd5a5a" />);
  }
  if (hasM) {
    icons.push(<MicrophoneIcon key="M" color="#00a0e9" />);
  }
  return icons.length > 0 ? <span style={{ display: "inline-flex", gap: "6px", verticalAlign: "middle" }}>{icons}</span> : null;
}

export default function SongDetailClient({ songData, description, accessToken }) {
  const { data: session } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showCreateNewPlaylistModal, setShowCreateNewPlaylistModal] = useState(false);
  
  // いいね機能用の状態（統合されたフックに置き換え）
  const [isLiked, setIsLiked] = useState(false);

  // モバイル最適化対応の状態管理
  const [isOnline, setIsOnline] = useState(true);
  const [appDimensions, setAppDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth > 768 && window.innerWidth <= 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth > 1024 : false
  });

  // 認証トークン管理
  const {
    session: authSession,
    isTokenValid,
    tokenError,
    isRecovering,
    handleReLogin,
    handleManualRecovery
  } = useAuthToken();

  // 統一されたエラーハンドリング
  const {
    errors,
    addError,
    resolveError,
    reportError,
    hasNetworkErrors,
    hasAuthErrors,
    hasCriticalErrors
  } = useErrorHandler({
    onError: (error) => {
      console.log('Error occurred:', error);
    },
    onErrorResolved: (errorId) => {
      console.log('Error resolved:', errorId);
    },
    maxErrors: 5,
    autoResolveDelay: 8000,
    enableLogging: true,
    enableReporting: true
  });

  // SpotifyLikesフックの使用
  const trackIds = songData?.spotifyTrackId ? [songData.spotifyTrackId] : [];

  const {
    likedTracks,
    toggleLike,
    error: spotifyLikesError,
    isLoading: spotifyLikesLoading,
    retryCount,
    maxRetries,
    refreshLikes,
    clearError: clearSpotifyLikesError
  } = useSpotifyLikes(session?.accessToken, trackIds);

  useEffect(() => {
    // デバッグ用
    // console.log("受け取った songData:", songData);
  }, [songData]);

  // ユーザーのプレイリスト一覧を取得
  const fetchUserPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists');
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error('プレイリスト取得エラー:', err);
    }
  };

  // プレイリストに追加
  const addTrackToPlaylist = async (track, playlistId) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: track.id,
          title: track.title,
          artists: track.artists,
          thumbnail_url: track.thumbnail,
          spotify_track_id: track.spotify_track_id,
          style_id: track.style_id || 2873,
          style_name: track.style_name || 'Others',
          release_date: track.release_date || track.releaseDate,
          genre_id: track.genre_id || null,
          genre_name: track.genre_name || null,
          vocal_id: track.vocal_id || null,
          vocal_name: track.vocal_name || null,
          is_favorite: false
        }),
      });

      if (!response.ok) {
        throw new Error('曲の追加に失敗しました');
      }

      console.log('プレイリストに追加しました！');
    } catch (err) {
      console.error('曲の追加に失敗しました:', err.message);
    }
  };

  // コンポーネントマウント時にプレイリスト一覧を取得
  useEffect(() => {
    if (session) {
      fetchUserPlaylists();
    }
  }, [session]);

  useEffect(() => {
    if (likedTracks && likedTracks instanceof Set && songData?.spotifyTrackId) {
      // likedTracksはSetオブジェクトなので、hasメソッドを使用
      const isTrackLiked = likedTracks.has(songData.spotifyTrackId);
      setIsLiked(isTrackLiked);
    }
  }, [likedTracks, songData?.spotifyTrackId]);

  // いいねの切り替え（統合されたフックを使用）
  const handleLikeToggle = async () => {
    if (!session?.accessToken) {
      addError(createError(
        'この機能を使用するにはSpotifyでログインしてください。',
        ERROR_TYPES.AUTHENTICATION,
        ERROR_SEVERITY.MEDIUM
      ));
      return;
    }

    if (spotifyLikesError) {
      addError(createError(
        `エラー: ${spotifyLikesError}`,
        ERROR_TYPES.SPOTIFY,
        ERROR_SEVERITY.HIGH
      ));
      return;
    }

    try {
      const success = await toggleLike(songData.spotifyTrackId);
      
      if (success) {
        // 成功した場合、ローカル状態を即座に更新
        setIsLiked(!isLiked);
      } else {
        addError(createError(
          'いいねの更新に失敗しました',
          ERROR_TYPES.SPOTIFY,
          ERROR_SEVERITY.HIGH
        ));
      }
    } catch (error) {
      addError(createError(
        'いいねの更新に失敗しました',
        ERROR_TYPES.SPOTIFY,
        ERROR_SEVERITY.HIGH
      ));
    }
  };

  // モバイル最適化対応のライフサイクルイベントハンドラー
  const handleAppActive = () => {
    // セッション状態を確認
    if (session && isTokenValid === false) {
      handleManualRecovery();
    }
  };

  const handleAppInactive = () => {
    // 必要に応じてデータの保存や状態のクリーンアップ
  };

  const handleNetworkChange = (online) => {
    setIsOnline(online);
    if (online) {
      addError(createError(
        'ネットワーク接続が復旧しました',
        ERROR_TYPES.NETWORK,
        ERROR_SEVERITY.LOW
      ));
    } else {
      addError(createError(
        'ネットワーク接続が失われました',
        ERROR_TYPES.NETWORK,
        ERROR_SEVERITY.HIGH
      ));
    }
  };

  const handleOrientationChange = (orientation) => {
    // 画面の向きに応じたレイアウト調整
  };

  const handleResize = (dimensions) => {
    setAppDimensions(dimensions);
    // リサイズログは出力しない（頻繁に発生するため）
  };

  const handleNetworkRetry = () => {
    // ネットワーク接続の再試行
    window.location.reload();
  };

  const handleErrorResolve = (errorId) => {
    resolveError(errorId);
  };

  const handleErrorReport = async (errorId) => {
    const success = await reportError(errorId);
    if (success) {
      console.log('Error reported successfully');
    }
  };

  if (!songData) {
    return <div>データが取得できませんでした。</div>;
  }

  // 優先順でアーティスト配列を取得
  const orderedArtists = determineArtistOrder(songData);
  // タイトル表示用
  const artistNamesStr = orderedArtists.map(a => a.name).join(", ");
  const pageTitleStr = `${artistNamesStr} - ${songData.title}`;

  const releaseDate = songData.releaseDate || "Unknown";
  const rawStyles = songData.styles || [];
  const styleId = rawStyles.length > 0 ? rawStyles[0] : 2873;
  const styleName = styleDisplayMap[styleId] || "Others";
  const styleSlug = Object.keys(styleIdMap).find((key) => styleIdMap[key] === styleId) || "others";
  const styleElement = (
    <Link href={`/styles/${styleSlug}/1`} style={{ fontSize: "1.1em", color: "#1e6ebb" }}>
      {styleName}
    </Link>
  );

  // アーティスト情報（優先順で上下に並べる）
  const artistElements =
    orderedArtists.length > 0 ? (
      orderedArtists.map((artist, index) => {
        const artistOrigin = artist.acf?.artistorigin || "Unknown";
        return (
          <div key={index} style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
            <img
              src={artist.acf?.spotify_artist_images || "/placeholder.jpg"}
              alt={artist.name}
              style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "10px", marginRight: "10px" }}
            />
            <Link href={`/${artist.slug}/`} style={{ fontSize: "1.2em", color: "#1e6ebb", fontWeight: "bold" }}>
                {artist.name} <span style={{ fontSize: "1em", color: "#777" }}>({artistOrigin})</span>
            </Link>
          </div>
        );
      })
    ) : (
      <p>Unknown Artist</p>
    );

  // ジャンル情報
  const genreElements =
    songData.genres?.length > 0 ? (
      songData.genres.map((genre, index) => (
        <div key={index}>
          <Link href={`/genres/${genre.slug}/1`} style={{ fontSize: "1.1em", color: "#1e6ebb" }}>
            {genre.name}
          </Link>
        </div>
      ))
    ) : (
      <p>Unknown</p>
    );

  // Spotifyリンクのみ
  const externalLinks = (
    <div style={{ marginTop: "10px" }}>
      {songData.spotifyTrackId && (
        <div>
          <Link
            href={`https://open.spotify.com/track/${songData.spotifyTrackId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none" }}
          >
              <img src="/svg/spotify.svg" alt="Spotify" style={{ width: "20px" }} />
              Spotify
              <img src="/svg/new-window.svg" alt="Open in new window" style={{ width: "20px" }} />
          </Link>
        </div>
      )}
    </div>
  );

  // カバー画像の表示ロジック
  const hasSpotifyImage = !!(songData.spotify_images && songData.spotify_images.trim() !== "");
  const coverImageUrl = hasSpotifyImage ? songData.spotify_images : (songData.thumbnail || "/placeholder.jpg");

  // Spotifyクレジット
  const spotifyCredit = hasSpotifyImage ? (
    <div className={artistStyles.spotifyImageCredit}>
      <span className={artistStyles.spotifyCreditText}>Cover art by</span>
      <Image
        src="/images/Full_Logo_Black_RGB.svg"
        alt="Spotify"
        height={20}
        width={67}
        className={artistStyles.spotifyLogo}
        style={{ width: "auto" }}
      />
    </div>
  ) : null;

  return (
    <MobileLifecycleManager
      onAppActive={handleAppActive}
      onAppInactive={handleAppInactive}
      onNetworkChange={handleNetworkChange}
      onOrientationChange={handleOrientationChange}
      onResize={handleResize}
    >
      <ThemeProvider theme={theme}>
        <Head>
          <title>{pageTitleStr} | TuneDive</title>
          <meta name="description" content={description} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Head>

        {/* 統一されたエラー表示 */}
        <UnifiedErrorDisplay
          errors={errors}
          onResolve={handleErrorResolve}
          onReport={handleErrorReport}
          maxDisplayed={3}
          showDetails={true}
          position="top-right"
        />

        {/* ネットワーク状態インジケーター */}
        <NetworkStatusIndicator
          isOnline={isOnline}
          onRetry={handleNetworkRetry}
        />

        {/* 認証エラーバナー */}
        <AuthErrorBanner
          error={tokenError}
          onReLogin={handleReLogin}
          onDismiss={() => {}}
        />

        {/* セッション復旧インジケーター */}
        <SessionRecoveryIndicator
          isRecovering={isRecovering}
          onManualRecovery={handleManualRecovery}
          onDismiss={() => {}}
        />

        {/* SpotifyLikesエラーハンドラー */}
        <SpotifyErrorHandler
          error={spotifyLikesError}
          isLoading={spotifyLikesLoading}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={refreshLikes}
          onClearError={clearSpotifyLikesError}
          onReLogin={handleReLogin}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            padding: "20px",
            flexWrap: "wrap",
          }}
        >
        {/* 左: 曲のサムネイル（アーティストページと同じデザイン） */}
        <div className={artistStyles.imageContainer}>
          <Image
            src={coverImageUrl}
            alt={`${songData.title}のカバー画像`}
            width={300}
            height={300}
            className={artistStyles.artistImage}
            priority
          />
          {spotifyCredit}
        </div>
        {/* 右: 曲の情報 */}
        <div
          style={{
            flexGrow: 1,
            marginLeft: "20px",
            backgroundColor: "#f9f9f9",
            padding: "15px",
            borderRadius: "8px",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          {/* タイトル部分 */}
          <div style={{ marginBottom: '0.5em' }}>
            <span style={{ fontSize: '0.9em', color: '#888', letterSpacing: '0.15em', fontWeight: 600 }}>SONG</span>
          </div>
          <h1 style={{ fontSize: "2.4em", fontWeight: "bold", marginBottom: "0.7em", lineHeight: 1.1 }}>{songData.title}</h1>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start', marginBottom: '1em', marginLeft: '16px' }}>
            {orderedArtists.length > 0 ? (
              orderedArtists.map((artist, index) => {
                const artistOrigin = artist.acf?.artistorigin || "Unknown";
                return (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Image
                        src={artist.acf?.spotify_artist_images || "/placeholder.jpg"}
                        alt={artist.name}
                        width={100}
                        height={100}
                        style={{ borderRadius: "12px", objectFit: "cover", background: "#aaa" }}
                      />
                      <div style={{ width: '100px', textAlign: 'center', marginTop: '6px' }}>
                        <Link href={`/${artist.slug}/`} style={{ fontSize: "1.08em", color: "#1e6ebb", fontWeight: "bold", textDecoration: "none" }}>
                          {artist.name}
                        </Link>
                        <div style={{ color: "#888", fontSize: "0.95em" }}>({artistOrigin})</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p>Unknown Artist</p>
            )}
          </div>
          {/* 曲情報テーブル風デザイン */}
          <div style={{ width: '100%', margin: '24px 0 12px 0' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80, color: '#555', fontWeight: 600 }}>Released:</div>
              <div style={{ flex: 1, marginLeft: '16px', color: '#222' }}>{formatYearMonth(releaseDate)}</div>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80, color: '#555', fontWeight: 600 }}>Style:</div>
              <div style={{ flex: 1, marginLeft: '16px' }}>{styleElement}</div>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80, color: '#555', fontWeight: 600, verticalAlign: 'top' }}>Genre:</div>
              <div style={{ flex: 1, marginLeft: '16px' }}>
                {songData.genres?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {songData.genres.map((genre, index) => (
                      <Link 
                        key={index} 
                        href={`/genres/${genre.slug}/1`} 
                        style={{ 
                          fontSize: '1.1em', 
                          color: '#1e6ebb', 
                          textDecoration: 'none',
                          padding: '2px 0',
                          display: 'inline',
                          width: 'fit-content',
                          maxWidth: 'fit-content',
                          transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#155a8a'}
                        onMouseLeave={(e) => e.target.style.color = '#1e6ebb'}
                      >
                        {genre.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span>Unknown</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80, color: '#555', fontWeight: 600 }}>Vocal:</div>
              <div style={{ flex: 1, marginLeft: '16px' }}>{renderVocalIcons(songData.vocals)}</div>
            </div>
            
            {/* いいねマークセクション */}
            {songData.spotifyTrackId && (
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 80, color: '#555', fontWeight: 600 }}>LIKE:</div>
                <div style={{ flex: 1, marginLeft: '16px' }}>
                  <button
                    onClick={handleLikeToggle}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "36px",
                      height: "36px",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "50%",
                      cursor: spotifyLikesLoading ? "not-allowed" : "pointer",
                      opacity: spotifyLikesLoading ? 0.5 : 1,
                      transition: "all 0.2s ease",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      if (!spotifyLikesLoading) {
                        e.target.style.backgroundColor = "#f0f0f0";
                        e.target.style.transform = "scale(1.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!spotifyLikesLoading) {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.transform = "scale(1)";
                      }
                    }}
                    title={spotifyLikesError ? `エラー: ${spotifyLikesError}` : (isLiked ? "いいねを解除" : "いいねを追加")}
                    disabled={spotifyLikesLoading}
                  >
                    <img
                      src={isLiked ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
                      alt="Like"
                      style={{ 
                        width: "18px", 
                        height: "18px",
                        filter: spotifyLikesError ? "grayscale(100%)" : "none"
                      }}
                    />
                    {spotifyLikesLoading && (
                      <div style={{
                        position: "absolute",
                        top: "-3px",
                        right: "-3px",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        border: "2px solid #ccc",
                        borderTop: "2px solid #007bff",
                        animation: "spin 1s linear infinite"
                      }} />
                    )}
                  </button>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80, color: '#555', fontWeight: 600 }}>LINK:</div>
              <div style={{ flex: 1, marginLeft: '16px' }}>
                {songData.spotifyTrackId && (
                  <Link
                    href={`https://open.spotify.com/track/${songData.spotifyTrackId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      display: "inline-flex", 
                      alignItems: "center", 
                      gap: "5px", 
                      textDecoration: "none", 
                      color: "#1e6ebb", 
                      fontSize: "1.08em",
                      padding: "2px 0",
                      transition: "color 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.target.style.color = "#155a8a"}
                    onMouseLeave={(e) => e.target.style.color = "#1e6ebb"}
                  >
                    <img src="/svg/spotify.svg" alt="Spotify" style={{ width: "20px" }} />
                    Spotify
                    <img src="/svg/new-window.svg" alt="Open in new window" style={{ width: "20px" }} />
                  </Link>
                )}
              </div>
            </div>
            {/* プレイリスト追加セクション */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '8px 0', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80, color: '#555', fontWeight: 600 }}>PLAYLIST:</div>
              <div style={{ flex: 1, marginLeft: '16px' }}>
                {session?.user ? (
                  <button
                    onClick={() => {
                      setTrackToAdd({
                        id: songData.id,
                        title: songData.title,
                        artists: songData.artists,
                        thumbnail: songData.thumbnail || songData.spotify_images,
                        spotify_track_id: songData.spotifyTrackId,
                        style_id: songData.styles?.[0] || 2873,
                        style_name: songData.styles?.[0] ? styleDisplayMap[songData.styles[0]] : 'Others',
                        release_date: songData.releaseDate,
                        // ジャンル情報を正しい形式で設定
                        genres: songData.genres || [],
                        genre_id: songData.genres?.[0]?.term_id || null,
                        genre_name: songData.genres?.[0]?.name || null,
                        // ボーカル情報を正しい形式で設定
                        vocals: songData.vocals || [],
                        vocal_id: songData.vocals?.[0]?.term_id || null,
                        vocal_name: songData.vocals?.[0]?.name || null,
                        // スタイル情報を正しい形式で設定
                        styles: songData.styles || [],
                        // その他の必要な情報
                        spotifyTrackId: songData.spotifyTrackId,
                        spotify_images: songData.spotify_images
                      });
                      setShowCreateModal(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      backgroundColor: "#1e6ebb",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.9em",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#155a8a"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#1e6ebb"}
                  >
                    <img src="/svg/add.svg" alt="" style={{ width: 16 }} />
                    プレイリストに追加
                  </button>
                ) : (
                  <div style={{ color: '#888', fontSize: '0.9em' }}>
                    プレイリストに追加するにはSpotifyでログインしてください
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Spotifyプレーヤーまたはログイン促進メッセージ */}
      {songData.spotifyTrackId && (
        accessToken ? (
          <SongDetailSpotifyPlayer 
            accessToken={accessToken} 
            songData={songData} 
          />
        ) : (
          <div style={{
            padding: '20px',
            backgroundColor: '#000',
            borderRadius: '8px',
            margin: '20px 0',
            border: '1px solid #333',
            color: '#fff',
            textAlign: 'center'
          }}>
            <svg width="auto" height="30" viewBox="0 0 823.46 225.25" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '15px' }}>
              <defs>
                <style>{`.cls-1{fill:#1ed760;stroke-width:0px;}`}</style>
              </defs>
              <path className="cls-1" d="m125.52,3.31C65.14.91,14.26,47.91,11.86,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C232.89,56.59,185.89,5.7,125.52,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"/>
              <path className="cls-1" d="m318.54,169.81c-18.87,0-35.07-6.53-41.84-13.95-.64-.73-.73-1.13-.73-2.02v-22.09c0-1.05.89-1.45,1.61-.56,8.14,10.16,25.48,18.46,39.67,18.46,11.29,0,18.87-3.06,18.87-13.06,0-5.97-2.82-9.84-18.22-14.19l-8.87-2.5c-20.56-5.8-33.06-12.66-33.06-32.33,0-17.41,16.12-32.73,43.05-32.73,13.22,0,26.36,4.11,33.94,9.76.64.48.89.97.89,1.85v20.08c0,1.37-1.13,1.77-2.18.89-6.13-5.08-17.98-11.93-32.01-11.93s-20.64,6.29-20.64,12.09c0,6.13,4.27,7.82,19.51,12.34l7.58,2.26c23.46,7.01,33.06,16.85,33.06,33.14,0,20.96-17.41,34.51-40.63,34.51Zm164.39-42.09c0-12.82,8.87-22.33,21.37-22.33s21.28,9.51,21.28,22.33-8.87,22.33-21.28,22.33-21.37-9.51-21.37-22.33Zm21.28,42.09c26.04,0,44.18-18.62,44.18-42.09s-18.14-42.09-44.18-42.09-44.1,18.46-44.1,42.09,17.98,42.09,44.1,42.09Zm157.22-89.01v6.77h-13.71c-.73,0-1.13.4-1.13,1.13v16.12c0,.73.4,1.13,1.13,1.13h13.71v60.79c0,.73.4,1.13,1.13,1.13h20.64c.73,0,1.13-.4,1.13-1.13v-60.79h17.66l25.64,55.71-13.79,30.31c-.4.89.08,1.29.89,1.29h22.01c.73,0,1.05-.16,1.37-.89l45.55-103.52c.32-.73-.08-1.29-.89-1.29h-20.64c-.73,0-1.05.16-1.37.89l-20.8,49.99-20.88-49.99c-.32-.73-.64-.89-1.37-.89h-33.38v-5.32c0-8.71,5.89-12.74,13.46-12.74,4.51,0,9.43,2.34,12.9,4.43.81.48,1.37-.08,1.05-.81l-7.26-17.33c-.24-.56-.56-.89-1.13-1.21-3.55-1.85-9.35-3.47-15-3.47-17.09,0-26.93,13.06-26.93,29.67Zm-243,88.52c20.64,0,35.47-17.82,35.47-41.76s-15-41.44-35.64-41.44c-15.32,0-24.19,9.35-29.35,18.7v-16.12c0-.73-.4-1.13-1.13-1.13h-20.24c-.73,0-1.13.4-1.13,1.13v103.44c0,.73.4,1.13,1.13,1.13h20.24c.73,0,1.13-.4,1.13-1.13v-41.36c5.16,9.35,13.87,18.54,29.51,18.54Zm172.21-.32c6.77,0,13.3-1.77,17.17-4.03.56-.32.64-.64.64-1.21v-15.32c0-.81-.4-1.05-1.13-.64-2.34,1.29-5.4,2.34-9.59,2.34-6.61,0-10.8-3.87-10.8-12.42v-31.77h20.16c.73,0,1.13-.4,1.13-1.13v-16.12c0-.73-.4-1.13-1.13-1.13h-20.16v-21.04c0-.89-.56-1.37-1.37-.73l-36.04,28.38c-.48.4-.64.81-.64,1.45v9.19c0,.73.4,1.13,1.13,1.13h14.03v35.15c0,19.03,10.96,27.9,26.61,27.9Zm23.3-105.29c0,7.26,5.64,12.74,13.38,12.74s13.54-5.48,13.54-12.74-5.64-12.74-13.54-12.74-13.38,5.48-13.38,12.74Zm3.14,104.17h20.64c.73,0,1.13-.4,1.13-1.13v-78.04c0-.73-.4-1.13-1.13-1.13h-20.64c-.73,0-1.13.4-1.13,1.13v78.04c0,.73.4,1.13,1.13,1.13Zm-228.65-40.47c3.71-12.42,12.25-21.93,23.86-21.93s18.7,8.38,18.7,22.09-7.66,22.25-18.7,22.25-20.16-10.64-23.86-22.41Z"/>
              <path className="cls-1" d="m810.1,92.31c-1.06-1.83-2.53-3.26-4.41-4.3-1.88-1.03-3.98-1.55-6.32-1.55s-4.44.52-6.32,1.55c-1.88,1.04-3.35,2.47-4.41,4.3-1.06,1.83-1.59,3.9-1.59,6.21s.53,4.34,1.59,6.17c1.06,1.83,2.53,3.26,4.41,4.3,1.88,1.04,3.98,1.55,6.32,1.55s4.44-.52,6.32-1.55,3.35-2.47,4.41-4.3c1.06-1.83,1.59-3.88,1.59-6.17s-.53-4.38-1.59-6.21Zm-1.93,11.36c-.86,1.52-2.06,2.7-3.59,3.56-1.53.85-3.27,1.28-5.2,1.28s-3.72-.43-5.25-1.28c-1.53-.85-2.72-2.04-3.57-3.56-.85-1.51-1.27-3.23-1.27-5.15s.42-3.63,1.27-5.13c.85-1.5,2.04-2.68,3.57-3.53,1.53-.85,3.28-1.28,5.25-1.28s3.67.43,5.2,1.28c1.53.85,2.73,2.04,3.59,3.56.86,1.52,1.29,3.23,1.29,5.15s-.43,3.59-1.29,5.11Z"/>
              <path className="cls-1" d="m803.56,98.29c.82-.6,1.23-1.4,1.23-2.39s-.4-1.83-1.2-2.43c-.8-.6-1.96-.9-3.48-.9h-5.36v11.2h2.59v-4.45h1.41l3.41,4.45h3.18l-3.73-4.72c.79-.15,1.46-.4,1.96-.77Zm-3.86-.99h-2.36v-2.74h2.45c.73,0,1.29.11,1.68.34.39.23.59.58.59,1.06,0,.45-.21.79-.61,1.01-.41.23-.99.34-1.75.34Z"/>
            </svg>
            <p style={{ margin: '0 0 10px 0' }}>
              曲の再生にはSpotifyアカウントでのログインが必要です。
            </p>
            <p style={{ fontSize: '0.9em', color: '#ccc', margin: 0 }}>
              画面右上のボタンからサインインしてください。
            </p>
          </div>
        )
      )}
      
      {/* プレイリスト追加モーダル */}
      {showCreateModal && trackToAdd && (
        <CreatePlaylistModal
          isOpen={showCreateModal && !showCreateNewPlaylistModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => {
            console.log('🎯 onCreate called with:', data);
            
            if (data.action === 'create_new') {
              // 新規作成モーダルを開く
              console.log('🎯 新規プレイリスト作成モーダルを開きます');
              setShowCreateNewPlaylistModal(true);
              return;
            }
          }}
          trackToAdd={trackToAdd}
          userPlaylists={userPlaylists}
          onAddToPlaylist={addTrackToPlaylist}
        />
      )}

      {/* 新規プレイリスト作成モーダル */}
      {showCreateNewPlaylistModal && trackToAdd && (
        <CreateNewPlaylistModal
          isOpen={showCreateNewPlaylistModal}
          onClose={() => {
            setShowCreateNewPlaylistModal(false);
            setShowCreateModal(false);
          }}
          onCreate={(newPlaylist) => {
            console.log('✅ 新規プレイリスト作成完了:', newPlaylist);
            setShowCreateNewPlaylistModal(false);
            setShowCreateModal(false);
            // プレイリスト一覧を更新
            fetchUserPlaylists();
          }}
          trackToAdd={trackToAdd}
        />
      )}
      
      </ThemeProvider>
    </MobileLifecycleManager>
  );
} 
