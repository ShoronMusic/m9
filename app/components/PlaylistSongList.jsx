'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback, useContext } from "react";
import styles from "./PlaylistSongList.module.css";
import MicrophoneIcon from "./MicrophoneIcon";
import Link from "next/link";
import ThreeDotsMenu from "./ThreeDotsMenu";
import he from "he";
import { usePlayer, PlayerContext } from './PlayerContext';
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
  
  // 2. thumbnail_url フィールドを確認
  if (song.thumbnail_url) {
    if (song.thumbnail_url.startsWith('http')) {
      return song.thumbnail_url;
    }
    return `${CLOUDINARY_BASE_URL}${song.thumbnail_url}`;
  }
  
  // 3. youtubeId からローカルパスを生成
  if (song.youtubeId) {
    return `/images/thum/${song.youtubeId}.webp`;
  }
  
  // 4. featured_media_url を確認
  if (song.featured_media_url) {
    if (song.featured_media_url.startsWith('http')) {
      return song.featured_media_url;
    }
    return song.featured_media_url;
  }
  
  // 5. 上記すべてに該当しない場合はプレースホルダー
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

// プレイリスト用のアーティスト情報を適切に表示する関数
function formatPlaylistArtists(artists) {
  if (!artists) return "Unknown Artist";
  
  // 配列の場合
  if (Array.isArray(artists)) {
    const formattedArtists = artists.map(artist => {
      // 各要素がJSON文字列の場合
      if (typeof artist === 'string' && (artist.startsWith('{') || artist.startsWith('['))) {
        try {
          const parsed = JSON.parse(artist);
          // アーティストオブジェクトからnameフィールドを取得
          if (parsed && typeof parsed === 'object' && parsed.name) {
            const nationality = parsed.artistorigin || parsed.acf?.artistorigin;
            return nationality ? `${parsed.name} (${nationality})` : parsed.name;
          }
          // nameフィールドがない場合は最初の値を返す
          return Object.values(parsed)[0] || artist;
        } catch (e) {
          console.log('Artist JSON parsing failed:', e);
          return artist;
        }
      }
      // 文字列の場合はそのまま返す
      if (typeof artist === 'string') {
        return artist;
      }
      // オブジェクトの場合はnameフィールドまたは最初の値を返す
      if (typeof artist === 'object' && artist !== null) {
        const name = artist.name || Object.values(artist)[0] || JSON.stringify(artist);
        const nationality = artist.artistorigin || artist.acf?.artistorigin;
        return nationality ? `${name} (${nationality})` : name;
      }
      return artist;
    });
    
    return formattedArtists.join(', ');
  }
  
  // 配列以外の場合は文字列として処理
  if (typeof artists === 'string') {
    return artists;
  }
  
  return "Unknown Artist";
}

// プレイリスト用のスタイル情報を適切に表示する関数
function formatPlaylistStyle(styleName) {
  if (!styleName) return "Unknown Style";
  
  if (typeof styleName === 'string') {
    if (styleName.startsWith('{') || styleName.startsWith('[')) {
      try {
        const parsed = JSON.parse(styleName);
        if (parsed && typeof parsed === 'object' && parsed.name) {
          return parsed.name;
        }
        return Object.values(parsed)[0] || styleName;
      } catch (e) {
        return styleName;
      }
    }
    return styleName;
  }
  
  if (typeof styleName === 'object' && styleName !== null) {
    return styleName.name || Object.values(styleName)[0] || "Unknown Style";
  }
  
  return "Unknown Style";
}

// プレイリスト用の日付を適切に表示する関数
function formatPlaylistDate(dateStr) {
  if (!dateStr) return "Unknown Date";
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Unknown Date";
    
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '.');
  } catch (e) {
    return "Unknown Date";
  }
}

// 楽曲データを年度ごとにグループ化する関数
function groupPostsByYear(posts) {
  const groups = {};
  posts.forEach((song) => {
    const dateStr = song.release_date || song.added_at || song.date;
    const year = dateStr ? formatYearMonth(dateStr) : "Unknown Year";
    if (!groups[year]) groups[year] = [];
    groups[year].push(song);
  });
  return Object.keys(groups)
    .sort((a, b) => {
      if (a === "Unknown Year") return 1;
      if (b === "Unknown Year") return 1;
      return parseInt(b, 10) - parseInt(a, 10);
    })
    .map((year) => ({ year, songs: groups[year] }));
}

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

