'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getThumbnailPath } from '@/lib/utils';
import SongList from '@/components/SongList';
import Pagination from '@/components/Pagination';
import Link from 'next/link';
import styles from '../ArtistPage.module.css';
import he from 'he'; // 追加: HTMLエンティティデコード用

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

function normalizeDateString(dateStr) {
  if (!dateStr) return null;
  // 例: 2016.04.21 → 20160421, 2016-04-21 → 20160421
  return dateStr.replace(/[^0-9]/g, '').padEnd(8, '0');
}

function calculateAge(birthDate, diedDate) {
  if (!birthDate) return null;
  const normBirth = normalizeDateString(birthDate);
  const year = normBirth.substring(0, 4);
  const month = normBirth.substring(4, 6);
  const day = normBirth.substring(6, 8);

  const birth = new Date(year, month - 1, day);

  let endDate = new Date();
  if (diedDate) {
    const normDied = normalizeDateString(diedDate);
    if (normDied.length === 8) {
      const diedYear = normDied.substring(0, 4);
      const diedMonth = normDied.substring(4, 6);
      const diedDay = normDied.substring(6, 8);
      endDate = new Date(diedYear, diedMonth - 1, diedDay);
    }
  }

  let age = endDate.getFullYear() - birth.getFullYear();
  const monthDiff = endDate.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// Props: artistData, songs (現在のページ分), currentPage, totalPages, totalSongs, stylePercentages, topGenres, members, relatedArtists, startSongNumber, endSongNumber
export default function ArtistPageClient({ 
  artistData, 
  songs, 
  currentPage, 
  totalPages, 
  totalSongs, 
  stylePercentages, 
  topGenres, 
  members, 
  relatedArtists, 
  startSongNumber, 
  endSongNumber,
  accessToken = null 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const autoPlayParam = searchParams.get("autoplay") || "";
  const autoPlayFirst = (autoPlayParam === "1");

  const safeSongs = songs || [];
  const safeCurrentPage = currentPage || 1;
  const safeTotalPages = totalPages || 1;
  const safeTotalSongs = totalSongs || 0;
  const safeArtistData = artistData || { acf: {}, name: 'Unknown Artist', description: '', slug: '' };

  // デバッグログを削除

  const artistImageUrl = safeArtistData.acf?.artist_image
    ? getThumbnailPath(safeArtistData.acf.artist_image)
    : safeArtistData.acf?.spotify_artist_images
      ? safeArtistData.acf.spotify_artist_images
      : '/images/default-artist.png';

  const isUsingSpotifyImage = !safeArtistData.acf?.artist_image && !!safeArtistData.acf?.spotify_artist_images;

  const hasValidArtistImage = artistImageUrl !== '/images/default-artist.png';

  const [isPlaying, setIsPlaying] = useState(autoPlayFirst);

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
    session,
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

  // SongListが期待する形式に変換
  const normalizedSongs = (safeSongs || []).map(song => {
    // アーティスト情報の正規化（StylePageClientから流用）
    // アーティストページでは、曲の `custom_fields.categories` にアーティスト情報が入っている
    let artists = [];
    if (Array.isArray(song.custom_fields?.categories) && song.custom_fields.categories.length > 0) {
      artists = song.custom_fields.categories.map(cat => ({
        ...cat,
        acf: cat.acf || {},
      }));
    }

    // YouTube IDの正規化（StylePageClientから流用）
    const ytvideoid = song.acf?.ytvideoid || '';
    
    // Spotify Track IDの正規化（StylePageClientから流用）
    const spotify_track_id = song.acf?.spotify_track_id || '';

    return {
      ...song,
      title: song.title, // artist pageでは `song.title` がオブジェクトなのでそのまま渡す
      artists,
      acf: {
        ...song.acf,
        spotify_track_id,
        ytvideoid,
      },
      date: song.date || '',
      // スタイルページと異なり、アーティストページでは `featured_media_url` をサムネイルの元情報として使う
      thumbnail: song.featured_media_url, 
      youtubeId: ytvideoid,
      spotifyTrackId: spotify_track_id,
      genre_data: song.genre_data,
      vocal_data: song.vocal_data,
      style: song.style_data,
      slug: song.slug,
      content: song.content,
      // スタイル・ジャンル情報を保持（アーティストページのデータ構造に合わせる）
      styles: song.style || song.styles,
      genres: song.genre || song.genres,
    };
  });

  // SpotifyLikesフックの使用
  const trackIds = normalizedSongs
    .filter(song => song.spotifyTrackId)
    .map(song => song.spotifyTrackId);

  const {
    likedTracks,
    toggleLike,
    error: likesError,
    isLoading: likesLoading,
    retryCount,
    maxRetries,
    refreshLikes,
    clearError: clearLikesError
  } = useSpotifyLikes(session?.accessToken, trackIds);

  const handlePageEnd = useCallback(() => {
    if (safeCurrentPage < safeTotalPages) {
      if (router && safeArtistData.slug) {
        router.push(`/${safeArtistData.slug}/${safeCurrentPage + 1}?autoplay=1`);
      } else {
        console.error('Navigation failed: Router or artist slug is missing');
      }
    }
  }, [safeCurrentPage, safeTotalPages, safeArtistData.slug, router]);

  useEffect(() => {
    if (autoPlayFirst && safeSongs.length > 0) {
      const firstSongItem = document.querySelector('li[class*="songItem"]');
      if (firstSongItem) {
        const playButton = firstSongItem.querySelector('button[class*="thumbnailContainer"]');
        if (playButton) {
          setTimeout(() => playButton.click(), 500);
        }
      }
    }
  }, [autoPlayFirst, safeSongs]);

  const handlePageChange = (newPage) => {
    if (safeArtistData.slug) {
      router.push(`/${safeArtistData.slug}/${newPage}`);
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

  const age = calculateAge(safeArtistData.acf?.artistborn, safeArtistData.acf?.artistdied);
  const occupation = safeArtistData.acf?.Occupation?.map(o => o.label).join(', ');

  // --- "The" 接頭辞フラグに基づき "The " を付与する処理 ---
  let displayName = safeArtistData.name;
  // thePrefix（propsやartistData.thePrefix）またはthe_prefixで判定
  const isThe = (safeArtistData.thePrefix === 'The') ||
    safeArtistData.the_prefix === "1" ||
    safeArtistData.the_prefix === 1 ||
    safeArtistData.the_prefix === true ||
    safeArtistData.the_prefix === "true" ||
    safeArtistData.the_prefix === "on";
  if (isThe && typeof safeArtistData.name === 'string' && !safeArtistData.name.toLowerCase().startsWith('the ')) {
    displayName = `The ${safeArtistData.name}`;
  }
  // --- ここまで ---

  // --- SongListに渡す前に、StylePageClientのロジックを参考にデータを整形 ---
  // const normalizedSongs = (safeSongs || []).map(song => {
  //   // アーティスト情報の正規化（StylePageClientから流用）
  //   // アーティストページでは、曲の `custom_fields.categories` にアーティスト情報が入っている
  //   let artists = [];
  //   if (Array.isArray(song.custom_fields?.categories) && song.custom_fields.categories.length > 0) {
  //     artists = song.custom_fields.categories.map(cat => ({
  //       ...cat,
  //       acf: cat.acf || {},
  //     }));
  //   }

  //   // YouTube IDの正規化（StylePageClientから流用）
  //   const ytvideoid = song.acf?.ytvideoid || '';
    
  //   // Spotify Track IDの正規化（StylePageClientから流用）
  //   const spotify_track_id = song.acf?.spotify_track_id || '';

  //   return {
  //     ...song,
  //     title: song.title, // artist pageでは `song.title` がオブジェクトなのでそのまま渡す
  //     artists,
  //     acf: {
  //       ...song.acf,
  //       spotify_track_id,
  //       ytvideoid,
  //     },
  //     date: song.date || '',
  //     // スタイルページと異なり、アーティストページでは `featured_media_url` をサムネイルの元情報として使う
  //     thumbnail: song.featured_media_url, 
  //     youtubeId: ytvideoid,
  //     spotifyTrackId: spotify_track_id,
  //     genre_data: song.genre_data,
  //     vocal_data: song.vocal_data,
  //     style: song.style_data,
  //     slug: song.slug,
  //     content: song.content,
  //     // スタイル・ジャンル情報を保持（アーティストページのデータ構造に合わせる）
  //     styles: song.style || song.styles,
  //     genres: song.genre || song.genres,
  //   };
  // });

  return (
    <MobileLifecycleManager
      onAppActive={handleAppActive}
      onAppInactive={handleAppInactive}
      onNetworkChange={handleNetworkChange}
      onOrientationChange={handleOrientationChange}
      onResize={handleResize}
    >
      <div className={styles.artistPageContainer}>
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
          error={likesError}
          isLoading={likesLoading}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={refreshLikes}
          onClearError={clearLikesError}
          onReLogin={handleReLogin}
        />

        <header className={styles.artistHeader}>
          <div className={styles.artistProfile}>
            {hasValidArtistImage && (
              <div className={styles.imageContainer}>
                <Image
                  src={artistImageUrl}
                  alt={safeArtistData.name}
                  width={300}
                  height={300}
                  className={styles.artistImage}
                  priority
                />
                {isUsingSpotifyImage && (
                  <div className={styles.spotifyImageCredit}>
                    <span className={styles.spotifyCreditText}>Artist Image by</span>
                    <Image
                      src="/images/Full_Logo_Black_RGB.svg"
                      alt="Spotify Logo"
                      height={20}
                      width={67}
                      className={styles.spotifyLogo}
                    />
                  </div>
                )}
              </div>
            )}
            <div className={styles.artistInfo}>
              <div className={styles.artistNameContainer}>
                <h1 className={styles.artistName}>
                  {displayName}
                  {safeArtistData.acf?.artistorigin && (
                    <Image
                      src={`/svg/${safeArtistData.acf.artistorigin.toLowerCase()}.svg`}
                      alt={safeArtistData.acf.artistorigin}
                      width={36}
                      height={24}
                      className={styles.flag}
                    />
                  )}
                </h1>
                {safeArtistData.acf?.artistjpname && (
                  <p className={styles.artistJpName}>{safeArtistData.acf.artistjpname}</p>
                )}
              </div>
              
              {occupation && (
                <p className={styles.occupation}>{occupation}</p>
              )}
              
              {safeArtistData.acf?.artistactiveyearstart && (
                <p className={styles.activeYear}>Active: {safeArtistData.acf.artistactiveyearstart}</p>
              )}
              
              {safeArtistData.acf?.artistborn && (
                <p className={styles.birthInfo}>
                  Born: {safeArtistData.acf.artistborn.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3')}
                  {/* Diedがなければ年齢を表示 */}
                  {!(safeArtistData.acf?.artistdied && safeArtistData.acf.artistdied.length >= 8) && age && ` (${age})`}
                </p>
              )}
              {safeArtistData.acf?.artistdied && safeArtistData.acf.artistdied.length >= 8 && (
                <p className={styles.birthInfo}>
                  Died: {safeArtistData.acf.artistdied.replace(/(\d{4})[./-]?(\d{2})[./-]?(\d{2})/, '$1/$2/$3')} ({age})
                </p>
              )}
              
              {safeArtistData.description && (
                <p className={styles.artistDescription}>{safeArtistData.description}</p>
              )}

              {/* --- メンバー表示セクション (ここに移動) --- */} 
              {members && members.length > 0 && (
                <div className={styles.membersSection}>
                  <h3 className={styles.membersTitle}>Members:</h3>
                  <ul className={styles.membersList}>
                    {members.map(member => {
                      let memberDisplayName = member.name;
                      if (
                        member &&
                        String(member.the_prefix).trim() === '1' &&
                        typeof member.name === 'string' &&
                        !member.name.toLowerCase().startsWith('the ')
                      ) {
                        memberDisplayName = `The ${member.name}`;
                      }
                      return (
                        <li key={member.slug} className={styles.memberItem}>
                          <Link href={`/${member.slug}/1`} className={styles.memberLink}>
                            {`${memberDisplayName} (${member.count || 0})`}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {/* --- ここまで --- */} 
              
              {/* --- 関連アーティスト表示セクション --- */}
              {relatedArtists && relatedArtists.length > 0 && (
                <>
                  <div className={styles.relatedArtistsSection}>
                    <h3 className={styles.relatedArtistsTitle}>Related Artists:</h3>
                    <div className={styles.relatedArtistsList}>
                      {relatedArtists.map((artist, index) => (
                        <span key={artist.slug}>
                          <Link
                            href={`/${artist.slug}/1`}
                            className={styles.relatedArtistLink}
                          >
                            {artist.name}
                          </Link>
                          {index < relatedArtists.length - 1 && <span className={styles.relatedArtistsSeparator}> | </span>}
                        </span>
                      ))}
                    </div>
                    <div className={styles.relatedArtistsNote}>
                      Related artists are based on Spotify data and may be processed or filtered for display.
                    </div>
                  </div>
                  <hr className={styles.divider} />
                </>
              )}
              {/* --- End Related Artists Section --- */}
              
              <div className={styles.socialLinks}>
                {safeArtistData.acf?.wikipedia_page && (
                  <a
                    href={`https://en.wikipedia.org/wiki/${safeArtistData.acf.wikipedia_page}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                  >
                    <Image
                      src="/images/logo_wikipedia.svg"
                      alt="Wikipedia"
                      width={20}
                      height={20}
                      className={styles.socialIcon}
                    />
                    <span>Wikipedia Page</span>
                  </a>
                )}
                
                {safeArtistData.acf?.spotify_artist_id && (
                  <a
                    href={`https://open.spotify.com/artist/${safeArtistData.acf.spotify_artist_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                  >
                    <Image
                      src="/images/Spotify_Icon_RGB_Green.png"
                      alt="Spotify"
                      width={20}
                      height={20}
                      className={styles.socialIcon}
                    />
                    <span>{safeArtistData.name} Spotify Page</span>
                  </a>
                )}
                
                {safeArtistData.acf?.youtube_channel && (
                  <a
                    href={`https://www.youtube.com/channel/${safeArtistData.acf.youtube_channel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                  >
                    <Image
                      src="/images/youtube.svg"
                      alt="YouTube"
                      width={20}
                      height={20}
                      className={styles.socialIcon}
                    />
                    <span>{safeArtistData.name} YouTube Channel</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>
        {/* --- Style Breakdown Section --- */}
        {stylePercentages && stylePercentages.length > 0 && (
          <>
            <hr className={styles.divider} />
            <section className={styles.styleBreakdownSection}>
              <div className={styles.styleBreakdown}>
                <h3 className={styles.styleTitle}>Style Breakdown:</h3>
                {/* 積み上げ型プログレスバー */}
                <div className={styles.styleBreakdownBar} style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* 重複を除去してから表示 */}
                  {(() => {
                    // 重複を除去（同じスタイル名の場合は最初のものを保持）
                    const uniqueStyles = [];
                    const seen = new Set();
                    
                    stylePercentages.forEach(({ style, percentage }) => {
                      const cleanStyleId = style.replace(/^Style\s+/, '');
                      const styleNameMap = {
                        '6703': 'Rock',
                        '2844': 'Pop',
                        '4686': 'Dance',
                        '2845': 'Alternative',
                        '2846': 'Electronica',
                        '2847': 'R&B',
                        '2848': 'Hip-Hop',
                        '2849': 'Metal',
                        '2873': 'Others'
                      };
                      const styleName = styleNameMap[cleanStyleId] || cleanStyleId;
                      
                      if (!seen.has(styleName)) {
                        seen.add(styleName);
                        uniqueStyles.push({ style, percentage, styleName });
                      } else {
                        // 既存のスタイルのパーセンテージを合算
                        const existingIndex = uniqueStyles.findIndex(item => item.styleName === styleName);
                        if (existingIndex !== -1) {
                          uniqueStyles[existingIndex].percentage += percentage;
                        }
                      }
                    });
                    
                    return uniqueStyles.map(({ style, percentage, styleName }, idx) => {
                      // スタイルごとの色を定義
                      const styleColorMap = {
                        Rock: '#6246ea',
                        Pop: '#f25042',
                        Dance: '#f39800',
                        Alternative: '#448aca',
                        Electronica: '#ffd803',
                        'R&B': '#8c7851',
                        'Hip-Hop': '#078080',
                        Metal: '#9646ea',
                        Others: '#BDBDBD',
                      };
                      const defaultColorList = ['#6246ea', '#f25042', '#f39800', '#448aca', '#ffd803', '#8c7851', '#078080', '#9646ea', '#BDBDBD'];
                      const color = styleColorMap[styleName] || defaultColorList[idx % defaultColorList.length];
                      return (
                        <div
                          key={style}
                          className={styles.styleBarSegment}
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.95em',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            transition: 'width 0.3s',
                          }}
                          title={`${styleName} (${percentage}%)`}
                        >
                          {percentage > 10 && (
                            <span className={styles.styleBarLabel} style={{ padding: '0 6px', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                              {styleName} {percentage}%
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
                {/* 凡例（ラベル） */}
                <div className={styles.styleBreakdownLegend} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                  {/* 重複を除去してから表示 */}
                  {(() => {
                    // 重複を除去（同じスタイル名の場合は最初のものを保持）
                    const uniqueStyles = [];
                    const seen = new Set();
                    
                    stylePercentages.forEach(({ style, percentage }) => {
                      const cleanStyleId = style.replace(/^Style\s+/, '');
                      const styleNameMap = {
                        '6703': 'Rock',
                        '2844': 'Pop',
                        '4686': 'Dance',
                        '2845': 'Alternative',
                        '2846': 'Electronica',
                        '2847': 'R&B',
                        '2848': 'Hip-Hop',
                        '2849': 'Metal',
                        '2873': 'Others'
                      };
                      const styleName = styleNameMap[cleanStyleId] || cleanStyleId;
                      
                      if (!seen.has(styleName)) {
                        seen.add(styleName);
                        uniqueStyles.push({ style, percentage, styleName });
                      } else {
                        // 既存のスタイルのパーセンテージを合算
                        const existingIndex = uniqueStyles.findIndex(item => item.styleName === styleName);
                        if (existingIndex !== -1) {
                          uniqueStyles[existingIndex].percentage += percentage;
                        }
                      }
                    });
                    
                    return uniqueStyles.map(({ style, percentage, styleName }, idx) => {
                    
                    const styleColorMap = {
                      Rock: '#6246ea',
                      Pop: '#f25042',
                      Dance: '#f39800',
                      Alternative: '#448aca',
                      Electronica: '#ffd803',
                      'R&B': '#8c7851',
                      'Hip-Hop': '#078080',
                      Metal: '#9646ea',
                      Others: '#BDBDBD',
                    };
                    const defaultColorList = ['#6246ea', '#f25042', '#f39800', '#448aca', '#ffd803', '#8c7851', '#078080', '#9646ea', '#BDBDBD'];
                    const color = styleColorMap[styleName] || defaultColorList[idx % defaultColorList.length];
                    return (
                      <span key={style} className={styles.styleLegendItem} style={{ display: 'flex', alignItems: 'center', fontSize: '0.95em' }}>
                        <span
                          className={styles.styleLegendColor}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            marginRight: 6,
                            display: 'inline-block',
                            backgroundColor: color,
                          }}
                        />
                        {styleName} ({percentage}%)
                      </span>
                    );
                  });
                })()}
                </div>
                {/* 既存のリスト表示はそのまま残す場合は下記をコメントアウト解除 */}
                {/*
                <ul className={styles.styleList}>
                  {stylePercentages.map(({ style, percentage }) => (
                    <li key={style} className={styles.styleItem}>
                      {style} ({percentage}%)
                    </li>
                  ))}
                </ul>
                */}
              </div>
            </section>
            <hr className={styles.divider} />
          </>
        )}
        {/* --- End Style Breakdown Section --- */}
        {/* --- Genre Breakdown Section --- */}
        {topGenres && topGenres.length > 0 && (
          <>
            <section className={styles.genreBreakdownSection}>
              <div className={styles.genreBreakdown}>
                <h3 className={styles.genreTitle}>Top Genres:</h3>
                {/* 横棒グラフ（バーグラフ）UIのみ表示 */}
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  {topGenres.map(({ genre, percentage }, idx) => {
                    // ジャンル名からHSL色相で自動色割り当て
                    function getGenreColor(genre) {
                      let hash = 0;
                      for (let i = 0; i < genre.length; i++) {
                        hash = genre.charCodeAt(i) + ((hash << 5) - hash);
                      }
                      const hue = Math.abs(hash) % 360;
                      return `hsl(${hue}, 60%, 60%)`;
                    }
                    const color = getGenreColor(genre);
                    return (
                      <div key={genre} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ width: 110, fontSize: '1em', marginRight: 8 }}>{he.decode(genre)}</span>
                        <div style={{ flex: 1, background: '#eee', borderRadius: 6, height: 18, marginRight: 8, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                              height: '100%',
                              borderRadius: 6,
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                        <span style={{ width: 40, textAlign: 'right', fontWeight: 'bold' }}>{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
            <hr className={styles.divider} />
          </>
        )}
        {/* --- End Genre Breakdown Section --- */}
               <section className={styles.songsSection}>
           <h2 className={styles.sectionTitle}>Songs ({startSongNumber} - {endSongNumber} / {totalSongs})</h2>
           <SongList
             songs={normalizedSongs}
             source={`artist/${safeArtistData.slug || 'unknown'}`}
             currentPage={safeCurrentPage}
             songsPerPage={20}
             onPageEnd={handlePageEnd}
             autoPlayFirst={autoPlayFirst}
             pageType="artist"
             accessToken={accessToken}
             likedTracks={likedTracks}
             onLikeToggle={toggleLike}
           />

          {safeTotalPages > 1 && (
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={safeTotalPages}
              onPageChange={handlePageChange}
            />
          )}
        </section>
      </div>
    </MobileLifecycleManager>
  );
} 