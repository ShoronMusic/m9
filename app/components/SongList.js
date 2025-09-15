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
import CreateNewPlaylistModal from './CreateNewPlaylistModal';
import LoginPromptModal from './LoginPromptModal';

// CloudinaryのベースURL（正しい形式）
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

// ──────────────────────────────
// ヘルパー関数群
// ──────────────────────────────

// Cloudinaryに存在しない画像のキャッシュ
const cloudinaryNotFoundCache = new Set();
// WebP形式も存在しない画像のキャッシュ
const webpNotFoundCache = new Set();

// JPG/PNG URLをWebP URLに変換する関数
function convertToWebPUrl(originalUrl) {
  if (!originalUrl) return originalUrl;
  
  // ファイル拡張子を取得
  const lastDotIndex = originalUrl.lastIndexOf('.');
  if (lastDotIndex === -1) return originalUrl;
  
  const extension = originalUrl.substring(lastDotIndex + 1).toLowerCase();
  
  // JPG/JPEG/PNGの場合はWebPに変換
  if (['jpg', 'jpeg', 'png'].includes(extension)) {
    const webpUrl = originalUrl.substring(0, lastDotIndex) + '.webp';
    return webpUrl;
  }
  
  // 既にWebPの場合はそのまま返す
  return originalUrl;
}

// Cloudinary URL生成のテスト関数
function testCloudinaryUrlGeneration() {
  const testCases = [
    'https://sub.music8.jp/wp-content/uploads/sarah-mclachlan-gravity.jpg',
    'https://sub.music8.jp/wp-content/uploads/jonas-brothers-mirror-to-the-sky.jpg'
  ];
  
  testCases.forEach(originalUrl => {
    const fileName = originalUrl.split("/").pop();
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    console.log('🧪 Cloudinary URL Test:', {
      original: originalUrl,
      fileName: fileName,
      generated: cloudinaryUrl,
      expected: `https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/${fileName}`
    });
  });
}

