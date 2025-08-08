"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import styles from "./SongList.module.css";
import MicrophoneIcon from "./MicrophoneIcon";
import Link from "next/link";
import ThreeDotsMenu from "./ThreeDotsMenu";
import he from "he";
import { usePlayer } from './PlayerContext';
import { useSpotifyLikes } from './SpotifyLikes';
import { useSession } from 'next-auth/react';

// CloudinaryのベースURL
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

// ──────────────────────────────
// ヘルパー関数群
// ──────────────────────────────

// サムネイルURLを堅牢に取得する関数
function getThumbnailUrl(song) {
  // 1. 親コンポーネントから渡される thumbnail を最優先
  if (song.thumbnail) {
    // CloudinaryのURLか、ローカルパスかを判断
    if (song.thumbnail.startsWith('http')) {
      return song.thumbnail; // すでに完全なURLの場合
    }
    // CloudinaryのID (.webpなど) の場合
    return `${CLOUDINARY_BASE_URL}${song.thumbnail}`;
  }
  
  // 2. youtubeId からローカルパスを生成
  if (song.youtubeId) {
    return `/images/thum/${song.youtubeId}.webp`;
  }

  // 3. 上記すべてに該当しない場合はプレースホルダー
  return '/placeholder.jpg';
}

// HTML エンティティをデコードするヘルパー（he を使用）
function decodeHtml(html = "") {
  const cleanHtml = (html || "").replace(/<b>/g, '').replace(/<\/b>/g, '');
  return he.decode(cleanHtml);
}

function removeLeadingThe(str = "") {
  return str.replace(/^The\s+/i, "").trim();
}

// 年月を "YYYY.MM" 形式で返す関数
function formatYearMonth(dateStr) {
  if (!dateStr) return "Unknown Year";
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return "Unknown Year";
  const year = dt.getFullYear();
  // getMonth() は 0～11 を返すので、+1 し、2桁に整形
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  return `${year}.${month}`;
}

