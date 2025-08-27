'use client';

import { useState, useEffect } from 'react';
import { useAuthToken } from '@/components/useAuthToken';
import { useSpotifyLikes } from '@/components/SpotifyLikes';
import AuthErrorBanner from '@/components/AuthErrorBanner';
import SpotifyErrorHandler from '@/components/SpotifyErrorHandler';
import SessionRecoveryIndicator from '@/components/SessionRecoveryIndicator';
import MobileLifecycleManager from '@/components/MobileLifecycleManager';
import NetworkStatusIndicator from '@/components/NetworkStatusIndicator';
import Link from 'next/link';
import Image from 'next/image';
import { config } from '@/config/config';
import Pagination from '@/components/Pagination';
import SongList from '@/components/SongList';
import he from 'he';
import { useRouter } from 'next/navigation';
import styles from './StylePageClient.module.css';

// HTML エンティティをデコードするヘルパー関数
function decodeHtml(html = "") {
  return html ? he.decode(html) : "";
}

// アーティスト名＋国籍表示用関数
function formatArtistsWithOrigin(artists = []) {
  if (!Array.isArray(artists) || artists.length === 0) {
    return "Unknown Artist";
  }
  const formattedElements = artists.map((artist, index) => {
    let displayName = artist.name || "Unknown Artist";
    if (artist.prefix === "1" && !/^The\s+/i.test(displayName)) {
      displayName = "The " + displayName;
    }
    const origin = artist.artistorigin || artist.acf?.artistorigin;
    const originText = origin && origin !== "Unknown" ? ` (${origin})` : "";
    return (
      <span key={artist.id || index}>
        {displayName}{originText}{index !== artists.length - 1 ? ', ' : ''}
      </span>
    );
  });
  return formattedElements;
}

