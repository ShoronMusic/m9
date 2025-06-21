"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import styles from "./SongList.module.css";
import PropTypes from "prop-types";
import MicrophoneIcon from "./MicrophoneIcon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  where,
} from "firebase/firestore";
import { firestore, auth } from "./firebase";
import SaveToPlaylistPopup from "./SaveToPlaylistPopup";
import he from "he";
import { usePlayer } from './PlayerContext'; // PlayerContext をインポート

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
  if (song.acf?.artist_order) {
    const orderNames = song.acf.artist_order.split(",").map((n) => n.trim().toLowerCase());
    const matched = [];
    orderNames.forEach((artistNameLower) => {
      const foundCat = categories.find(
        (cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
      );
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return matched;
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
  likeCounts: likeCountsProp = {},
  likedSongs: likedSongsProp = {},
  viewCounts: viewCountsProp = {},
  userViewCounts: userViewCountsProp = {},
  handleLike,
}) {
  console.log('SongList: Component rendered with:', {
    songsLength: songs.length,
    currentPage,
    styleSlug,
    pageType
  });

  const player = usePlayer();
  console.log('SongList: usePlayer result:', {
    hasPlayer: !!player,
    playerKeys: player ? Object.keys(player) : [],
    currentTrack: !!player?.currentTrack
  });
  
  const router = useRouter();

  // ポップアップ表示用状態（ポップアップメニュー）
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [popupSong, setPopupSong] = useState(null);

  // いいね機能用 state
  const [likedSongsState, setLikedSongs] = useState({});
  const [likeCountsState, setLikeCounts] = useState({});

  // 再生数用 state
  const [viewCountsState, setViewCounts] = useState({});
  const [userViewCountsState, setUserViewCounts] = useState({});

  // propsがあればpropsを優先、なければ内部state
  const likeCounts = Object.keys(likeCountsProp).length > 0 ? likeCountsProp : likeCountsState;
  const likedSongs = Object.keys(likedSongsProp).length > 0 ? likedSongsProp : likedSongsState;
  const viewCounts = Object.keys(viewCountsProp).length > 0 ? viewCountsProp : viewCountsState;
  const userViewCounts = Object.keys(userViewCountsProp).length > 0 ? userViewCountsProp : userViewCountsState;

  // プレイリスト追加用 state
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(null);
  
  // categoriesの型を保証する
  const safeSongs = useMemo(() => songs.map(song => ({
    ...song,
    spotifyTrackId: song.acf?.spotify_track_id || song.spotifyTrackId || song.acf?.spotifyTrackId,
    categories: Array.isArray(song.categories)
      ? song.categories.filter(cat => typeof cat === 'object' && cat !== null)
      : []
  })), [songs]);

  useEffect(() => {
    if (autoPlayFirst && safeSongs.length > 0) {
      handleThumbnailClick(safeSongs[0], 0);
    }
  }, [autoPlayFirst, safeSongs]);

  useEffect(() => { // ポップアップメニュー用 (これは残す)
    const handleDocumentClick = (e) => {
      if (
        e.target.closest(".popup-menu") === null &&
        e.target.closest(".three-dots-icon") === null
      ) {
        setIsPopupVisible(false);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    if (songs.length > 0) {
      if (Object.keys(likeCountsProp).length === 0 && Object.keys(likedSongsProp).length === 0) {
        // fetchLikes(); // 必要であれば有効化
      }
      if (Object.keys(viewCountsProp).length === 0 && Object.keys(userViewCountsProp).length === 0) {
        fetchViewCounts(songs);
      }
    }
  }, [songs, auth.currentUser, likeCountsProp, likedSongsProp, viewCountsProp, userViewCountsProp]);

  const handleThumbnailClick = (song, index) => {
    console.log('=== SONG CLICK START ===');
    console.log('SongList: Thumbnail clicked:', {
      songName: song.name || song.title?.rendered,
      songId: song.spotifyTrackId || song.id,
      index,
      hasSpotifyTrackId: !!song.spotifyTrackId,
      player: !!player
    });
    
    if (song.spotifyTrackId) {
      const source = `${pageType}/${styleSlug}/${currentPage}`;
      console.log('Calling player.playTrack with source:', source);
      console.log('SongList: About to call playTrack with:', {
        song,
        index,
        safeSongs: safeSongs.length,
        source
      });
      
      try {
        player.playTrack(song, index, safeSongs, source);
        console.log('=== SONG CLICK END - playTrack called successfully ===');
      } catch (error) {
        console.error('Error calling playTrack:', error);
      }
    } else {
      alert('この楽曲にはSpotify音源がありません。');
    }
  };

  const handleThreeDotsClick = (e, song) => {
    e.stopPropagation();
    const iconRect = e.currentTarget.getBoundingClientRect();
    // position: fixed なのでビューポート基準
    const menuWidth = 220;
    const menuHeightPx = 240; // メニューの想定最大高さ（必要に応じて調整）
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    let top = iconRect.bottom;
    let left = iconRect.right;
    // 右端はみ出し対策
    if (left + menuWidth > winWidth - 8) {
      left = winWidth - menuWidth - 8;
    }
    // 下端はみ出し対策
    if (top + menuHeightPx > winHeight - 8) {
      top = winHeight - menuHeightPx - 8;
    }
    if (top < 8) {
      top = 8;
    }
    setPopupPosition({ top, left });
    setPopupSong(song);
    setIsPopupVisible(true);
  };

  const handleExternalLinkClick = () => {
    // If you need to pause playback when an external link is clicked:
    // player.togglePlay();
  };

  // いいねボタン用の toggleLike 関数
  const toggleLike = async (songId) => {
    if (!auth.currentUser) {
      alert("ログインしてください");
      return;
    }
    const userId = auth.currentUser.uid;
    const likeRef = doc(firestore, "likes", songId);
    try {
      if (likedSongs[songId]) {
        // いいね解除
        await updateDoc(likeRef, {
          userIds: arrayRemove(userId),
          likeCount: Math.max((likeCounts[songId] || 0) - 1, 0),
        });
        setLikedSongs((prev) => ({ ...prev, [songId]: false }));
        setLikeCounts((prev) => ({
          ...prev,
          [songId]: Math.max((prev[songId] || 0) - 1, 0),
        }));
      } else {
        // 初回の場合、ドキュメントがなければ作成
        const docSnapshot = await getDoc(likeRef);
        if (!docSnapshot.exists()) {
          await setDoc(likeRef, { userIds: [], likeCount: 0 });
        }
        // いいね追加
        await updateDoc(likeRef, {
          userIds: arrayUnion(userId),
          likeCount: (likeCounts[songId] || 0) + 1,
        });
        setLikedSongs((prev) => ({ ...prev, [songId]: true }));
        setLikeCounts((prev) => ({
          ...prev,
          [songId]: (prev[songId] || 0) + 1,
        }));
      }
      if (typeof handleLike === 'function') {
        handleLike();
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      alert("エラーが発生しました。もう一度お試しください。");
    }
  };

  // プレイリスト追加処理用ハンドラー
  const handleAddToPlaylistClick = (songId) => {
    
    // IDが数値でない場合は数値に変換
    const numericId = typeof songId === 'string' ? parseInt(songId, 10) : songId;
    
    if (isNaN(numericId)) {
      console.error('Invalid song ID:', songId);
      return;
    }
    
    setSelectedSongId(numericId);
    setShowSavePopup(true);
    setIsPopupVisible(false);
  };

  const closeSavePopup = () => {
    setShowSavePopup(false);
    setSelectedSongId(null);
  };

  const groupedSongs = useMemo(() => {
    const groups = {};
    safeSongs.forEach((song, index) => {
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
  }, [safeSongs]);

  // いいね情報をFirestoreから取得する関数
  const fetchLikes = async () => {
    if (!auth.currentUser || !Array.isArray(songs) || songs.length === 0) return;
    
    try {
      const userId = auth.currentUser.uid;
      const songIds = songs.map(song => String(song.id)).filter(Boolean);
      if (songIds.length === 0) return;

      const likeCountsData = {};
      const likedSongsData = {};
      
      const chunkedIds = [];
      for (let i = 0; i < songIds.length; i += 30) {
          chunkedIds.push(songIds.slice(i, i + 30));
      }

      const promises = chunkedIds.map((chunk) => {
        const q = query(collection(firestore, "likes"), where("__name__", "in", chunk));
        return getDocs(q);
      });

      const snapshots = await Promise.all(promises);
      snapshots.forEach((snapshot) => {
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            likeCountsData[docSnap.id] = data.likeCount || 0;
            if (userId && data.userIds && data.userIds.includes(userId)) {
              likedSongsData[docSnap.id] = true;
            }
          }
        });
      });

      // propsが空の場合のみstateを更新
      if (Object.keys(likeCountsProp).length === 0) {
        setLikeCounts(likeCountsData);
        setLikedSongs(likedSongsData);
      }
    } catch (error) {
      console.error("Error fetching likes:", error);
    }
  };

  // Firestore から再生数を取得する関数
  const fetchViewCounts = async (songs) => {
    try {
      const cachedViewCounts = typeof window !== "undefined" ? localStorage.getItem("viewCounts") : null;
      const cachedUserViewCounts = typeof window !== "undefined" ? localStorage.getItem("userViewCounts") : null;
      const viewCountsData = {};
      const userViewCountsData = {};

      if (cachedViewCounts) {
        Object.assign(viewCountsData, JSON.parse(cachedViewCounts));
      }
      if (cachedUserViewCounts) {
        Object.assign(userViewCountsData, JSON.parse(cachedUserViewCounts));
      }

      const songIds = songs.map((song) => String(song.id)).filter(Boolean);
      
      if (songIds.length > 0) {
        const chunkedIds = [];
        for (let i = 0; i < songIds.length; i += 30) {
          chunkedIds.push(songIds.slice(i, i + 30));
        }

        const promises = chunkedIds.map((chunk) => {
          const songViewsQuery = query(
            collection(firestore, "songViews"),
            where("__name__", "in", chunk)
          );
          return getDocs(songViewsQuery);
        });

        const snapshots = await Promise.all(promises);
        snapshots.forEach((snapshot) => {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            viewCountsData[docSnap.id] = data.totalViewCount || 0;
          });
        });

        if (auth.currentUser) {
          const userId = auth.currentUser.uid;
          const userViewPromises = songIds.map(async (songId) => {
            const userViewsRef = doc(firestore, `usersongViews/${songId}/userViews/${userId}`);
            const userViewDoc = await getDoc(userViewsRef);
            if (userViewDoc.exists()) {
              const userData = userViewDoc.data();
              userViewCountsData[songId] = userData.viewCount2 || 0;
            } else {
              userViewCountsData[songId] = 0;
            }
          });
          await Promise.all(userViewPromises);
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("viewCounts", JSON.stringify(viewCountsData));
          localStorage.setItem("userViewCounts", JSON.stringify(userViewCountsData));
        }

        // propsが空の場合のみstateを更新
        if (Object.keys(viewCountsProp).length === 0) {
          setViewCounts(viewCountsData);
          setUserViewCounts(userViewCountsData);
        }
      }
    } catch (error) {
      console.error("Error fetching view counts:", error);
    }
  };

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

                return (
                  <li key={song.id} id={`song-${song.id}`} className={styles.songItem}>
                    <div className="ranking-thumbnail-container">
                      {/* ランキング表示が必要ならここに */}
                    </div>
                    <button
                      className={`${styles.thumbnailContainer} ${player.currentTrack?.id === song.id && player.isPlaying ? styles.playingBorder : ""}`}
                      onClick={() => handleThumbnailClick(song, index)}
                      aria-label={`再生 ${title}`}
                    >
                      <div className={styles.thumbnailWrapper}>
                        <img
                          src={thumbnailUrl}
                          alt={`${title} のサムネイル`}
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = '/placeholder.jpg';
                          }}
                        />
                      </div>
                    </button>

                    <div className={styles.songText}>
                      <div className={styles.line1} style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                        <span style={{ marginRight: "auto" }}>
                          {artistElements} - {title}
                        </span>
                        <span
                          className={styles.likeContainer}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px",
                            cursor: "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(String(song.id));
                          }}
                        >
                          <img
                            src={likedSongs[String(song.id)] ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
                            alt="Like"
                            className={styles.likeIcon}
                            style={{ width: "14px", height: "14px" }}
                          />
                          {likeCounts[String(song.id)] > 0 && (
                            <span className={styles.likeCount} style={{ fontSize: "10px", marginLeft: "2px" }}>
                              {likeCounts[String(song.id)]}
                            </span>
                          )}
                        </span>
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
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      className="three-dots-icon"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => handleThreeDotsClick(e, song)}
                    >
                      <path
                        d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                        fill="currentColor"
                      />
                    </svg>
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
        <div
          className="popup-menu"
          style={{
            position: "fixed",
            top: popupPosition.top,
            left: popupPosition.left,
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            padding: "10px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            zIndex: 10,
          }}
        >
          {/* アーティストリンク */}
          <div>
            {determineArtistOrder(popupSong).map((artist, idx) => (
              <div key={`${artist.term_id || artist.slug || 'unknown'}-${idx}`} style={{ marginBottom: "4px" }}>
                <Link href={`/${artist.slug}/`} style={{ display: "flex", alignItems: "flex-start", textDecoration: "none", color: "#1e6ebb" }}>
                  <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }} onClick={handleExternalLinkClick}>
                    <img src="/svg/musician.png" alt="Musician" style={{ width: "16px", height: "16px" }} />
                  </div>
                  <div style={{ flex: 1 }}>{artist.name}</div>
                </Link>
              </div>
            ))}
          </div>
          <hr />
          {/* タイトルリンク */}
          <div style={{ marginBottom: "4px" }}>
            {determineArtistOrder(popupSong)[0] && (
              <Link href={`/${determineArtistOrder(popupSong)[0].slug}/songs/${popupSong.titleSlug || popupSong.slug || popupSong.title?.slug || popupSong.title?.rendered || popupSong.id}/`} style={{ display: "flex", alignItems: "flex-start", textDecoration: "none", color: "#1e6ebb" }}>
                <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }} onClick={handleExternalLinkClick}>
                  <img src="/svg/song.png" alt="Song" style={{ width: "16px", height: "16px" }} />
                </div>
                <div style={{ flex: 1 }}>{popupSong.title?.rendered || "No Title"}</div>
              </Link>
            )}
          </div>
          <hr />
          {/* ジャンルリンク */}
          <div>
            {popupSong.genre_data &&
              popupSong.genre_data.map((g) => (
                <div key={g.term_id} style={{ marginBottom: "4px" }}>
                  <Link href={`/genres/${g.slug}/1`} style={{ display: "flex", alignItems: "flex-start", textDecoration: "none", color: "#1e6ebb" }}>
                    <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }} onClick={handleExternalLinkClick}>
                      <img src="/svg/genre.png" alt="Genre" style={{ width: "16px", height: "16px" }} />
                    </div>
                    <div style={{ flex: 1 }}>{g.name}</div>
                  </Link>
                </div>
              ))}
          </div>
          <hr />
          {/* プレイリスト追加リンク */}
          <div style={{ marginBottom: "4px", cursor: "pointer" }} onClick={() => handleAddToPlaylistClick(popupSong.id)}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                <img src="/svg/add.svg" alt="Add" style={{ width: "16px", height: "16px" }} />
              </div>
              <div style={{ flex: 1 }}>プレイリストに追加</div>
            </div>
          </div>
          <hr />
          {/* Spotifyリンク */}
          <div style={{ marginBottom: "4px" }}>
            {popupSong.acf?.spotify_track_id && (
              <a
                href={`https://open.spotify.com/track/${popupSong.acf.spotify_track_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  textDecoration: "none",
                  color: "#1e6ebb",
                }}
                onClick={handleExternalLinkClick}
              >
                <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                  <img src="/svg/spotify.svg" alt="Spotify" style={{ width: "20px", height: "20px" }} />
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <span>Spotify</span>
                  <img
                    src="/svg/new-window.svg"
                    alt="New Window"
                    style={{ width: "16px", height: "16px", marginLeft: "4px", verticalAlign: "middle" }}
                  />
                </div>
              </a>
            )}
          </div>
        </div>
      )}
      {/* SaveToPlaylistPopup をポータル経由でレンダリング */}
      {showSavePopup && selectedSongId &&
        ReactDOM.createPortal(
          <SaveToPlaylistPopup
            songId={selectedSongId}
            onClose={closeSavePopup}
          />,
          document.body
        )
      }
    </div>
  );
}

SongList.propTypes = {
  songs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      date: PropTypes.string,
      title: PropTypes.shape({
        rendered: PropTypes.string,
      }),
      content: PropTypes.shape({
        rendered: PropTypes.string,
      }),
      featured_media_url: PropTypes.string,
      acf: PropTypes.shape({
        ytvideoid: PropTypes.string,
        spotify_track_id: PropTypes.string,
        artist_order: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.array
        ]),
        spotify_artists: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.array
        ]),
        style_slug: PropTypes.string,
        style_name: PropTypes.string,
      }),
      categories: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          artistorigin: PropTypes.string,
          the_prefix: PropTypes.string,
          slug: PropTypes.string,
          type: PropTypes.string,
        })
      ),
      genre: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          slug: PropTypes.string,
        })
      ),
      vocal_data: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          slug: PropTypes.string,
        })
      ),
      style: PropTypes.arrayOf(
        PropTypes.oneOfType([
          PropTypes.shape({
            term_id: PropTypes.number,
            name: PropTypes.string,
            slug: PropTypes.string,
          }),
          PropTypes.number
        ])
      ),
    })
  ).isRequired,
  currentPage: PropTypes.number,
  styleSlug: PropTypes.string,
  styleName: PropTypes.string,
  onPageEnd: PropTypes.func,
  autoPlayFirst: PropTypes.bool,
  pageType: PropTypes.string,
  likeCounts: PropTypes.object,
  likedSongs: PropTypes.object,
  viewCounts: PropTypes.object,
  userViewCounts: PropTypes.object,
  handleLike: PropTypes.func,
};

export default SongList;