// 複数ジャンルを表示用のテキストに変換する関数
function formatMultipleGenres(genreData, fallbackGenreName = null) {
  // デバッグログを削除（ページ読み込み時の大量ログを防ぐ）
  // console.log('formatMultipleGenres called with:', genreData, 'fallbackGenreName:', fallbackGenreName);
  
  if (!genreData) {
    // console.log('genreData is null/undefined, checking fallbackGenreName');
    // genre_dataが空の場合、fallbackGenreNameを確認
    if (fallbackGenreName) {
      // console.log('Using fallbackGenreName:', fallbackGenreName);
      // カンマ区切りの場合は分割して「/」区切りに変換
      if (fallbackGenreName.includes(',')) {
        const result = fallbackGenreName.split(',').map(g => he.decode(g.trim())).join(' / ');
        // console.log('Converted comma-separated fallbackGenreName to:', result);
        return result;
      }
      // 単一ジャンルの場合はそのまま返す
      return he.decode(fallbackGenreName);
    }
    // console.log('No fallbackGenreName, returning null');
    return null;
  }
  
  try {
    // JSONBフィールドから直接取得する場合（最優先）
    if (Array.isArray(genreData)) {
      console.log('genreData is array, processing array items:', genreData);
      
      // 空の配列の場合、fallbackGenreNameを使用
      if (genreData.length === 0) {
        console.log('genreData array is empty, using fallbackGenreName');
        if (fallbackGenreName) {
          if (fallbackGenreName.includes(',')) {
            const result = fallbackGenreName.split(',').map(g => he.decode(g.trim())).join(' / ');
            console.log('Converted comma-separated fallbackGenreName to:', result);
            return result;
          }
          return he.decode(fallbackGenreName);
        }
        return null;
      }
      
      const genreNames = genreData
        .map((genre, index) => {
          console.log(`Processing genre[${index}]:`, genre);
          if (typeof genre === 'string') {
            console.log(`genre[${index}] is string:`, genre);
            return he.decode(genre);
          }
          if (typeof genre === 'object' && genre !== null) {
            // JSONBの形式: {"name": "Blues", "slug": "blues", "term_id": 432}
            const name = genre.name || genre.genre_name || genre.slug;
            console.log(`genre[${index}] is object, extracted name:`, name);
            return he.decode(name);
          }
          console.log(`genre[${index}] is other type:`, typeof genre, genre);
          return he.decode(String(genre));
        })
        .filter(name => {
          const isValid = name && name !== 'null' && name !== 'undefined' && name !== 'unknown';
          console.log(`Filtering name "${name}":`, isValid);
          return isValid;
        });
      
      const result = genreNames.length > 0 ? genreNames.join(' / ') : null;
      console.log('Final result from array processing:', result);
      return result;
    }
    
    // JSON文字列の場合
    if (typeof genreData === 'string') {
      console.log('genreData is string:', genreData);
      // 既にカンマ区切りの文字列の場合
      if (genreData.includes(',') && !genreData.includes('{')) {
        const result = genreData.split(',').map(g => he.decode(g.trim())).join(' / ');
        console.log('Comma-separated string result:', result);
        return result;
      }
      
      // JSON文字列の場合
      try {
        const parsed = JSON.parse(genreData);
        console.log('Parsed JSON string:', parsed);
        if (Array.isArray(parsed)) {
          const genreNames = parsed
            .map((genre, index) => {
              console.log(`Processing parsed genre[${index}]:`, genre);
              if (typeof genre === 'string') return he.decode(genre);
              if (typeof genre === 'object' && genre !== null) {
                // JSONBの形式: {"name": "Blues", "slug": "blues", "term_id": 432}
                const name = genre.name || genre.genre_name || genre.slug;
                console.log(`parsed genre[${index}] is object, extracted name:`, name);
                return he.decode(name);
              }
              return he.decode(String(genre));
            })
            .filter(name => name && name !== 'null' && name !== 'undefined' && name !== 'unknown');
          
          const result = genreNames.length > 0 ? genreNames.join(' / ') : null;
          console.log('Final result from parsed JSON:', result);
          return result;
        }
      } catch (parseError) {
        console.log('JSON parsing failed, returning original string:', genreData);
        // JSON解析に失敗した場合は、HTMLエンティティをデコードして返す
        return he.decode(genreData);
      }
    }
    
    // その他の場合
    if (typeof genreData === 'object' && genreData !== null) {
      console.log('genreData is object:', genreData);
      const genreNames = Object.values(genreData)
        .filter(name => name && name !== 'null' && name !== 'undefined' && name !== 'unknown')
        .map(name => he.decode(name));
      const result = genreNames.length > 0 ? genreNames.join(' / ') : null;
      console.log('Final result from object processing:', result);
      return result;
    }
    
    console.log('No matching type found, returning null');
    return null;
  } catch (e) {
    console.error('ジャンルデータの解析エラー:', e, 'genreData:', genreData);
    return null;
  }
}

// 複数スタイルを表示用のテキストに変換する関数
function formatMultipleStyles(styleData) {
  if (!styleData) return null;
  
  try {
    // JSONBフィールドから直接取得する場合
    if (Array.isArray(styleData)) {
      return styleData.map(style => {
        if (typeof style === 'number') {
          return getStyleName(style);
        }
        return style.name || `Style ${style}`;
      }).join(', ');
    }
    
    // JSON文字列の場合
    if (typeof styleData === 'string') {
      const parsed = JSON.parse(styleData);
      if (Array.isArray(parsed)) {
        return parsed.map(style => {
          if (typeof style === 'number') {
            return getStyleName(style);
          }
          return style.name || `Style ${style}`;
        }).join(', ');
      }
    }
    
    return null;
  } catch (e) {
    console.error('スタイルデータの解析エラー:', e);
    return null;
  }
}

// 複数ボーカルを表示用のテキストに変換する関数
function formatMultipleVocals(vocalData) {
  if (!vocalData) return null;
  
  try {
    // JSONBフィールドから直接取得する場合
    if (Array.isArray(vocalData)) {
      return vocalData.map(vocal => vocal.name).join(', ');
    }
    
    // JSON文字列の場合
    if (typeof vocalData === 'string') {
      const parsed = JSON.parse(vocalData);
      if (Array.isArray(parsed)) {
        return parsed.map(vocal => vocal.name).join(', ');
      }
    }
    
    return null;
  } catch (e) {
    console.error('ボーカルデータの解析エラー:', e);
    return null;
  }
}