function determineArtistOrder(song) {
  // artists配列があればそれを優先
  if (Array.isArray(song.artists) && song.artists.length > 0) {
    return song.artists;
  }
  const categories = song.custom_fields?.categories || [];

  function getComparableCatName(cat) {
    return removeLeadingThe(cat.name || "").toLowerCase();
  }

  // 1. artist_order を優先
  const order = song.acf?.artist_order;
  if (typeof order === 'string') {
    const orderNames = order.split(",").map((n) => n.trim().toLowerCase());
    const matched = [];
    orderNames.forEach((artistNameLower) => {
      const foundCat = categories.find(
        (cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
      );
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return matched;
  }
  if (Array.isArray(order)) {
    return order;
  }

  // 2. spotify_artists を次に優先
  if (song.acf?.spotify_artists) {
    const spotifyNames = song.acf.spotify_artists.split(",").map((n) => n.trim().toLowerCase());
    const matched = [];
    spotifyNames.forEach((artistNameLower) => {
      const foundCat = categories.find(
        (cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
      );
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return matched;
  }

  // 3. 本文 (content.rendered) を次に優先
  if (song.content?.rendered) {
    const contentParts = song.content.rendered.split(" - ");
    if (contentParts.length > 0) {
        const potentialArtistsStr = contentParts[0];
        const contentArtists = potentialArtistsStr.split(",").map((n) => n.trim().toLowerCase());
        const matched = [];
        contentArtists.forEach((artistNameLower) => {
            const foundCat = categories.find(
                (cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
            );
            if (foundCat) matched.push(foundCat);
        });
        if (matched.length > 0) return matched;
    }
  }

  // 4. 上記全てない場合は categories の元の順番
  return categories;
}

// アーティスト名と国籍を React 要素として整形
function formatArtistsWithOrigin(artists = []) {
  if (!Array.isArray(artists) || artists.length === 0) {
      return "Unknown Artist";
  }
  const formattedElements = artists.map((artist, index) => {
    let displayName = decodeHtml(artist.name || "Unknown Artist");
    if (artist.prefix === "1" && !/^The\s+/i.test(displayName)) {
      displayName = "The " + displayName;
    }
    const origin = artist.acf?.artistorigin && artist.acf.artistorigin !== "Unknown"
        ? ` (${artist.acf.artistorigin})`
        : "";
    const element = (
      <React.Fragment key={`${artist.id}_${index}`}>
        <span>{displayName}</span>
        {origin && (
          <span style={{ fontWeight: "normal", fontSize: "0.8em" }}>
            {origin}
          </span>
        )}
        {index !== artists.length - 1 && ", "} 
      </React.Fragment>
    );
    return element;
  });
  return formattedElements;
}

function renderVocalIcons(vocalData = []) {
  if (!Array.isArray(vocalData) || vocalData.length === 0) return null;
  const icons = [];
  const hasF = vocalData.some((v) => v.name.toLowerCase() === "f");
  const hasM = vocalData.some((v) => v.name.toLowerCase() === "m");
  if (hasF) {
    icons.push(<MicrophoneIcon key="F" color="#fd5a5a" />);
  }
  if (hasM) {
    icons.push(<MicrophoneIcon key="M" color="#00a0e9" />);
  }
  return <span>{icons}</span>;
}

function formatYear(dateStr) {
  if (!dateStr) return "Unknown Year";
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? "Unknown Year" : dt.getFullYear();
}

// ジャンル名をデコードして連結
function formatGenres(genreArr) {
  if (!Array.isArray(genreArr) || genreArr.length === 0) return "Unknown Genre";
  return genreArr.map((g) => decodeHtml(g.name)).join(" / ");
}

// 楽曲データからスタイル情報を抽出する関数
// parentGenreSlug は親から渡されるジャンル情報（混同しないように）
function extractStyleInfo(song, parentGenreSlug) {
  if (song.style && Array.isArray(song.style) && song.style.length > 0) {
    const styleObj = song.style[0];
    if (typeof styleObj === 'object' && styleObj !== null) {
      return {
        styleSlug: styleObj.slug || "unknown",
        styleName: styleObj.name || "Unknown Style",
      };
    }
  }
  if (song.acf?.style_slug && song.acf?.style_name) {
    return { styleSlug: song.acf.style_slug, styleName: song.acf.style_name };
  }
  if (song.categories && Array.isArray(song.categories)) {
    const styleCategory = song.categories.find(
      (cat) => cat.type === "style" && cat.slug !== parentGenreSlug
    );
    if (styleCategory) {
      return { styleSlug: styleCategory.slug, styleName: styleCategory.name };
    }
  }
  return { styleSlug: "unknown", styleName: "Unknown Style" };
}

// 楽曲データを年度ごとにグループ化する関数
function groupPostsByYear(posts) {
  const groups = {};
  posts.forEach((song) => {
    const dateStr = song.formattedDate || song.date;
    const year = dateStr ? formatYear(dateStr) : "Unknown Year";
    if (!groups[year]) groups[year] = [];
    groups[year].push(song);
  });
  return Object.keys(groups)
    .sort((a, b) => {
      if (a === "Unknown Year") return 1;
      if (b === "Unknown Year") return -1;
      return parseInt(b, 10) - parseInt(a, 10);
    })
    .map((year) => ({ year, songs: groups[year] }));
}

// ──────────────────────────────
// SongList コンポーネント本体
// ──────────────────────────────

function SongList({
  songs = [],
  currentPage = 1,
  styleSlug,
  styleName,
  onPageEnd = () => {},
  autoPlayFirst = false,
  pageType = 'default',
  accessToken = null,
}) {
  const { data: session } = useSession();
  const player = usePlayer();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTriggerRect, setMenuTriggerRect] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const menuRef = useRef(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [popupSong, setPopupSong] = useState(null);

  // Spotify Track IDsを抽出（ページ内の曲のみ）
  const trackIds = useMemo(() => {
    return songs
      .map(song => song.acf?.spotify_track_id || song.spotifyTrackId)
      .filter(id => id); // null/undefinedを除外
  }, [songs]);

  // SpotifyLikesフックを使用
  const {
    likedTracks,
    isLoading: likesLoading,
    error: likesError,
    toggleLike: spotifyToggleLike,
  } = useSpotifyLikes(accessToken, trackIds);

  useEffect(() => {
    if (menuVisible && menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [menuVisible]);

  // Spotify APIを使用したいいねボタン用の toggleLike 関数
  const handleLikeToggle = async (songId) => {
    if (!accessToken) {
      alert("Spotifyにログインしてください");
      return;
    }

    if (likesError) {
      alert(`エラー: ${likesError}`);
      return;
    }

    try {
      const isCurrentlyLiked = likedTracks.has(songId);
      const success = await spotifyToggleLike(songId, !isCurrentlyLiked);

      if (!success) {
        alert(isCurrentlyLiked ? "いいねの解除に失敗しました。" : "いいねの追加に失敗しました。");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      alert("エラーが発生しました。もう一度お試しください。");
    }
  };

  const handleThumbnailClick = (song, index) => {
    // ログイン前はログインを促す
    if (!session || !accessToken) {
      alert('曲を再生するにはSpotifyログインが必要です。\n画面右上の「Sign in with Spotify」ボタンからログインしてください。');
      return;
    }
    
    const source = `${pageType}/${styleSlug}/${currentPage}`;
    player.playTrack(song, index, safeSongs, source, onPageEnd);
  };

  const handleThreeDotsClick = (e, song) => {
    e.stopPropagation();
    const iconRect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeightPx = 240; // 仮の高さ

    // メニューをアイコンの右上に表示するための計算
    let top = iconRect.top - menuHeightPx;
    let left = iconRect.right - menuWidth;

    // 画面からはみ出さないように調整
    if (left < 8) {
      left = 8;
    }
    if (top < 8) {
      top = 8;
    }
    setPopupPosition({ top, left });
    setPopupSong(song);
    setIsPopupVisible(true);
  };

  const handleExternalLinkClick = () => {
    if (popupSong?.spotifyTrackId) {
      window.open(`https://open.spotify.com/track/${popupSong.spotifyTrackId}`, '_blank');
    }
    setIsPopupVisible(false);
  };

  const handleAddToPlaylistClick = (songId) => {
    const numericId = typeof songId === 'string' ? parseInt(songId, 10) : songId;
    if (isNaN(numericId)) {
      console.error('Invalid song ID:', songId);
      return;
    }
    setSelectedSong(numericId);
    setIsPopupVisible(false);
  };

  // ポップアップの外側をクリックしたら閉じる
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (isPopupVisible) {
        setIsPopupVisible(false);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isPopupVisible]);

  // 安全な曲データの生成（idを必ずセット）
  const safeSongs = useMemo(() => {
    return songs.map(song => ({
      ...song,
      id: song.id || song.spotifyTrackId || `temp_${Math.random()}`
    }));
  }, [songs]);

  // 自動再生機能
  const prevSourceRef = useRef();
  useEffect(() => {
    const source = `${pageType}/${styleSlug}/${currentPage}`;
    if (autoPlayFirst && safeSongs.length > 0 && prevSourceRef.current !== source) {
      prevSourceRef.current = source;
      const firstSong = safeSongs[0];
      try {
        player.playTrack(firstSong, 0, safeSongs, source, onPageEnd);
      } catch (error) {
        console.error('Error auto-playing first track:', error);
      }
    }
  }, [autoPlayFirst, safeSongs, pageType, styleSlug, currentPage, onPageEnd, player]);

  const groupedSongs = useMemo(() => {
    const groups = {};
    songs.forEach((song, index) => {
      const year = formatYear(song.date);
      if (!groups[year]) groups[year] = [];
      groups[year].push({ ...song, originalIndex: index });
    });
    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === "Unknown Year") return 1;
      if (b === "Unknown Year") return -1;
      return parseInt(b, 10) - parseInt(a, 10);
    });
    return sortedYears.map((year) => {
      const sortedSongs = groups[year].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      return { year, songs: sortedSongs };
    });
  }, [songs]);

  return (
    <div className={styles.songlistWrapper}>
      {groupedSongs.map((group) => (
        <div key={group.year || "all"} className={styles.yearGroup}>
          {group.year && <h2 className={styles.yearTitle}>{group.year}</h2>}
          <ul className={styles.songList}>
            {Array.isArray(group.songs) && group.songs.map((song, index) => {
              try {
                const title = decodeHtml(song.title?.rendered || "No Title");
                const thumbnailUrl = getThumbnailUrl(song);
                const orderedArtists = determineArtistOrder(song);
                const artistElements = orderedArtists.length
                  ? formatArtistsWithOrigin(orderedArtists)
                  : "Unknown Artist";
                const releaseDate =
                  formatYearMonth(song.date) !== "Unknown Year"
                    ? formatYearMonth(song.date)
                    : "Unknown Year";
                const genreText = formatGenres(song.genre_data);

                // Spotify Track IDを取得
                const spotifyTrackId = song.acf?.spotify_track_id || song.spotifyTrackId;
                const isLiked = spotifyTrackId ? likedTracks.has(spotifyTrackId) : false;
                const isPlaying = player.currentTrack && player.currentTrack.id === song.id && player.isPlaying;

                return (
                  <li key={song.id + '-' + index} id={`song-${song.id}`} className={`${styles.songItem} ${isPlaying ? styles.playing : ''}`}>
                    <div className="ranking-thumbnail-container">
                      {/* ランキング表示が必要ならここに */}
                    </div>
                    <button
                      className={styles.thumbnailContainer}
                      onClick={() => handleThumbnailClick(song, index)}
                      aria-label={`再生 ${title}`}
                    >
                      <div className={styles.thumbnailWrapper}>
                        <img
                          src={thumbnailUrl}
                          alt={`${title} のサムネイル`}
                          loading="lazy"
                          onError={(e) => {
                            if (!e.target.dataset.triedCloudinary) {
                              e.target.dataset.triedCloudinary = "1";
                              // CloudinaryのURLを試す
                              const src = song.thumbnail || song.featured_media_url;
                              if (src) {
                                const fileName = src.split("/").pop();
                                e.target.src = `${CLOUDINARY_BASE_URL}${fileName}`;
                              }
                            } else if (!e.target.dataset.triedOriginal) {
                              e.target.dataset.triedOriginal = "1";
                              // 元のURLを試す
                              const src = song.thumbnail || song.featured_media_url;
                              if (src) {
                                e.target.src = src;
                              }
                            } else {
                              // プレースホルダーにフォールバック
                              e.target.onerror = null;
                              e.target.src = '/placeholder.jpg';
                            }
                          }}
                        />
                      </div>
                    </button>

                    <div className={styles.songText}>
                      <div className={styles.line1} style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                        <span style={{ marginRight: "auto" }}>
                          {artistElements} - {title}
                        </span>
                        {spotifyTrackId && (
                          <span
                            className={styles.likeContainer}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              cursor: likesLoading ? "not-allowed" : "pointer",
                              opacity: likesLoading ? 0.5 : 1,
                              position: "relative",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!likesLoading && !likesError) {
                                handleLikeToggle(spotifyTrackId);
                              }
                            }}
                            title={likesError ? `エラー: ${likesError}` : (isLiked ? "いいねを解除" : "いいねを追加")}
                          >
                            <img
                              src={isLiked ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
                              alt="Like"
                              className={styles.likeIcon}
                              style={{ 
                                width: "14px", 
                                height: "14px",
                                filter: likesError ? "grayscale(100%)" : "none"
                              }}
                            />
                            {likesLoading && (
                              <div style={{
                                position: "absolute",
                                top: "-2px",
                                right: "-2px",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                border: "1px solid #ccc",
                                borderTop: "1px solid #007bff",
                                animation: "spin 1s linear infinite"
                              }} />
                            )}
                          </span>
                        )}
                      </div>
                      <div className={styles.line2} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>{releaseDate}</span>
                        {genreText !== "Unknown Genre" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            ({genreText})
                          </span>
                        )}
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          {renderVocalIcons(song.vocal_data)}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.threeDotsButton}
                      onClick={(e) => handleThreeDotsClick(e, song)}
                      aria-label="More options"
                    >
                      ⋮
                    </button>
                  </li>
                );
              } catch (e) {
                console.error(`ビルドエラー: 曲ID=${song.id}, タイトル=${song.title?.rendered}`, e);
                throw e;
              }
            })}
          </ul>
        </div>
      ))}
      {/* ポップアップメニュー */}
      {isPopupVisible && popupSong && (
        <ThreeDotsMenu
          song={popupSong}
          position={popupPosition}
          onClose={() => setIsPopupVisible(false)}
          onAddToPlaylist={() => handleAddToPlaylistClick(popupSong.id)}
          onCopyUrl={() => {
            navigator.clipboard.writeText(`${window.location.origin}/${popupSong.artists[0]?.slug}/songs/${popupSong.titleSlug}`);
            setIsPopupVisible(false);
          }}
          renderMenuContent={({ song, onAddToPlaylist, onCopyUrl }) => {
            const menuButtonStlye = { display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer' };
            const menuItemStyle = { ...menuButtonStlye, textDecoration: 'none', color: 'inherit' };
            const separatorStyle = { borderBottom: '1px solid #eee' };
            const linkColorStyle = { color: '#007bff' };

            return (
              <>
                <div style={separatorStyle}>
                  {song.artists?.map(artist => (
                    <Link href={`/${artist.slug}`} key={artist.id} legacyBehavior>
                      <a style={{ ...menuItemStyle, ...linkColorStyle, fontWeight: 'bold' }}>
                        <img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                        {artist.name}
                      </a>
                    </Link>
                  ))}
                </div>

                <div style={separatorStyle}>
                  <Link href={`/${song.artists[0]?.slug}/songs/${song.titleSlug}`} legacyBehavior>
                    <a style={{...menuItemStyle, ...linkColorStyle}}>
                      <img src="/svg/song.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                      {song.title?.rendered || "No Title"}
                    </a>
                  </Link>
                </div>

                {song.genres?.map(genre => (
                  <div key={genre.term_id} style={separatorStyle}>
                    <Link href={`/genres/${genre.slug}/1`} legacyBehavior>
                      <a style={{...menuItemStyle, ...linkColorStyle}}>
                        <img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                        {genre.name}
                      </a>
                    </Link>
                  </div>
                ))}

                <div style={separatorStyle}>
                  <button onClick={onAddToPlaylist} style={menuButtonStlye}>
                    <img src="/svg/add.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                    プレイリストに追加
                  </button>
                </div>

                {song.spotifyTrackId && (
                  <div style={separatorStyle}>
                    <a href={`https://open.spotify.com/track/${song.spotifyTrackId}`} target="_blank" rel="noopener noreferrer" style={{...menuItemStyle, ...linkColorStyle}}>
                      <img src="/svg/spotify.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                      Spotifyで開く
                    </a>
                  </div>
                )}

                <div>
                  <button onClick={onCopyUrl} style={menuButtonStlye}>
                    <img src="/svg/copy.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                    曲のURLをコピー
                  </button>
                </div>
              </>
            )
          }}
        />
      )}
    </div>
  );
}

export default SongList;