export default function StylePageClient({ styleData, initialPage = 1, autoPlayFirst }) {
  const { 
    session, 
    isTokenValid, 
    tokenError, 
    isRecovering,
    handleReLogin, 
    handleManualRecovery 
  } = useAuthToken();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [likedSongs, setLikedSongs] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [viewCounts, setViewCounts] = useState({});
  const [userViewCounts, setUserViewCounts] = useState({});
  const [likeRefreshKey, setLikeRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [appDimensions, setAppDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth > 768 && window.innerWidth <= 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth > 1024 : false
  });
  const songsPerPage = config.pagination.itemsPerPage;
  const accessToken = session?.accessToken;
  const songs = Array.isArray(styleData?.songs) ? styleData.songs : [];
  
  // アーティスト配列生成ロジック - すべての項目を含む
  const wpStylePosts = songs.map(song => {
    let artists = [];
    if (Array.isArray(song.artists) && song.artists.length > 0) {
      artists = song.artists.map(a => ({
        ...a,
        acf: {
          ...(a.acf || {}),
          artistorigin: a.artistorigin || a.acf?.artistorigin || song.acf?.artist_acf?.artistorigin || "",
        }
      }));
    } else if (song.artist) {
      artists = [{
        name: song.artist,
        acf: {
          ...(song.acf?.artist_acf || {}),
          artistorigin: song.acf?.artist_acf?.artistorigin || "",
        },
        id: song.artist_id || undefined,
        slug: song.artist_slug || undefined,
      }];
    }
    const spotify_track_id = song.spotify_track_id || song.spotifyTrackId || song.acf?.spotify_track_id || song.acf?.spotifyTrackId || '';
    const ytvideoid = song.ytvideoid || song.youtube_id || song.acf?.ytvideoid || song.acf?.youtube_id || song.videoId || '';
    
    // すべての項目を含む完全なデータ構造
    return {
      // 基本項目
      id: song.id,
      title: song.title,
      titleSlug: song.titleSlug,
      slug: song.slug,
      
      // アーティスト・ジャンル・スタイル・ボーカル情報
      artists: artists,
      genres: song.genres,
      styles: song.styles,
      vocals: song.vocals,
      
      // 日付・リリース情報
      date: song.releaseDate || song.date || song.post_date || '',
      releaseDate: song.releaseDate,
      
      // メディア情報
      thumbnail: song.thumbnail,
      youtubeId: ytvideoid,
      videoId: song.videoId,
      
      // Spotify情報
      spotifyTrackId: spotify_track_id,
      
      // コンテンツ情報
      content: song.content ? { rendered: song.content } : undefined,
      
      // ACF情報（完全に保持）
      acf: {
        ...song.acf,
        spotify_track_id,
        ytvideoid,
        youtube_id: ytvideoid,
      },
      
      // データ構造の互換性のため
      genre_data: song.genres,
      vocal_data: song.vocals,
      style: song.styles,
      
      // その他の項目も保持
      custom_fields: song.custom_fields,
      categories: song.categories,
      category_data: song.category_data,
      featured_media_url: song.featured_media_url,
    };
  }).filter(song => {
    const hasSpotifyId = song.acf?.spotify_track_id || song.spotifyTrackId;
    return hasSpotifyId;
  });

  // Spotify APIからお気に入り情報を取得
  const trackIds = wpStylePosts.map(song => song.acf?.spotify_track_id || song.spotifyTrackId).filter(Boolean);
  const { 
    likedTracks, 
    toggleLike, 
    error: likesError, 
    isLoading: likesLoading,
    retryCount,
    maxRetries,
    refreshLikes,
    clearError: clearLikesError
  } = useSpotifyLikes(accessToken, trackIds);

  if (!styleData) {
    return <div className="text-red-500">データの取得に失敗しました。</div>;
  }

  const totalSongs = styleData?.total;
  const totalPages = styleData?.totalPages;

  // 表示範囲の計算
  const startIndex = Math.min((currentPage - 1) * songsPerPage + 1, totalSongs);
  const endIndex = Math.min(currentPage * songsPerPage, totalSongs);

  // ページ末尾到達時の処理
  const handlePageEnd = () => {
    if (currentPage < totalPages) {
      router.push(`/styles/${styleData.slug}/${currentPage + 1}?autoplay=1`);
    }
  };

  // Pagination に渡す関数
  const handlePageChange = (arg) => {
    const newPage = typeof arg === 'number' ? arg : parseInt(arg?.target?.value || arg?.target?.innerText || '1', 10);
    if (!isNaN(newPage) && newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
      router.push(`/styles/${styleData.slug}/${newPage}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // autoPlayFirstがtrueの場合に最初の曲を自動再生する
  useEffect(() => {
    if (autoPlayFirst && wpStylePosts.length > 0) {
      // 自動再生の処理
    }
  }, [autoPlayFirst, wpStylePosts.length, currentPage, styleData.slug]);

  const decodedGenreName = decodeHtml(styleData?.name);

  // 視聴回数を取得する関数
  const fetchViewCounts = async () => {
    setViewCounts({});
  };

  // いいねと視聴回数を取得
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (songs && songs.length > 0) {
        if (isMounted) {
          await fetchViewCounts();
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [songs, likeRefreshKey]);

  // アプリがアクティブになった時の処理
  const handleAppActive = () => {
    console.log('📱 App became active, refreshing data...');
    // セッション状態を確認
    if (session && isTokenValid === false) {
      handleManualRecovery();
    }
  };

  // アプリが非アクティブになった時の処理
  const handleAppInactive = () => {
    console.log('📱 App became inactive');
    // 必要に応じてデータの保存や状態のクリーンアップ
  };

  // ネットワーク状態変更時の処理
  const handleNetworkChange = (online) => {
    setIsOnline(online);
    if (online) {
      console.log('📱 Network restored, refreshing data...');
      // ネットワーク復旧時の処理
    }
  };

  // 画面の向き変更時の処理
  const handleOrientationChange = (orientation) => {
    console.log('📱 Orientation changed:', orientation);
    // 画面の向きに応じたレイアウト調整
  };

  // ウィンドウサイズ変更時の処理
  const handleResize = (dimensions) => {
    setAppDimensions(dimensions);
    console.log('📱 Resize:', dimensions);
  };

  // ネットワーク再試行時の処理
  const handleNetworkRetry = () => {
    console.log('📱 Network retry requested');
    // ネットワーク接続の再試行
    window.location.reload();
  };

  return (
    <MobileLifecycleManager
      onAppActive={handleAppActive}
      onAppInactive={handleAppInactive}
      onNetworkChange={handleNetworkChange}
      onOrientationChange={handleOrientationChange}
      onResize={handleResize}
    >
      <div className={styles.container}>
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
          error={likesError}
          isLoading={likesLoading}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={refreshLikes}
          onClearError={clearLikesError}
          onReLogin={handleReLogin}
        />

        <div className={styles.pageInfo} style={{ marginLeft: '1rem', paddingLeft: '1rem' }}>
          <div className={styles.styleLabel} style={{ fontSize: '0.85em', color: '#888', marginBottom: '2px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            STYLE
          </div>
          <h1 className={styles.styleTitle} style={{ textAlign: 'left', fontSize: '2.2em', fontWeight: 800, margin: 0, color: '#222', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            {decodedGenreName || 'スタイル名不明'}
          </h1>
          <div className={styles.divider} style={{ borderBottom: '2px solid #e0e0e0', width: '60px', margin: '12px 0 12px 0' }} />
          <div className={styles.pageDetails} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
            <div className={styles.songCount} style={{ fontSize: '0.95em', color: '#555', display: 'block', marginBottom: '4px' }}>
              全 {totalSongs} 曲中 {startIndex} - {endIndex} 曲を表示
            </div>
            <div className={styles.pageNumber} style={{ fontSize: '0.9em', color: '#888', display: 'block' }}>
              ページ {currentPage} / {totalPages}
            </div>
          </div>
        </div>

        <SongList 
          songs={wpStylePosts} 
          styleSlug={styleData.slug} 
          styleName={styleData?.name} 
          total={totalSongs}
          songsPerPage={songsPerPage}
          currentPage={currentPage}
          onPageEnd={handlePageEnd}
          pageType={'style'}
          autoPlayFirst={autoPlayFirst}
          accessToken={accessToken}
          likedTracks={likedTracks}
          onLikeToggle={toggleLike}
          source={`styles/${styleData.slug}/${currentPage}`}
        />

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </MobileLifecycleManager>
  );
} 