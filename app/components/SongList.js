"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import styles from "./SongList.module.css";
import MicrophoneIcon from "./MicrophoneIcon";
import Link from "next/link";
import ThreeDotsMenu from "./ThreeDotsMenu";
import he from "he";
import { usePlayer } from './PlayerContext';
import { useSpotifyLikes } from './SpotifyLikes';
import { useSession } from 'next-auth/react';
import CreatePlaylistModal from './CreatePlaylistModal';

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
  // htmlパラメータが文字列でない場合は空文字列に変換
  const htmlString = typeof html === 'string' ? html : String(html || "");
  const cleanHtml = htmlString.replace(/<b>/g, '').replace(/<\/b>/g, '');
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
  return genreArr.map((g) => {
    if (!g || typeof g !== 'object') return "Unknown Genre";
    const genreName = g.name || g.genre_name || g.slug || "Unknown Genre";
    return decodeHtml(genreName);
  }).join(" / ");
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

// スタイルIDからスタイル名を取得する関数
function getStyleName(styleId) {
  const styleMap = {
    2844: 'Pop',
    2845: 'Alternative',
    4686: 'Dance',
    2846: 'Electronica',
    2847: 'R&B',
    2848: 'Hip-Hop',
    6703: 'Rock',
    2849: 'Metal',
    2873: 'Others'
  };
  return styleMap[styleId] || 'Unknown';
}