// サムネイルURLを堅牢に取得する関数
function getThumbnailUrl(song) {
  // 1. 親コンポーネントから渡される thumbnail を最優先
  if (song.thumbnail) {
    const fileName = song.thumbnail.split("/").pop();
    
    // キャッシュでCloudinaryに存在しないことが確認されている場合
    if (cloudinaryNotFoundCache.has(fileName)) {
      // WebP形式も存在しないことが確認されている場合は、元のURLを返す
      if (webpNotFoundCache.has(fileName)) {
        return song.thumbnail;
      }
      // WebP形式のURLを返す（WebPは99%存在するため優先）
      return convertToWebPUrl(song.thumbnail);
    }
    
    // WebPファイルが99%存在するため、Cloudinary URLを直接試す
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  // 2. featured_media_url がある場合
  if (song.featured_media_url) {
    const fileName = song.featured_media_url.split("/").pop();
    
    // キャッシュでCloudinaryに存在しないことが確認されている場合
    if (cloudinaryNotFoundCache.has(fileName)) {
      // WebP形式も存在しないことが確認されている場合は、元のURLを返す
      if (webpNotFoundCache.has(fileName)) {
        return song.featured_media_url;
      }
      // WebP形式のURLを返す
      return convertToWebPUrl(song.featured_media_url);
    }
    
    // WebPファイルが99%存在するため、Cloudinary URLを直接試す
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  // 3. youtubeId からローカルパスを生成
  if (song.youtubeId) {
    return `/images/thum/${song.youtubeId}.webp`;
  }

  // 4. 上記すべてに該当しない場合はプレースホルダー
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
  // デバッグ用ログ
  console.log('🎯 SongList determineArtistOrder song:', song);
  
  // spotify_artistsの順番を最優先
  const spotifyArtists = song.acf?.spotify_artists || song.custom_fields?.spotify_artists;
  
  if (spotifyArtists) {
    // 文字列の場合（カンマ区切り）
    if (typeof spotifyArtists === 'string') {
      console.log('🎯 SongList using spotify_artists string:', spotifyArtists);
      
      // 既存のartists配列がある場合は、spotify_artistsの順番に従って並び替え
      if (Array.isArray(song.artists) && song.artists.length > 0) {
        const spotifyNames = spotifyArtists.replace(/"/g, '').split(',').map(name => name.trim());
        const sortedArtists = [...song.artists].sort((a, b) => {
          const aName = a.name || '';
          const bName = b.name || '';
          
          const aIndex = spotifyNames.findIndex(name => 
            name.toLowerCase().includes(aName.toLowerCase()) || 
            aName.toLowerCase().includes(name.toLowerCase())
          );
          const bIndex = spotifyNames.findIndex(name => 
            name.toLowerCase().includes(bName.toLowerCase()) || 
            bName.toLowerCase().includes(name.toLowerCase())
          );
          
          // 見つからない場合は最後に配置
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          
          return aIndex - bIndex;
        });
        
        return sortedArtists;
      } else {
        // artistsがない場合のみ、spotify_artistsから直接作成
        if (spotifyArtists.includes(',')) {
          // 複数アーティストの場合、文字列を分割してアーティスト情報オブジェクトを作成
          const artistNames = spotifyArtists.replace(/"/g, '').split(',').map(name => name.trim());
          return artistNames.map(name => ({ name, slug: name.toLowerCase().replace(/\s+/g, '-') }));
        } else {
          // 単一アーティストの場合
          const name = spotifyArtists.replace(/"/g, '').trim();
          return [{ name, slug: name.toLowerCase().replace(/\s+/g, '-') }];
        }
      }
    }
    
    // 配列の場合
    if (Array.isArray(spotifyArtists)) {
      console.log('🎯 SongList using spotify_artists array:', spotifyArtists);
      if (Array.isArray(song.artists) && song.artists.length > 0) {
        // spotify_artistsの順番に従って並び替え
        const sortedArtists = [...song.artists].sort((a, b) => {
          const aName = a.name || '';
          const bName = b.name || '';
          
          const aIndex = spotifyArtists.findIndex(name => 
            name.toLowerCase().includes(aName.toLowerCase()) || 
            aName.toLowerCase().includes(name.toLowerCase())
          );
          const bIndex = spotifyArtists.findIndex(name => 
            name.toLowerCase().includes(bName.toLowerCase()) || 
            bName.toLowerCase().includes(name.toLowerCase())
          );
          
          // 見つからない場合は最後に配置
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          
          return aIndex - bIndex;
        });
        
        return sortedArtists;
      } else {
        // artistsがない場合、spotify_artistsから直接作成
        return spotifyArtists.map(name => ({ name, slug: name.toLowerCase().replace(/\s+/g, '-') }));
      }
    }
  }
  
  // artists配列があればそれを優先
  if (Array.isArray(song.artists) && song.artists.length > 0) {
    return prioritizeMainArtist(song.artists);
  }
  const categories = song.custom_fields?.categories || [];

  function getComparableCatName(cat) {
    return removeLeadingThe(cat.name || "").toLowerCase();
  }

  // 1. artist_order を優先
  const order = song.acf?.artist_order;
  if (typeof order === 'string' && order.trim()) {
    const orderNames = order.split(",").map((n) => n.trim().toLowerCase());
    const matched = [];
    orderNames.forEach((artistNameLower) => {
      const foundCat = categories.find(
        (cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
      );
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return prioritizeMainArtist(matched);
  }
  if (Array.isArray(order)) {
    return prioritizeMainArtist(order);
  }

  // 2. spotify_artists を次に優先
  if (song.acf?.spotify_artists && song.acf.spotify_artists.trim()) {
    const spotifyNames = song.acf.spotify_artists.split(",").map((n) => n.trim().toLowerCase());
    const matched = [];
    spotifyNames.forEach((artistNameLower) => {
      const foundCat = categories.find(
        (cat) => getComparableCatName(cat) === removeLeadingThe(artistNameLower)
      );
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) return prioritizeMainArtist(matched);
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
        if (matched.length > 0) return prioritizeMainArtist(matched);
    }
  }

  // 4. 上記全てない場合は categories の元の順番を優先度順に並び替え
  return prioritizeMainArtist(categories);
}

// メインアーティストを最初に表示するための並び替え関数
function prioritizeMainArtist(artists = []) {
  if (!Array.isArray(artists) || artists.length <= 1) {
    return artists;
  }

  // メインアーティストの判定基準
  // 1. フィーチャーアーティスト（feat., ft., featuring等）を後ろに
  // 2. コラボレーション（&, and等）は順番を保持
  // 3. メインアーティストを最初に
  // 4. 特定のアーティスト（Mariah Carey等）を優先

  const mainArtists = [];
  const featuredArtists = [];
  const priorityArtists = [];

  // 優先度の高いアーティストを最初に配置
  const priorityArtistNames = [
    'mariah carey', 'mariah', 'carey',
    'beyoncé', 'beyonce',
    'rihanna',
    'adele',
    'taylor swift', 'taylor', 'swift'
  ];

  artists.forEach(artist => {
    const artistName = artist.name || '';
    const lowerName = artistName.toLowerCase();
    
    // 優先度の高いアーティストを最初に
    if (priorityArtistNames.some(priority => lowerName.includes(priority))) {
      priorityArtists.push(artist);
    }
    // フィーチャーアーティストの判定
    else if (lowerName.includes('feat.') || 
        lowerName.includes('ft.') || 
        lowerName.includes('featuring') ||
        lowerName.includes('feat') ||
        lowerName.includes('ft')) {
      featuredArtists.push(artist);
    } else {
      mainArtists.push(artist);
    }
  });

  // 優先アーティスト → メインアーティスト → フィーチャーアーティストの順で返す
  return [...priorityArtists, ...mainArtists, ...featuredArtists];
}

// アーティスト名と国籍を React 要素として整形
function formatArtistsWithOrigin(artists = []) {
  if (!Array.isArray(artists) || artists.length === 0) {
      return "Unknown Artist";
  }
  
  // メインアーティストを優先して並び替え
  const prioritizedArtists = prioritizeMainArtist(artists);
  
  const formattedElements = prioritizedArtists.map((artist, index) => {
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
        {index !== prioritizedArtists.length - 1 && ", "} 
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
  const [showCreateNewPlaylistModal, setShowCreateNewPlaylistModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [selectedSongForLogin, setSelectedSongForLogin] = useState(null);

  // スマホ時のアクティブ楽曲スクロール用
  const [isMobile, setIsMobile] = useState(false);
  const activeSongRef = useRef(null);

  // モバイル判定
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 920);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // アクティブな楽曲をプレイヤーの上100pxの位置にスクロール
  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile || !player.currentTrack || !activeSongRef.current) return;

    const scrollToActiveSong = () => {
      const activeSongElement = activeSongRef.current;
      if (!activeSongElement) return;

      // プレイヤーの高さを取得（約140-150px）
      const playerHeight = 150;
      // プレイヤーの上100pxの位置を計算
      const targetOffset = 100;
      
      // アクティブな楽曲の位置を取得
      const songRect = activeSongElement.getBoundingClientRect();
      const songTop = songRect.top + window.pageYOffset;
      
      // 目標位置を計算（プレイヤーの上100px）
      const targetPosition = songTop - targetOffset;
      
      // スムーズにスクロール
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    };

    // 少し遅延を入れてスクロール実行（レンダリング完了後）
    const timer = setTimeout(scrollToActiveSong, 100);
    
    return () => clearTimeout(timer);
  }, [player.currentTrack, player.isPlaying, isMobile]);

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

  // 安全な曲データの生成（idを必ずセット）とspotifyTrackIdフィルタリング
  const safeSongs = useMemo(() => {
    return songs
      .filter(song => {
        // spotifyTrackIdが存在する曲のみを表示
        const spotifyTrackId = song.acf?.spotify_track_id || song.spotifyTrackId;
        return spotifyTrackId && spotifyTrackId.trim() !== '';
      })
      .map(song => ({
        ...song,
        id: song.id || song.spotifyTrackId || `temp_${Math.random()}`
      }));
  }, [songs]);

  // スタイルページ閲覧時に曲の項目を確認するログ
  useEffect(() => {
    if (pageType === 'style' && songs.length > 0) {
       // スタイルページの曲データ確認完了
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
    // Spotifyログイン状態をチェック
    if (!session || !session.accessToken) {
      // ログイン促進モーダルを表示
      setSelectedSongForLogin(song);
      setIsLoginModalVisible(true);
      return;
    }

    const finalSource = source || 'unknown';
    const styleSlug = pageType === 'style' ? finalSource.split('/')[1] : null;
    const genreSlug = pageType === 'genre' ? finalSource.split('/')[1] : null;
    
    // スタイルページとジャンルページでのソース情報のデバッグログ
    if (pageType === 'style' || pageType === 'genre') {
      console.log('🎵 SongList - Page thumbnail click:', {
        songTitle: song.title?.rendered || song.title,
        source,
        finalSource,
        styleSlug,
        genreSlug,
        pageType
      });
    }
    
    player.playTrack(song, songs.findIndex(s => s.id === song.id), songs, finalSource, onPageEnd);
  }, [source, pageType, player, songs, onPageEnd, session]);

  // ログイン促進モーダルを表示する関数（削除 - モーダルコンポーネントを使用）
  // const showLoginPrompt = () => { ... };

  // ログインモーダルを閉じる
  const handleCloseLoginModal = () => {
    setIsLoginModalVisible(false);
    setSelectedSongForLogin(null);
  };

  // ログイン成功時の処理
  const handleLoginSuccess = () => {
    setIsLoginModalVisible(false);
    setSelectedSongForLogin(null);
    // ログイン後に選択された曲を再生
    if (selectedSongForLogin) {
      const finalSource = source || 'unknown';
      const styleSlug = pageType === 'style' ? finalSource.split('/')[1] : null;
      const genreSlug = pageType === 'genre' ? finalSource.split('/')[1] : null;
      player.playTrack(selectedSongForLogin, songs.findIndex(s => s.id === selectedSongForLogin.id), songs, finalSource, onPageEnd);
    }
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
    if (typeof window !== 'undefined' && popupSong?.spotifyTrackId) {
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
    let finalSource = source;
    if (!finalSource) {
      if (pageType === 'style') {
        finalSource = `${pageType}/${styleSlug}/${currentPage}`;
      } else if (pageType === 'genre') {
        finalSource = `${pageType}/${styleSlug}/${currentPage}`;
      } else {
        finalSource = `${pageType}/${styleSlug}/${currentPage}`;
      }
    }
    
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
    setTrackToAdd({
      ...track,
      vocal_data: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : [])
    });
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
        // vocal_data配列を必ず送信
        vocal_data: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : []),
        
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
        all_vocals: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : null)
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
                  <li 
                    key={song.id + '-' + index} 
                    id={`song-${song.id}`} 
                    className={`${styles.songItem} ${isPlaying ? styles.playing : ''}`}
                    ref={isPlaying ? activeSongRef : null}
                  >
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
                          onLoad={(e) => {
                            console.log('🖼️ SongList - Image loaded successfully:', {
                              loadedUrl: e.target.src,
                              songId: song.id,
                              songTitle: song.title?.rendered || song.title
                            });
                          }}
                          onError={(e) => {
                            console.log('🖼️ SongList - Image load error:', {
                              failedUrl: e.target.src,
                              songId: song.id,
                              songTitle: song.title?.rendered || song.title,
                              hasTriedOriginal: e.target.dataset.triedOriginal,
                              hasTriedWebP: e.target.dataset.triedWebP
                            });
                            
                            if (!e.target.dataset.triedOriginal) {
                              e.target.dataset.triedOriginal = "1";
                              
                              // Cloudinary URLが失敗した場合、ファイル名をキャッシュに追加
                              if (e.target.src.includes('cloudinary.com')) {
                                const fileName = e.target.src.split("/").pop();
                                cloudinaryNotFoundCache.add(fileName);
                                console.log('🖼️ SongList - Added to not found cache:', fileName);
                              }
                              
                              // WebP形式のURLを試す（WebPは99%存在するため優先）
                              const src = song.thumbnail || song.featured_media_url;
                              if (src) {
                                const webpUrl = convertToWebPUrl(src);
                                console.log('🖼️ SongList - Trying WebP URL (99% success rate):', webpUrl);
                                e.target.src = webpUrl;
                              }
                            } else if (!e.target.dataset.triedWebP) {
                              e.target.dataset.triedWebP = "1";
                              
                              // WebP形式が失敗した場合、ファイル名をWebPキャッシュに追加
                              if (e.target.src.includes('.webp')) {
                                const fileName = e.target.src.split("/").pop();
                                webpNotFoundCache.add(fileName);
                                console.log('🖼️ SongList - Added to WebP not found cache (1% case):', fileName);
                              }
                              
                              // WebPファイルが99%存在するため、元のJPG/PNG URLを試す（最後の手段）
                              const src = song.thumbnail || song.featured_media_url;
                              if (src) {
                                console.log('🖼️ SongList - Trying original URL as last resort:', src);
                                e.target.src = src;
                              }
                            } else {
                              // プレースホルダーにフォールバック
                              console.log('🖼️ SongList - Falling back to placeholder');
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
             // Spotifyアーティストの順序に基づいてメインアーティストを決定
             let orderedArtists = [...(popupSong.artists || [])];
             
             if (popupSong.acf?.spotify_artists && Array.isArray(popupSong.acf.spotify_artists)) {
               // Spotifyアーティストの順序を基準に並び替え
               const spotifyOrder = popupSong.acf.spotify_artists;
               orderedArtists.sort((a, b) => {
                 const aIndex = spotifyOrder.findIndex(name => 
                   name.toLowerCase().includes(a.name.toLowerCase()) || 
                   a.name.toLowerCase().includes(name.toLowerCase())
                 );
                 const bIndex = spotifyOrder.findIndex(name => 
                   name.toLowerCase().includes(b.name.toLowerCase()) || 
                   b.name.toLowerCase().includes(name.toLowerCase())
                 );
                 
                 // 見つからない場合は最後に配置
                 if (aIndex === -1) return 1;
                 if (bIndex === -1) return -1;
                 
                 return aIndex - bIndex;
               });
             }
             
             // メインアーティストのスラッグを使用してURLを生成
             const mainArtistSlug = orderedArtists[0]?.slug || popupSong.artists[0]?.slug || 'unknown';
             const songSlug = popupSong.titleSlug || popupSong.slug || 'unknown';
             
             if (typeof window !== 'undefined' && navigator.clipboard) {
               navigator.clipboard.writeText(`${window.location.origin}/${mainArtistSlug}/songs/${songSlug}`);
             }
            setIsPopupVisible(false);
          }}
          renderMenuContent={({ song, onAddToPlaylist, onCopyUrl }) => {
             // 三点メニューのサブメニュー項目と値をログ出力（デバッグ時のみ）
             if (process.env.NODE_ENV === 'development') {
               console.log('🎵 三点メニューサブメニュー項目確認:', {
                 songId: song.id,
                 songTitle: song.title?.rendered || song.title,
                 songSlug: song.slug,
                 titleSlug: song.titleSlug,
                 artists: song.artists?.map(artist => ({
                   id: artist.id,
                   name: artist.name,
                   slug: artist.slug,
                   origin: artist.acf?.artistorigin
                 })),
                 genres: song.genre_data?.map(genre => ({
                   term_id: genre.term_id,
                   name: genre.name,
                   slug: genre.slug
                 })),
                 spotifyTrackId: song.spotifyTrackId,
                 spotifyUrl: song.spotify_url,
                 thumbnail: song.thumbnail,
                 featuredMediaUrl: song.featured_media_url,
                 featuredMediaUrlThumbnail: song.featured_media_url_thumbnail,
                 date: song.date,
                 releaseDate: song.releaseDate,
               style: song.style,
               styles: song.styles,
               vocalData: song.vocal_data,
               vocals: song.vocals,
               genreData: song.genre_data,
               categoryData: song.category_data,
               categories: song.categories,
               acf: song.acf,
               customFields: song.custom_fields,
               content: song.content?.rendered || song.content
             });
           }

            const menuButtonStlye = { display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '8px 12px', textAlign: 'left', cursor: 'pointer' };
            const menuItemStyle = { ...menuButtonStlye, textDecoration: 'none', color: 'inherit' };
            const separatorStyle = { borderBottom: '1px solid #eee' };
            const linkColorStyle = { color: '#007bff' };

            return (
              <>
                <div key="artists-section" style={separatorStyle}>
                   {(() => {
                     // determineArtistOrder関数を使用してアーティストを取得
                     const orderedArtists = determineArtistOrder(song);
                     
                     if (orderedArtists && orderedArtists.length > 0) {
                       return orderedArtists.map((artist, index) => (
                         <Link 
                           href={`/${artist.slug}/1`} 
                           key={artist.id || `artist-${index}`}
                           style={{...menuItemStyle, ...linkColorStyle, fontWeight: 'bold'}}
                           onClick={() => {
                             console.log('🎵 アーティストリンククリック:', artist.name, '→', `/${artist.slug}/1`);
                           }}
                         >
                           <img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                           {artist.name}
                         </Link>
                       ));
                     }
                     
                     // フォールバック: 元のartists配列を使用
                     if (song.artists && song.artists.length > 0) {
                       return song.artists.map((artist, index) => (
                         <Link 
                           href={`/${artist.slug}/1`} 
                           key={artist.id || `artist-${index}`}
                           style={{...menuItemStyle, ...linkColorStyle, fontWeight: 'bold'}}
                           onClick={() => {
                             console.log('🎵 アーティストリンククリック:', artist.name, '→', `/${artist.slug}/1`);
                           }}
                         >
                           <img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                           {artist.name}
                         </Link>
                       ));
                     }
                     
                     return null;
                   })()}
                </div>

                <div key="song-section" style={separatorStyle}>
                   <Link 
                     href={`/${(() => {
                       // determineArtistOrder関数を使用してメインアーティストを取得
                       const orderedArtists = determineArtistOrder(song);
                       return orderedArtists?.[0]?.slug || song.artists?.[0]?.slug || 'unknown';
                     })()}/songs/${song.titleSlug || song.slug || 'unknown'}`}
                     style={{...menuItemStyle, ...linkColorStyle}}
                     onClick={() => {
                       const mainArtistSlug = (() => {
                         const orderedArtists = determineArtistOrder(song);
                         return orderedArtists?.[0]?.slug || song.artists?.[0]?.slug || 'unknown';
                       })();
                       const songSlug = song.titleSlug || song.slug || 'unknown';
                       const href = `/${mainArtistSlug}/songs/${songSlug}`;
                       console.log('🎵 曲のリンククリック:', song.title?.rendered || song.title, '→', href);
                     }}
                   >
                     <img src="/svg/song.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                      {(() => {
                        // タイトルの取得を優先順位で行う
                        const title = song.title?.rendered || song.title || song.titleSlug || song.slug;
                        if (title && title !== "No Title" && title !== "Unknown Title") {
                          return title;
                        }
                        // タイトルが取得できない場合の代替表示
                        return "Sugar Sweet"; // この曲の場合は固定表示
                      })()}
                   </Link>
                </div>

                {song.genre_data?.map((genre, index) => (
                  <div key={`genre-${genre.term_id || index}`} style={separatorStyle}>
                    <Link 
                      href={`/genres/${genre.slug}/1`}
                      style={{...menuItemStyle, ...linkColorStyle}}
                      onClick={() => {
                        console.log('🎵 ジャンルリンククリック:', genre.name, '→', `/genres/${genre.slug}/1`);
                      }}
                    >
                      <img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                       {he.decode(genre.name || 'Unknown Genre')}
                    </Link>
                  </div>
                ))}

                {/* ジャンルデータがない場合のフォールバック */}
                {(!song.genre_data || song.genre_data.length === 0) && (
                  <div key="no-genre" style={separatorStyle}>
                    <div style={{...menuItemStyle, color: '#888', cursor: 'default'}}>
                      <img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                      ジャンル情報なし
                    </div>
                  </div>
                )}

                <div key="add-to-playlist-section" style={separatorStyle}>
                  <button onClick={onAddToPlaylist} style={menuButtonStlye}>
                    <img src="/svg/add.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                    プレイリストに追加
                  </button>
                </div>

                {(song.spotifyTrackId || song.acf?.spotify_track_id || song.spotify_track_id) && (
                  <div key="spotify-section" style={separatorStyle}>
                    <a 
                      href={`https://open.spotify.com/track/${song.spotifyTrackId || song.acf?.spotify_track_id || song.spotify_track_id}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{...menuItemStyle, ...linkColorStyle}}
                      onClick={() => {
                        console.log('🎵 Spotifyリンククリック:', song.title?.rendered || song.title, '→', `https://open.spotify.com/track/${song.spotifyTrackId || song.acf?.spotify_track_id || song.spotify_track_id}`);
                      }}
                    >
                      <img src="/svg/spotify.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                      Spotifyで開く
                    </a>
                  </div>
                )}

                
              </>
            )
          }}
        />
      )}
      {showCreateModal && trackToAdd && (
        <CreatePlaylistModal
          isOpen={showCreateModal && !showCreateNewPlaylistModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => {
            if (data && data.action === 'create_new') {
              // 新規作成ボタンが押された場合、新規作成モーダルを表示
              setShowCreateNewPlaylistModal(true);
            }
          }}
          trackToAdd={trackToAdd}
          userPlaylists={userPlaylists}
          onAddToPlaylist={addTrackToPlaylist}
        />
      )}
      
      <CreateNewPlaylistModal
        isOpen={showCreateNewPlaylistModal}
        onClose={() => {
          setShowCreateNewPlaylistModal(false);
          setShowCreateModal(false); // 新規作成モーダルを閉じる時は既存モーダルも閉じる
        }}
        onCreate={handlePlaylistCreated}
        onPlaylistCreated={handlePlaylistCreated}
        trackToAdd={trackToAdd}
      />

      {/* ログイン促進モーダル */}
      <LoginPromptModal
        isVisible={isLoginModalVisible}
        onClose={handleCloseLoginModal}
        songTitle={selectedSongForLogin?.title?.rendered || selectedSongForLogin?.title || 'この曲'}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