// ボーカルアイコンを表示する関数（既存のソングリストと同じ方法）
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

// ──────────────────────────────
// PlaylistSongList コンポーネント本体
// ──────────────────────────────

export default function PlaylistSongList({
  tracks = [],
  playlistId,
  accessToken = null,
  source = null,
  onPageEnd = () => {},
  autoPlayFirst = false,
}) {
  const { data: session } = useSession();
  const { playTrack, setTrackList, updateCurrentTrackState } = usePlayer();
  const playerContext = useContext(PlayerContext);
  
  // PlayerContextの初期化状態をチェック
  const isPlayerReady = playTrack && setTrackList && updateCurrentTrackState;
  
  // デバッグ用：usePlayerから取得した関数の確認（ページ読み込み時のみ）
  useEffect(() => {
    console.log('🔧 PlaylistSongList - usePlayer functions loaded:', {
      playTrack: typeof playTrack,
      setTrackList: typeof setTrackList,
      updateCurrentTrackState: typeof updateCurrentTrackState,
      isPlayerReady
    });
  }, [playTrack, setTrackList, updateCurrentTrackState, isPlayerReady]);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTriggerRect, setMenuTriggerRect] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [playlistInfo, setPlaylistInfo] = useState(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const menuRef = useRef(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [popupSong, setPopupSong] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);



  // プレイリスト情報を取得
  useEffect(() => {
    if (playlistId) {
      const fetchPlaylistInfo = async () => {
        try {
          const response = await fetch(`/api/playlists/${playlistId}`);
          if (response.ok) {
            const data = await response.json();
            setPlaylistInfo(data);
            console.log('PlaylistSongList - Playlist info fetched:', data);
          }
        } catch (error) {
          console.error('Failed to fetch playlist info:', error);
        }
      };
      fetchPlaylistInfo();
    }
  }, [playlistId]);

  // PlayerContextの状態変化を監視
  useEffect(() => {
    console.log('🔍 PlaylistSongList - PlayerContext state changed:', {
      updateCurrentTrackState: typeof updateCurrentTrackState,
      trackList: typeof setTrackList
    });
  }, [updateCurrentTrackState, setTrackList]);

  // autoPlayFirst機能：最初の曲を自動再生
  useEffect(() => {
    if (autoPlayFirst && tracks.length > 0 && playTrack && setTrackList && updateCurrentTrackState) {
      console.log('🎵 AutoPlayFirst triggered:', {
        autoPlayFirst,
        tracksCount: tracks.length,
        firstTrack: tracks[0]
      });
      
      try {
        const firstTrack = tracks[0];
        // プレイリスト名とIDを含むソースを作成（リンク用）
        const playlistName = playlistInfo?.name || 'Unknown Playlist';
        const finalSource = source || `playlist: ${playlistName}|${playlistId}`;
        
        console.log('🚀 Setting up auto-play for first track:', {
          track: firstTrack.title || firstTrack.title?.rendered,
          source: finalSource
        });
        
        // プレイリスト全体をキューに設定
        setTrackList(tracks);
        updateCurrentTrackState(firstTrack, 0);
        
        // 最初の曲を再生
        playTrack(firstTrack, 0, tracks, finalSource, onPageEnd);
        
        console.log('✅ Auto-play setup completed successfully');
      } catch (error) {
        console.error('❌ Auto-play setup failed:', error);
      }
    }
  }, [autoPlayFirst, tracks, playTrack, setTrackList, updateCurrentTrackState, source, playlistId, onPageEnd]);

  // Spotify Track IDsを抽出（ページ内の曲のみ）
  const trackIds = useMemo(() => {
    const ids = tracks
      .map(track => track.spotify_track_id || track.track_id)
      .filter(id => id); // null/undefinedを除外
    
    // デバッグ情報を出力
    console.log('PlaylistSongList - trackIds extracted:', {
      tracks: tracks.map(t => ({ id: t.id, title: t.title, spotify_track_id: t.spotify_track_id, track_id: t.track_id })),
      extractedIds: ids
    });
    
    return ids;
  }, [tracks]);

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
  const safeTracks = useMemo(() => {
    const processedTracks = tracks.map(track => {
      // spotify_track_idがnullの場合は、track_idをspotify_track_idとして使用
      // ただし、これは一時的な解決策で、本来は正しいSpotify Track IDを使用すべき
      const spotifyTrackId = track.spotify_track_id || track.track_id;
      
      // 警告：track_idがSpotify Track IDとして使用されている場合
      if (!track.spotify_track_id && track.track_id) {
        console.warn(`Warning: Using track_id (${track.track_id}) as spotify_track_id for track "${track.title}". This may cause playback issues.`);
      }
      
      return {
        ...track,
        id: track.id || track.track_id || `temp_${Math.random()}`,
        // 既存のSongList.jsで期待される形式に変換
        title: { rendered: track.title || "No Title" },
        artists: Array.isArray(track.artists) ? track.artists.map(artist => {
          // アーティストデータが文字列の場合はパース
          if (typeof artist === 'string') {
            try {
              return JSON.parse(artist);
            } catch (e) {
              // パースできない場合は基本的なアーティストオブジェクトを作成
              return {
                id: Math.random().toString(36).substr(2, 9),
                name: artist,
                slug: artist.toLowerCase().replace(/ /g, '-'),
                acf: { artistorigin: 'Unknown' }
              };
            }
          }
          // 既にオブジェクトの場合はそのまま使用
          return artist;
        }) : [],
        acf: {
          spotify_track_id: spotifyTrackId,
          ytvideoid: track.youtube_id || track.ytvideoid || '',
          youtube_id: track.youtube_id || track.ytvideoid || '',
        },
        date: track.release_date || track.added_at || '',
        thumbnail: track.thumbnail || track.thumbnail_url,
        youtubeId: track.youtube_id || track.ytvideoid || '',
        spotifyTrackId: spotifyTrackId,
        genre_data: track.genre_data || track.genres || [],
        genres: track.genres || track.genre_data || [],
        vocal_data: track.vocal_data || [],
        style: track.style || track.styles || [],
        styles: track.styles || track.style || [],
        style_id: track.style_id || (track.style && Array.isArray(track.style) && track.style.length > 0 ? track.style[0].term_id : null) || track.acf?.style_id,
        style_name: track.style_name || (track.style && Array.isArray(track.style) && track.style.length > 0 ? track.style[0].name : null) || track.acf?.style_name || getStyleName(track.style_id || track.acf?.style_id),
        slug: track.title ? track.title.toLowerCase().replace(/ /g, "-") : track.id,
        content: { rendered: track.title || "" },
        // 元のデータにもspotify_track_idを設定
        spotify_track_id: spotifyTrackId,
      };
    });
    
    // デバッグ情報を出力
    console.log('PlaylistSongList - safeTracks processed:', {
      originalTracks: tracks,
      processedTracks: processedTracks,
      sampleTrack: processedTracks[0],
      sampleTrackStyleInfo: processedTracks[0] ? {
        style: processedTracks[0].style,
        styles: processedTracks[0].styles,
        style_id: processedTracks[0].style_id,
        style_name: processedTracks[0].style_name,
        originalStyle: tracks[0]?.style,
        originalStyles: tracks[0]?.styles,
        originalStyleId: tracks[0]?.style_id,
        originalStyleName: tracks[0]?.style_name
      } : null
    });
    
    return processedTracks;
  }, [tracks]);

  // Spotify APIを使用したいいねボタン用の toggleLike 関数
  const handleLikeToggle = async (trackId) => {
    if (!session?.user) {
      alert("この機能を使用するにはSpotifyでログインしてください");
      return;
    }
    
    if (!accessToken) {
      alert("Spotifyにログインしてください");
      return;
    }

    if (likesError) {
      alert(`エラー: ${likesError}`);
      return;
    }

    try {
      const isCurrentlyLiked = likedTracks.has(trackId);
      const success = await spotifyToggleLike(trackId, !isCurrentlyLiked);

      if (!success) {
        alert(isCurrentlyLiked ? "いいねの解除に失敗しました。" : "いいねの追加に失敗しました。");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      alert("エラーが発生しました。もう一度お試しください。");
    }
  };

  const handleThumbnailClick = useCallback((track) => {
    console.log('🚀🚀🚀 handleThumbnailClick FUNCTION START 🚀🚀🚀');
    console.log('🎵 Function called at:', new Date().toISOString());
    console.log('🎵 Function call stack:', new Error().stack);
    console.log('📁 Track data:', track);
    console.log('🔍 Track ID:', track.id);
    console.log('🎵 Track title:', track.title);
    console.log('🎤 Track artists:', track.artists);
    console.log('🎧 Spotify Track ID:', track.spotify_track_id || track.spotifyTrackId || track.acf?.spotify_track_id);
    
    // ログインチェック：ログインしていない場合はSpotifyログインを促す
    if (!session?.user) {
      alert('この曲を再生するにはSpotifyでログインしてください。');
      return;
    }
    
    // usePlayerフックから取得した関数の可用性をチェック
    if (!playTrack || !setTrackList || !updateCurrentTrackState) {
      console.error('❌ Player functions not available:', {
        playTrack: typeof playTrack,
        setTrackList: typeof setTrackList,
        updateCurrentTrackState: typeof updateCurrentTrackState
      });
      alert('プレーヤーの初期化が完了していません。しばらく待ってから再度お試しください。');
      return;
    }
    
    // プレイリスト名とIDを含むソースを作成（リンク用）
    const playlistName = playlistInfo?.name || 'Unknown Playlist';
    const finalSource = source || `playlist: ${playlistName}|${playlistId}`;
    const trackIndex = tracks.findIndex(t => t.id === track.id);
    
    // プレイリストでのソース情報のデバッグログ
    console.log('🎵 PlaylistSongList - Playlist thumbnail click:', {
      trackTitle: track.title?.rendered || track.title,
      source,
      finalSource,
      playlistId,
      playlistName,
      trackIndex,
      styleInfo: {
        style: track.style,
        styles: track.styles,
        style_id: track.style_id,
        style_name: track.style_name
      }
    });
    
            console.log('📍 Playlist info:', {
          playlistId,
          playlistName,
          source,
          finalSource,
          trackIndex,
          tracksLength: tracks.length
        });
    
    console.log('⚙️ Function availability:', {
      playTrack: typeof playTrack,
      setTrackList: typeof setTrackList,
      updateCurrentTrackState: typeof updateCurrentTrackState,
      onPageEnd: typeof onPageEnd
    });
    
    try {
      // 処理された曲データを使用
      const processedTrack = safeTracks.find(t => t.id === track.id);
              console.log('🔧 Processed track found:', processedTrack);
        console.log('🎨 Processed track style info:', {
          style: processedTrack.style,
          styles: processedTrack.styles,
          style_id: processedTrack.style_id,
          style_name: processedTrack.style_name
        });
        
        if (processedTrack) {
          console.log('✅ Using processed track for playback');
          console.log('📋 Setting track list with safeTracks:', safeTracks.length, 'tracks');
          console.log('🎯 Setting current track index:', trackIndex);
          console.log('🎵 Setting current track:', processedTrack.title || processedTrack.title?.rendered);
        
        // PlayerContextのplayTrack関数を直接呼び出し
        // プレイリスト全体をキューに設定してから再生
        setTrackList(safeTracks);
        updateCurrentTrackState(processedTrack, trackIndex);
        
        console.log('🚀 Calling playTrack function...');
        console.log('📤 playTrack parameters:', {
          track: processedTrack,
          index: trackIndex,
          songs: safeTracks,
          source: finalSource,
          onPageEnd: onPageEnd
        });
        
        playTrack(processedTrack, trackIndex, safeTracks, finalSource, onPageEnd);
        console.log('✅ playTrack called successfully');
        
        // 状態更新後の確認
        setTimeout(() => {
          console.log('🔄 State update verification (after 100ms):');
          console.log('   - Track list should be updated');
          console.log('   - Current track index should be:', trackIndex);
          console.log('   - Current track should be set');
        }, 100);
        
      } else {
        console.error('❌ Processed track not found for ID:', track.id);
        console.log('🔄 Falling back to original track');
        console.log('📋 Setting track list with original tracks:', tracks.length, 'tracks');
        console.log('🎯 Setting current track index:', trackIndex);
        console.log('🎵 Setting current track:', track.title || track.title?.rendered);
        
        // 元のトラックリストを使用
        setTrackList(tracks);
        updateCurrentTrackState(track, trackIndex);
        
        console.log('🚀 Calling playTrack function with original track...');
        console.log('📤 playTrack parameters:', {
          track: track,
          index: trackIndex,
          songs: tracks,
          source: finalSource,
          onPageEnd: onPageEnd
        });
        
        playTrack(track, trackIndex, tracks, finalSource, onPageEnd);
        console.log('✅ playTrack called successfully with original track');
      }
    } catch (error) {
      console.error('💥 Error in handleThumbnailClick:', error);
      console.error('💥 Error stack:', error.stack);
      alert('曲の再生中にエラーが発生しました。もう一度お試しください。');
    }
    
    console.log('🏁🏁🏁 handleThumbnailClick FUNCTION END 🏁🏁🏁');
  }, [source, playlistId, playTrack, tracks, safeTracks, onPageEnd, setTrackList, updateCurrentTrackState]);

  const handleThreeDotsClick = (e, track) => {
    e.stopPropagation();
    
    // ログインチェック：ログインしていない場合はSpotifyログインを促す
    if (!session?.user) {
      alert('このメニューを使用するにはSpotifyでログインしてください。');
      return;
    }
    
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
    
         // ジャンル情報を適切に準備
     let genres = [];
     
     // 1. genre_data（JSONB配列）から取得を試行
     if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
       genres = track.genre_data.map(genre => {
         if (typeof genre === 'object' && genre !== null) {
           const genreName = he.decode(genre.name || genre.genre_name || genre.slug || 'Unknown Genre');
           return {
             name: genreName,
             slug: genre.slug || genreName.toLowerCase().replace(/\s+/g, '-'),
             term_id: genre.term_id || genre.id || Math.random().toString(36).substr(2, 9)
           };
         }
         const genreName = he.decode(String(genre));
         return {
           name: genreName,
           slug: genreName.toLowerCase().replace(/\s+/g, '-'),
           term_id: Math.random().toString(36).substr(2, 9)
         };
       });
     }
     // 2. genre_name（カンマ区切り文字列）から取得を試行
     else if (track.genre_name && typeof track.genre_name === 'string') {
       const genreNames = track.genre_name.split(',').map(name => he.decode(name.trim())).filter(name => name);
       genres = genreNames.map(name => ({
         name: name,
         slug: name.toLowerCase().replace(/\s+/g, '-'),
         term_id: Math.random().toString(36).substr(2, 9)
       }));
     }
    
    // メニュー表示用のデータを準備
    const menuTrack = {
      ...track,
      // ジャンル情報を設定
      genres: genres,
      // スラッグ情報を準備
      slug: track.slug || track.titleSlug || (track.title ? track.title.toLowerCase().replace(/\s+/g, '-') : null),
      titleSlug: track.titleSlug || track.slug || (track.title ? track.title.toLowerCase().replace(/\s+/g, '-') : null)
    };
    
    // デバッグ用：ジャンル情報を確認
    console.log('PlaylistSongList - handleThreeDotsClick - track data:', {
      originalTrack: track,
      preparedGenres: genres,
      menuTrack: menuTrack
    });
    
    setPopupPosition({ top, left });
    setPopupSong(menuTrack);
    setIsPopupVisible(true);
  };

  const handleExternalLinkClick = () => {
    if (popupSong?.spotify_track_id) {
      window.open(`https://open.spotify.com/track/${popupSong.spotify_track_id}`, '_blank');
    }
    setIsPopupVisible(false);
  };

  const handleAddToPlaylistClick = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      setTrackToAdd(track);
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

  const groupedTracks = useMemo(() => {
    const groups = {};
    tracks.forEach((track, index) => {
      const dateStr = track.release_date || track.added_at;
      const year = dateStr ? formatYearMonth(dateStr) : "Unknown Year";
      if (!groups[year]) groups[year] = [];
      groups[year].push({ ...track, originalIndex: index });
    });
    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === "Unknown Year") return 1;
      if (b === "Unknown Year") return 1;
      return parseInt(b, 10) - parseInt(a, 10);
    });
    return sortedYears.map((year) => {
      const sortedTracks = groups[year].sort((a, b) => {
        const dateA = new Date(a.release_date || a.added_at).getTime();
        const dateB = new Date(b.release_date || b.added_at).getTime();
        return dateB - dateA;
      });
      return { year, songs: sortedTracks };
    });
  }, [tracks]);

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

  // プレイリストから曲を削除する関数
  const handleRemoveFromPlaylist = async (trackId) => {
    try {
      console.log('PlaylistSongList - handleRemoveFromPlaylist called:', {
        trackId,
        playlistId,
        trackIdType: typeof trackId,
        playlistIdType: typeof playlistId,
        session: session,
        sessionExists: !!session,
        sessionUser: session?.user,
        // 現在のユーザーIDを詳細に出力
        currentUserId: session?.user?.id,
        currentUserEmail: session?.user?.email,
        // プレイリスト情報も出力
        playlist: playlistInfo,
        // ユーザーIDの比較
        currentUserIdFromSession: session?.user?.id,
        playlistUserIdFromInfo: playlistInfo?.user_id,
        userIdsMatch: session?.user?.id === playlistInfo?.user_id
      });
      if (!trackId) {
        console.error('trackId is missing or invalid:', trackId);
        return;
      }
      if (!playlistId) {
        console.error('playlistId is missing or invalid:', playlistId);
        return;
      }
      // セッションチェック
      if (!session || !session.user) {
        console.error('User not authenticated. Session:', session);
        alert('ログインが必要です。Spotifyログインを行ってください。');
        return;
      }
      const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // 認証ヘッダーを追加
          'Authorization': `Bearer ${session.accessToken}`,
        },
        // 認証情報を含める
        credentials: 'include',
        // セッション情報をリクエストボディに含める
        body: JSON.stringify({
          session: {
            user: session.user,
            accessToken: session.accessToken
          }
        }),
      });
      console.log('PlaylistSongList - DELETE response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('PlaylistSongList - DELETE error response:', errorData);
        if (response.status === 401) {
          alert('認証エラーが発生しました。Spotifyログインを再実行してください。');
        } else if (response.status === 403) {
          alert('アクセスが拒否されました。このプレイリストの所有者ではありません。');
        } else {
          throw new Error(`曲の削除に失敗しました: ${response.status} ${response.statusText}`);
        }
        return;
      }
      const result = await response.json();
      console.log('PlaylistSongList - DELETE success:', result);
      console.log('プレイリストから曲を削除しました！');
      window.location.reload(); // 簡単な方法としてページを再読み込み
      setIsPopupVisible(false); // ポップアップを閉じる
    } catch (err) {
      console.error('曲の削除に失敗しました:', err.message);
      // エラーメッセージをユーザーに表示
      alert(`削除に失敗しました: ${err.message}`);
    }
  };

  // 既存プレイリストに追加
  const addTrackToPlaylist = async (track, playlistId) => {
    try {
      // スタイル情報を取得
      let styleInfo = null;
      if (track.style && Array.isArray(track.style) && track.style.length > 0) {
        const styleItem = track.style[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      } else if (track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
        const styleItem = track.styles[0];
        if (typeof styleItem === 'number' || typeof styleItem === 'string') {
          // IDのみの場合は、IDをterm_idとして設定し、スタイル名を取得
          const styleId = parseInt(styleItem);
          styleInfo = { term_id: styleId, name: getStyleName(styleId) };
        } else if (typeof styleItem === 'object' && styleItem !== null) {
          styleInfo = styleItem;
        }
      }

      // ジャンル情報を取得
      let genreInfo = null;
      if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
        genreInfo = track.genre_data[0];
      } else if (track.genres && Array.isArray(track.genres) && track.genres.length > 0) {
        genreInfo = track.genres[0];
      }

      // ボーカル情報を取得
      let vocalInfo = null;
      if (track.vocal_data && Array.isArray(track.vocal_data) && track.vocal_data.length > 0) {
        vocalInfo = track.vocal_data[0];
      } else if (track.vocals && Array.isArray(track.vocals) && track.vocals.length > 0) {
        vocalInfo = track.vocals[0];
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
      if (track.date) {
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

      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          song_id: track.song_id || track.id,
          track_id: track.track_id || track.id,
          title: track.title,
          artists: track.artists,
          thumbnail_url: thumbnailUrl,
          style_id: styleInfo?.term_id || track.style_id,
          style_name: styleInfo?.name || track.style_name,
          release_date: releaseDate,
          spotify_track_id: track.spotify_track_id || track.spotifyTrackId || track.acf?.spotify_track_id,
          genre_id: genreInfo?.term_id || track.genre_id,
          genre_name: genreInfo?.name || track.genre_name,
          vocal_id: vocalInfo?.term_id || track.vocal_id,
          vocal_name: vocalInfo?.name || track.vocal_name,
          is_favorite: false, // 新規追加時はデフォルトでfalse
          spotify_images: spotifyImages
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

  // 自動再生機能
  const prevSourceRef = useRef();
  useEffect(() => {
    // プレイリスト名とIDを含むソースを作成（リンク用）
    const playlistName = playlistInfo?.name || 'Unknown Playlist';
    const finalSource = source || `playlist: ${playlistName}|${playlistId}`;
    if (autoPlayFirst && tracks.length > 0 && prevSourceRef.current !== finalSource) {
      prevSourceRef.current = finalSource;
      const firstTrack = tracks[0];
      
      // デバッグ情報を出力
      console.log('PlaylistSongList - Auto-play first track:', {
        firstTrack,
        spotifyTrackId: firstTrack.spotify_track_id || firstTrack.spotifyTrackId || firstTrack.acf?.spotify_track_id,
        finalSource,
        playlistName
      });
      
      try {
        playTrack(firstTrack, 0, tracks, finalSource, onPageEnd);
      } catch (error) {
        console.error('Error auto-playing first track:', error);
      }
    }
  }, [autoPlayFirst, tracks, source, playlistId, playlistInfo, onPageEnd, playTrack]);

  return (
    <div className={styles.playlistWrapper}>
      {/* ヘッダー */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>TRACKS</div>
          <div className={styles.headerInfo}>
            {safeTracks.length} tracks
          </div>
        </div>
      </div>

      <ul className={styles.songList}>
        {tracks.map((track, index) => {
          try {
            const title = decodeHtml(track.title || "No Title");
            const thumbnailUrl = getThumbnailUrl(track);
            const artistText = formatPlaylistArtists(track.artists);
            
            // 公開日を年月のみで表示（2025.08形式）
            const releaseDate = track.release_date ? formatYearMonth(track.release_date) : null;
            
            // 複数ジャンルを表示用のテキストに変換（genre_data JSONBを最優先、genre_nameをフォールバック）
            const genreText = formatMultipleGenres(track.genre_data, track.genre_name);
            
            // ボーカルデータを配列形式に変換（既存のソングリストと同じ形式）
            const vocalData = track.vocal_name ? 
              [{ name: track.vocal_name }] : 
              (Array.isArray(track.vocal_data) ? track.vocal_data : []);
            
            // デバッグ用：データの状態を確認（サムネイルクリック時のみ表示）
            // console.log(`Track ${index + 1} data:`, {
            //   title,
            //   thumbnailUrl,
            //   genre_data: track.genre_data,
            //   genre_name: track.genre_name,
            //   genreText,
            //   vocal_name: track.vocal_name,
            //   vocal_data: track.vocal_data,
            //   vocalData,
            //   thumbnail: track.thumbnail,
            //   thumbnail_url: track.thumbnail_url,
            //   youtubeId: track.youtubeId
            // });
            
            // Spotify Track IDを取得
            const spotifyTrackId = track.spotify_track_id || track.track_id;
            const isLiked = spotifyTrackId ? likedTracks.has(spotifyTrackId) : false;
            // 現在再生中の曲かどうかを判定
            const isPlaying = playerContext?.currentTrack?.id === track.id && playerContext?.isPlaying;

            return (
              <li key={track.id + '-' + index} id={`song-${track.id}`} className={`${styles.songItem} ${isPlaying ? styles.playing : ''}`}>
                <button
                  className={styles.thumbnailContainer}
                  onClick={(e) => {
                    console.log('🎯🎯🎯 THUMBNAIL CLICKED! 🎯🎯🎯');
                    console.log('🖱️ Thumbnail button clicked!', {
                      trackId: track.id,
                      trackTitle: track.title || track.title?.rendered,
                      index: index,
                      event: e
                    });
                    console.log('🎯🎯🎯 CALLING handleThumbnailClick 🎯🎯🎯');
                    handleThumbnailClick(track, index);
                  }}
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
                          const src = track.thumbnail || track.thumbnail_url;
                          if (src) {
                            const fileName = src.split("/").pop();
                            e.target.src = `${CLOUDINARY_BASE_URL}${fileName}`;
                          }
                        } else if (!e.target.dataset.triedOriginal) {
                          e.target.dataset.triedOriginal = "1";
                          // 元のURLを試す
                          const src = track.thumbnail || track.thumbnail_url;
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
                  <div className={styles.line1}>
                    {artistText} - {title}
                  </div>
                  <div className={styles.line2} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                    {releaseDate && (
                      <span>{releaseDate}</span>
                    )}
                    {genreText && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        ({genreText})
                      </span>
                    )}
                    {renderVocalIcons(vocalData)}
                  </div>
                </div>
                
                <div className={styles.rightIcons}>
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
                        
                        // ログインチェック
                        if (!session?.user) {
                          alert('この機能を使用するにはSpotifyでログインしてください。');
                          return;
                        }
                        
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
                          width: "16px", 
                          height: "16px",
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
                  <button
                    className={styles.threeDotsButton}
                    onClick={(e) => handleThreeDotsClick(e, track)}
                    aria-label="More options"
                  >
                    ⋮
                  </button>
                </div>
              </li>
            );
          } catch (e) {
            console.error(`ビルドエラー: 曲ID=${track.id}, タイトル=${track.title}`, e);
            throw e;
          }
        })}
      </ul>
      {/* ポップアップメニュー */}
      {isPopupVisible && popupSong && (
        <ThreeDotsMenu
          song={popupSong}
          position={popupPosition}
          onClose={() => setIsPopupVisible(false)}
          onAddToPlaylist={() => handleAddToPlaylistClick(popupSong.id)}
          onCopyUrl={() => {
            navigator.clipboard.writeText(`${window.location.origin}/playlists/${playlistId}`);
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
                   {song.artists?.map((artist, index) => {
                     // アーティストデータの処理
                     let artistName = '';
                     let artistSlug = '';
                     
                     // 文字列の場合はJSONとして解析を試行
                     if (typeof artist === 'string') {
                       try {
                         const parsed = JSON.parse(artist);
                         artistName = he.decode(parsed.name || parsed.artistorigin || artist);
                         artistSlug = parsed.slug || artistName.toLowerCase().replace(/\s+/g, '-');
                       } catch (e) {
                         artistName = he.decode(artist);
                         artistSlug = artistName.toLowerCase().replace(/\s+/g, '-');
                       }
                     } else if (typeof artist === 'object' && artist !== null) {
                       artistName = he.decode(artist.name || artist.artistorigin || Object.values(artist)[0] || 'Unknown Artist');
                       artistSlug = artist.slug || artistName.toLowerCase().replace(/\s+/g, '-');
                     } else {
                       artistName = he.decode(String(artist || 'Unknown Artist'));
                       artistSlug = artistName.toLowerCase().replace(/\s+/g, '-');
                     }
                     
                     // アーティスト名が空の場合はスキップ
                     if (!artistName || artistName === 'Unknown Artist') {
                       return null;
                     }
                     
                     return (
                       <Link href={`/${artistSlug}`} key={`artist-${index}`} legacyBehavior>
                         <a style={{ ...menuItemStyle, ...linkColorStyle, fontWeight: 'bold' }}>
                           <img src="/svg/musician.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                           {artistName}
                         </a>
                       </Link>
                     );
                   }).filter(Boolean)}
                 </div>

                                 <div key="song-section" style={separatorStyle}>
                   {(() => {
                     // アーティストスラッグを適切に取得
                     let artistSlug = 'unknown';
                     if (song.artists && song.artists.length > 0) {
                       const firstArtist = song.artists[0];
                       if (typeof firstArtist === 'string') {
                         try {
                           const parsed = JSON.parse(firstArtist);
                           artistSlug = parsed.slug || he.decode(parsed.name || firstArtist).toLowerCase().replace(/\s+/g, '-');
                         } catch (e) {
                           artistSlug = he.decode(firstArtist).toLowerCase().replace(/\s+/g, '-');
                         }
                       } else if (typeof firstArtist === 'object' && firstArtist !== null) {
                         artistSlug = firstArtist.slug || he.decode(firstArtist.name || Object.values(firstArtist)[0] || 'unknown').toLowerCase().replace(/\s+/g, '-');
                       }
                     }
                     
                     // 曲のスラッグを取得
                     const songSlug = song.slug || song.titleSlug || (song.title ? he.decode(song.title).toLowerCase().replace(/\s+/g, '-') : 'unknown');
                     
                     return (
                       <Link href={`/${artistSlug}/songs/${songSlug}`} legacyBehavior>
                         <a style={{...menuItemStyle, ...linkColorStyle}}>
                           <img src="/svg/song.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                           {he.decode(song.title?.rendered || song.title || "No Title")}
                         </a>
                       </Link>
                     );
                   })()}
                 </div>

                {song.genres && song.genres.length > 0 && song.genres.map((genre, index) => (
                  <div key={`genre-${genre.term_id || index}`} style={separatorStyle}>
                    <Link href={`/genres/${genre.slug}/1`} legacyBehavior>
                      <a style={{...menuItemStyle, ...linkColorStyle}}>
                        <img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                        {genre.name}
                      </a>
                    </Link>
                  </div>
                ))}
                
                                 {/* フォールバック：genre_nameが存在する場合 */}
                 {(!song.genres || song.genres.length === 0) && song.genre_name && typeof song.genre_name === 'string' && (
                   <div key="fallback-genre" style={separatorStyle}>
                     {(() => {
                       const decodedGenreName = he.decode(song.genre_name);
                       const genreSlug = decodedGenreName.toLowerCase().replace(/\s+/g, '-');
                       return (
                         <Link href={`/genres/${genreSlug}/1`} legacyBehavior>
                           <a style={{...menuItemStyle, ...linkColorStyle}}>
                             <img src="/svg/genre.png" alt="" style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(50%)' }} />
                             {decodedGenreName}
                           </a>
                         </Link>
                       );
                     })()}
                   </div>
                 )}

                <div key="add-to-playlist-section" style={separatorStyle}>
                  <button onClick={onAddToPlaylist} style={menuButtonStlye}>
                    <img src="/svg/add.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                    プレイリストに追加
                  </button>
                </div>

                {song.spotify_track_id && (
                  <div key="spotify-section" style={separatorStyle}>
                    <a href={`https://open.spotify.com/track/${song.spotify_track_id}`} target="_blank" rel="noopener noreferrer" style={{...menuItemStyle, ...linkColorStyle}}>
                      <img src="/svg/spotify.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                      Spotifyで開く
                    </a>
                  </div>
                )}

                <div key="remove-from-playlist-section">
                  <button 
                    onClick={() => {
                      console.log('PlaylistSongList - Remove button clicked:', {
                        song: song,
                        songId: song.id,
                        songIdType: typeof song.id
                      });
                      handleRemoveFromPlaylist(song.id);
                    }} 
                    style={menuButtonStlye}
                  >
                    <span style={{ width: 16, height: 16, marginRight: 8, fontSize: '16px' }}>🗑️</span>
                    プレイリストから削除
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