export default function SongList({
  songs = [],
  currentPage = 1,
  styleSlug,
  styleName,
  onPageEnd = () => {},
  autoPlayFirst = false,
  pageType = 'default',
  accessToken = null,
  source = null,
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);

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

  // 安全な曲データの生成（idを必ずセット）
  const safeSongs = useMemo(() => {
    return songs.map(song => ({
      ...song,
      id: song.id || song.spotifyTrackId || `temp_${Math.random()}`
    }));
  }, [songs]);

  // スタイルページ閲覧時に曲の項目を確認するログ
  useEffect(() => {
    if (pageType === 'style' && songs.length > 0) {
      console.log('=== スタイルページの曲データ項目確認 ===');
      console.log('ページタイプ:', pageType);
      console.log('スタイルスラッグ:', styleSlug);
      console.log('曲の総数:', songs.length);
      
      // 最初の曲の詳細項目を表示
      const firstSong = songs[0];
      console.log('最初の曲の詳細項目:', {
        id: firstSong.id,
        title: firstSong.title,
        spotifyTrackId: firstSong.spotifyTrackId,
        acf: firstSong.acf,
        custom_fields: firstSong.custom_fields,
        artists: firstSong.artists,
        genres: firstSong.genres,
        styles: firstSong.styles,
        vocals: firstSong.vocals,
        thumbnail: firstSong.thumbnail,
        youtubeId: firstSong.youtubeId,
        releaseDate: firstSong.releaseDate,
        content: firstSong.content,
        slug: firstSong.slug,
        // 追加の項目
        date: firstSong.date,
        titleSlug: firstSong.titleSlug,
        featured_media_url: firstSong.featured_media_url,
        genre_data: firstSong.genre_data,
        vocal_data: firstSong.vocal_data,
        style: firstSong.style,
        category_data: firstSong.category_data,
        categories: firstSong.categories
      });
      
      // 2番目と3番目の曲の詳細項目も表示
      if (songs.length > 1) {
        const secondSong = songs[1];
        console.log('2番目の曲の詳細項目:', {
          id: secondSong.id,
          title: secondSong.title,
          spotifyTrackId: secondSong.spotifyTrackId,
          acf: secondSong.acf,
          custom_fields: secondSong.custom_fields,
          artists: secondSong.artists,
          genres: secondSong.genres,
          styles: secondSong.styles,
          vocals: secondSong.vocals,
          thumbnail: secondSong.thumbnail,
          youtubeId: secondSong.youtubeId,
          releaseDate: secondSong.releaseDate,
          content: secondSong.content,
          slug: secondSong.slug,
          date: secondSong.date,
          titleSlug: secondSong.titleSlug,
          featured_media_url: secondSong.featured_media_url,
          genre_data: secondSong.genre_data,
          vocal_data: secondSong.vocal_data,
          style: secondSong.style,
          category_data: secondSong.category_data,
          categories: secondSong.categories
        });
      }
      
      if (songs.length > 2) {
        const thirdSong = songs[2];
        console.log('3番目の曲の詳細項目:', {
          id: thirdSong.id,
          title: thirdSong.title,
          spotifyTrackId: thirdSong.spotifyTrackId,
          acf: thirdSong.acf,
          custom_fields: thirdSong.custom_fields,
          artists: thirdSong.artists,
          genres: thirdSong.genres,
          styles: thirdSong.styles,
          vocals: thirdSong.vocals,
          thumbnail: thirdSong.thumbnail,
          youtubeId: thirdSong.youtubeId,
          releaseDate: thirdSong.releaseDate,
          content: thirdSong.content,
          slug: thirdSong.slug,
          date: thirdSong.date,
          titleSlug: thirdSong.titleSlug,
          featured_media_url: thirdSong.featured_media_url,
          genre_data: thirdSong.genre_data,
          vocal_data: thirdSong.vocal_data,
          style: thirdSong.style,
          category_data: thirdSong.category_data,
          categories: thirdSong.categories
        });
      }
      
             // 全曲の詳細項目を表示（最初の曲と同じレベル）
       songs.forEach((song, index) => {
         console.log(`${index + 1}番目の曲の詳細項目:`, {
           id: song.id,
           title: song.title,
           spotifyTrackId: song.spotifyTrackId,
           acf: song.acf,
           custom_fields: song.custom_fields,
           artists: song.artists,
           genres: song.genres,
           styles: song.styles,
           vocals: song.vocals,
           thumbnail: song.thumbnail,
           youtubeId: song.youtubeId,
           releaseDate: song.releaseDate,
           content: song.content,
           slug: song.slug,
           // 追加の項目
           date: song.date,
           titleSlug: song.titleSlug,
           featured_media_url: song.featured_media_url,
           genre_data: song.genre_data,
           vocal_data: song.vocal_data,
           style: song.style,
           category_data: song.category_data,
           categories: song.categories
         });
       });
    }
  }, [songs, pageType, styleSlug]);

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

  const handleThumbnailClick = useCallback((song) => {
    const finalSource = source || 'unknown';
    const styleSlug = pageType === 'style' ? finalSource.split('/')[1] : null;
    
    player.playTrack(song, songs.findIndex(s => s.id === song.id), songs, finalSource, onPageEnd);
  }, [source, pageType, player, songs, onPageEnd]);

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
    const song = songs.find(s => s.id === songId);
    if (song) {
      setTrackToAdd(song);
      setShowCreateModal(true);
    }
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

  // 自動再生機能
  const prevSourceRef = useRef();
  useEffect(() => {
    const finalSource = source || `${pageType}/${styleSlug}/${currentPage}`;
    if (autoPlayFirst && safeSongs.length > 0 && prevSourceRef.current !== finalSource) {
      prevSourceRef.current = finalSource;
      const firstSong = safeSongs[0];
      try {
        player.playTrack(firstSong, 0, safeSongs, finalSource, onPageEnd);
      } catch (error) {
        console.error('Error auto-playing first track:', error);
      }
    }
  }, [autoPlayFirst, safeSongs, source, pageType, styleSlug, currentPage, onPageEnd, player]);

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
  const handleAddToPlaylist = (track) => {
    setTrackToAdd(track);
    setShowCreateModal(true);
  };

  // 既存プレイリストに追加
  const addTrackToPlaylist = async (track, playlistId) => {
    try {
      // スタイル情報を取得（複数のソースから、より包括的に）
      let styleInfo = null;
      
      // 1. track.style配列から取得（IDのみの場合の処理）
      if (track.style && Array.isArray(track.style) && track.style.length > 0) {
        const styleItem = track.style[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      }
      
      // 2. track.styles配列から取得（IDのみの場合の処理）
      if (!styleInfo && track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
        const styleItem = track.styles[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      }
      
      // 3. ACFフィールドから取得
      if (!styleInfo && track.acf?.style_id && track.acf?.style_name) {
        styleInfo = { term_id: track.acf.style_id, name: track.acf.style_name };
      }
      
      // 4. 直接フィールドから取得
      if (!styleInfo && track.style_id && track.style_name) {
        styleInfo = { term_id: track.style_id, name: track.style_name };
      }
      
      // 5. category_dataからスタイル情報を探す
      if (!styleInfo && track.category_data && Array.isArray(track.category_data)) {
        const styleCategory = track.category_data.find(cat => 
          cat.type === 'style' || cat.taxonomy === 'style' || 
          (cat.name && cat.name.toLowerCase().includes('style'))
        );
        if (styleCategory) {
          styleInfo = { term_id: styleCategory.term_id || styleCategory.id, name: styleCategory.name };
        }
      }
      
      // 6. categoriesからスタイル情報を探す
      if (!styleInfo && track.categories && Array.isArray(track.categories)) {
        const styleCategory = track.categories.find(cat => 
          cat.type === 'style' || cat.taxonomy === 'style' || 
          (cat.name && cat.name.toLowerCase().includes('style'))
        );
        if (styleCategory) {
          styleInfo = { term_id: styleCategory.term_id || styleCategory.id, name: styleCategory.name };
        }
      }

      // ジャンル情報を取得（複数のソースから、複数ジャンル対応）
      let genreInfo = null;
      let allGenres = []; // 全ジャンル情報を保存
      
      if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
        allGenres = track.genre_data;
        genreInfo = track.genre_data[0]; // 主要なジャンルとして最初のものを使用
      } else if (track.genres && Array.isArray(track.genres) && track.genres.length > 0) {
        allGenres = track.genres;
        genreInfo = track.genres[0];
      } else if (track.acf?.genre_id && track.acf?.genre_name) {
        genreInfo = { term_id: track.acf.genre_id, name: track.acf.genre_name };
        allGenres = [genreInfo];
      } else if (track.genre_id && track.genre_name) {
        genreInfo = { term_id: track.genre_id, name: track.genre_name };
        allGenres = [genreInfo];
      }

      // 複数ジャンル名をカンマ区切りで作成（genre_nameフィールド用）
      let genreNameForDisplay = null;
      if (allGenres.length > 0) {
        const genreNames = allGenres.map(genre => {
          if (typeof genre === 'string') return genre;
          if (typeof genre === 'object' && genre !== null) {
            return genre.name || genre.genre_name || genre.slug || Object.values(genre)[0];
          }
          return String(genre);
        }).filter(name => name && name !== 'null' && name !== 'undefined' && name !== 'unknown');
        
        if (genreNames.length > 0) {
          genreNameForDisplay = genreNames.join(', ');
        }
      }
      
      // 単一ジャンル情報がない場合は、複数ジャンルから最初のものを使用
      if (!genreInfo && allGenres.length > 0) {
        const firstGenre = allGenres[0];
        if (typeof firstGenre === 'string') {
          genreInfo = { term_id: null, name: firstGenre };
        } else if (typeof firstGenre === 'object' && firstGenre !== null) {
          genreInfo = { 
            term_id: firstGenre.term_id || firstGenre.id || null, 
            name: firstGenre.name || firstGenre.genre_name || firstGenre.slug 
          };
        }
      }

      // ジャンルスラッグを取得
      let genreSlug = null;
      if (genreInfo && genreInfo.slug) {
        genreSlug = genreInfo.slug;
      } else if (allGenres.length > 0 && allGenres[0].slug) {
        genreSlug = allGenres[0].slug;
      }

      // ボーカル情報を取得（複数のソースから）
      let vocalInfo = null;
      if (track.vocal_data && Array.isArray(track.vocal_data) && track.vocal_data.length > 0) {
        vocalInfo = track.vocal_data[0];
      } else if (track.vocals && Array.isArray(track.vocals) && track.vocals.length > 0) {
        vocalInfo = track.vocals[0];
      } else if (track.acf?.vocal_id && track.acf?.vocal_name) {
        vocalInfo = { term_id: track.acf.vocal_id, name: track.acf.vocal_name };
      } else if (track.vocal_id && track.vocal_name) {
        vocalInfo = { term_id: track.vocal_id, name: track.vocal_name };
      }

      // サムネイルURLを取得
      let thumbnailUrl = null;
      if (track.thumbnail) {
        thumbnailUrl = track.thumbnail;
      } else if (track.acf?.thumbnail_url) {
        thumbnailUrl = track.acf.thumbnail_url;
      } else if (track.thumbnail_url) {
        thumbnailUrl = track.thumbnail_url;
      }

      // 公開年月を取得
      let releaseDate = null;
      if (track.releaseDate) {
        releaseDate = track.releaseDate;
      } else if (track.date) {
        releaseDate = track.date;
      } else if (track.release_date) {
        releaseDate = track.release_date;
      } else if (track.acf?.release_date) {
        releaseDate = track.acf.release_date;
      }

      // Spotify画像URLを取得
      let spotifyImages = null;
      if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
        const artistImages = track.artists
          .map(artist => artist.acf?.spotify_images || artist.spotify_images)
          .filter(Boolean);
        if (artistImages.length > 0) {
          spotifyImages = JSON.stringify(artistImages);
        }
      }

      // アーティストスラッグを取得
      let artistSlug = null;
      if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
        artistSlug = track.artists[0].slug || null;
      }

      // スタイルスラッグを取得
      let styleSlug = null;
      if (track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
        // スタイルIDからスラッグを取得する必要があります
        styleSlug = null; // 後で実装
      }

      // アーティスト順序を取得
      let artistOrder = null;
      if (track.acf?.artist_order && Array.isArray(track.acf.artist_order) && track.acf.artist_order.length > 0) {
        artistOrder = track.acf.artist_order[0] || null;
      }

      // コンテンツ情報を取得
      let content = null;
      if (track.content?.rendered) {
        content = track.content.rendered;
      } else if (track.content) {
        content = track.content;
      }

      // タイトルスラッグを取得
      let titleSlug = track.titleSlug || track.slug || null;

      // YouTube動画IDを取得
      let videoId = track.videoId || track.youtubeId || null;

             // 送信データを準備（データベースに存在するフィールドのみ）
      const requestData = {
        // 基本項目（必須）
        song_id: track.id,
        track_id: track.id,
        title: track.title?.rendered || track.title || 'Unknown Title',
        artists: track.artists || [],
        
        // メディア情報
        thumbnail_url: thumbnailUrl,
        
        // スタイル・ジャンル・ボーカル情報（主要なもの）
        style_id: styleInfo?.term_id || track.style_id,
        style_name: styleInfo?.name || track.style_name,
        genre_id: genreInfo?.term_id || track.genre_id,
        genre_name: genreNameForDisplay || genreInfo?.name || track.genre_name,
        vocal_id: vocalInfo?.term_id || track.vocal_id,
        vocal_name: vocalInfo?.name || track.vocal_name,
        
        // 複数情報を格納する新しいフィールド
        genre_data: allGenres.length > 0 ? allGenres : null,
        style_data: track.style || track.styles || null,
        vocal_data: track.vocal_data || track.vocals || null,
        
        // 日付情報
        release_date: releaseDate,
        
        // Spotify情報
        spotify_track_id: track.acf?.spotify_track_id || track.spotifyTrackId,
        spotify_images: spotifyImages,
        spotify_artists: spotifyArtists,
        
        // その他の情報
        is_favorite: false, // 新規追加時はデフォルトでfalse
        artist_order: artistOrder,
        content: content,
        
        // 既存のフィールド（後方互換性のため）
        all_genres: allGenres.length > 0 ? JSON.stringify(allGenres) : null,
        all_styles: track.style || track.styles || null,
        all_vocals: track.vocal_data || track.vocals || null
      };

             // デバッグ用：スタイル情報の取得状況を確認
       console.log('=== スタイル情報取得デバッグ ===');
       console.log('track.style:', track.style);
       console.log('track.styles:', track.styles);
       console.log('track.acf.style_id:', track.acf?.style_id);
       console.log('track.acf.style_name:', track.acf?.style_name);
       console.log('track.category_data:', track.category_data);
       console.log('track.categories:', track.categories);
       console.log('最終的なstyleInfo:', styleInfo);
       console.log('全ジャンル情報:', allGenres);
       console.log('Sending track data to API:', requestData);

      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API response error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`曲の追加に失敗しました: ${errorData.message || errorData.error || response.statusText}`);
      }

      console.log('プレイリストに追加しました！');
    } catch (err) {
      console.error('曲の追加に失敗しました:', err.message);
      // アラートは表示せず、コンソールログのみ
    }
  };

  // 新規プレイリスト作成モーダルを開く
  const openCreatePlaylistModal = (track) => {
    setTrackToAdd(track);
    setShowCreateModal(true);
  };

  // プレイリスト作成完了
  const handlePlaylistCreated = (newPlaylist) => {
    console.log(`プレイリスト「${newPlaylist.name}」を作成し、曲を追加しました！`);
    fetchUserPlaylists(); // プレイリスト一覧を更新
  };

  // コンポーネントマウント時にプレイリスト一覧を取得
  useEffect(() => {
    if (session) {
      fetchUserPlaylists();
    }
  }, [session]);

  return (
    <div className={styles.songlistWrapper}>
      {groupedSongs.map((group) => (
        <div key={group.year || "all"} className={styles.yearGroup}>
          {group.year && <h2 className={styles.yearTitle}>{group.year}</h2>}
          <ul className={styles.songList}>
            {Array.isArray(group.songs) && group.songs.map((song, index) => {
              try {
                // titleの値を安全に取得
                let titleValue = "No Title";
                if (song.title) {
                  if (typeof song.title === 'string') {
                    titleValue = song.title;
                  } else if (song.title.rendered && typeof song.title.rendered === 'string') {
                    titleValue = song.title.rendered;
                  }
                }
                
                const title = decodeHtml(titleValue);
                
                // デバッグ用：タイトルの値を確認
                if (pageType === 'style') {
                  console.log(`曲ID ${song.id} のタイトル情報:`, {
                    'song.title': song.title,
                    'song.title?.rendered': song.title?.rendered,
                    'titleValue': titleValue,
                    '最終的なtitle': title
                  });
                }
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
                <div key="artists-section" style={separatorStyle}>
                  {song.artists?.map((artist, index) => (
                    <Link href={`/${artist.slug}`} key={artist.id || `artist-${index}`} legacyBehavior>
                      <a style={{ ...menuItemStyle, ...linkColorStyle, fontWeight: 'bold' }}>
                        <img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                        {artist.name}
                      </a>
                    </Link>
                  ))}
                </div>

                <div key="song-section" style={separatorStyle}>
                  <Link href={`/${song.artists[0]?.slug}/songs/${song.titleSlug}`} legacyBehavior>
                    <a style={{...menuItemStyle, ...linkColorStyle}}>
                      <img src="/svg/song.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                      {song.title?.rendered || "No Title"}
                    </a>
                  </Link>
                </div>

                {song.genres?.map((genre, index) => (
                  <div key={`genre-${genre.term_id || index}`} style={separatorStyle}>
                    <Link href={`/genres/${genre.slug}/1`} legacyBehavior>
                      <a style={{...menuItemStyle, ...linkColorStyle}}>
                        <img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                        {genre.name}
                      </a>
                    </Link>
                  </div>
                ))}

                <div key="add-to-playlist-section" style={separatorStyle}>
                  <button onClick={onAddToPlaylist} style={menuButtonStlye}>
                    <img src="/svg/add.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                    プレイリストに追加
                  </button>
                </div>

                {song.spotifyTrackId && (
                  <div key="spotify-section" style={separatorStyle}>
                    <a href={`https://open.spotify.com/track/${song.spotifyTrackId}`} target="_blank" rel="noopener noreferrer" style={{...menuItemStyle, ...linkColorStyle}}>
                      <img src="/svg/spotify.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                      Spotifyで開く
                    </a>
                  </div>
                )}

                <div key="copy-url-section">
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
      {showCreateModal && trackToAdd && (
        <CreatePlaylistModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handlePlaylistCreated}
          trackToAdd={trackToAdd}
          userPlaylists={userPlaylists}
          onAddToPlaylist={addTrackToPlaylist}
        />
      )}
    </div>
  );
}
