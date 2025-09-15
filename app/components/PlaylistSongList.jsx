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

// ヘルパー関数
function removeLeadingThe(str = "") {
  return str.replace(/^The\s+/i, "").trim();
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

  artists.forEach((artist) => {
    const name = artist.name || artist;
    const lowerName = name.toLowerCase();

    // フィーチャーアーティストの判定
    if (
      lowerName.includes("feat.") ||
      lowerName.includes("ft.") ||
      lowerName.includes("featuring") ||
      lowerName.includes("feat ") ||
      lowerName.includes("ft ")
    ) {
      featuredArtists.push(artist);
    } else {
      mainArtists.push(artist);
    }
  });

  // メインアーティストを最初に、フィーチャーアーティストを後ろに
  return [...mainArtists, ...featuredArtists];
}

// アーティストの順番を決定する関数
function determineArtistOrder(song) {
  // デバッグ用ログ
  console.log('🎯 PlaylistSongList determineArtistOrder song:', song);
  
  // spotify_artistsの順番を最優先
  const spotifyArtists = song.acf?.spotify_artists || song.custom_fields?.spotify_artists || song.spotify_artists;
  
  if (spotifyArtists) {
    // 文字列の場合（カンマ区切り）
    if (typeof spotifyArtists === 'string') {
      console.log('🎯 PlaylistSongList using spotify_artists string:', spotifyArtists);
      
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
      console.log('🎯 PlaylistSongList using spotify_artists array:', spotifyArtists);
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
  
  // プレイリストのトラックデータの場合、artistsが文字列の可能性がある
  if (typeof song.artists === 'string' && song.artists.trim()) {
    try {
      const parsedArtists = JSON.parse(song.artists);
      if (Array.isArray(parsedArtists) && parsedArtists.length > 0) {
        return prioritizeMainArtist(parsedArtists);
      }
    } catch (e) {
      console.log('🎯 PlaylistSongList artists JSON parse error:', e);
      // パースできない場合は、文字列からアーティスト名を抽出
      const patterns = [
        /"name":"([^"]+)"/g,
      ];
      
      for (const pattern of patterns) {
        const matches = [...song.artists.matchAll(pattern)];
        if (matches.length > 0) {
          const artistNames = matches.map(match => match[1]);
          return artistNames.map(name => ({ name, slug: name.toLowerCase().replace(/\s+/g, '-') }));
        }
      }
    }
  }
  
  // フォールバック: 空の配列を返す
  console.log('🎯 PlaylistSongList determineArtistOrder: フォールバック - アーティストが見つかりません');
  return [];
}
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// CloudinaryのベースURL（正しい形式）
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

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
    console.log('🖼️ PlaylistSongList - Converting to WebP:', {
      original: originalUrl,
      webp: webpUrl
    });
    return webpUrl;
  }
  
  // 既にWebPの場合はそのまま返す
  return originalUrl;
}

// ──────────────────────────────
// ヘルパー関数群
// ──────────────────────────────

// サムネイルURLを取得する関数（SongList.jsと同じロジック）
function getThumbnailUrl(song) {
  
  // thumbnail_urlを優先して処理（Supabaseからのデータ）
  const thumbnailUrl = song.thumbnail_url || song.thumbnail;
  if (thumbnailUrl) {
    const fileName = thumbnailUrl.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return thumbnailUrl;
      }
      return convertToWebPUrl(thumbnailUrl);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  if (song.featured_media_url) {
    const fileName = song.featured_media_url.split("/").pop();
    if (cloudinaryNotFoundCache.has(fileName)) {
      if (webpNotFoundCache.has(fileName)) {
        return song.featured_media_url;
      }
      return convertToWebPUrl(song.featured_media_url);
    }
    const cloudinaryUrl = `${CLOUDINARY_BASE_URL}${fileName}`;
    return cloudinaryUrl;
  }
  
  // YouTube IDからサムネイルを生成
  if (song.youtubeId) {
    return `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`;
  }
  
  return '/placeholder.jpg';
}

// HTML エンティティをデコードするヘルパー（he を使用）
function decodeHtml(html = "") {
  const cleanHtml = (html || "").replace(/<b>/g, '').replace(/<\/b>/g, '');
  return he.decode(cleanHtml);
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
function formatPlaylistArtists(artists, spotifyArtists = null) {
  // デバッグログ
  console.log('🎯 formatPlaylistArtists called with:', { artists, spotifyArtists });
  
  // spotify_artistsフィールドを最優先で使用（データベースの順番を完全保持）
  if (spotifyArtists) {
    try {
      // カンマ区切りの文字列の場合はダブルクォーテーションを除去して使用
      if (typeof spotifyArtists === 'string' && spotifyArtists.includes(',')) {
        return spotifyArtists.replace(/"/g, '');
      }
      
      // JSON文字列の場合はパース
      if (typeof spotifyArtists === 'string') {
        const parsed = JSON.parse(spotifyArtists);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.join(', ');
        }
      }
      // 配列の場合はそのまま使用
      if (Array.isArray(spotifyArtists) && spotifyArtists.length > 0) {
        return spotifyArtists.join(', ');
      }
    } catch (e) {
      // パースエラーは無視
    }
  }
  
  // artistsフィールドからアーティスト名を抽出（spotify_artistsの順番に従って並び替え）
  if (artists) {
    console.log('🎯 Processing artists field:', { artists, type: typeof artists });
    try {
      let artistData;
      if (typeof artists === 'string') {
        artistData = JSON.parse(artists);
        console.log('🎯 Parsed artists string:', artistData);
      } else {
        artistData = artists;
        console.log('🎯 Using artists as-is:', artistData);
      }
      
      if (Array.isArray(artistData) && artistData.length > 0) {
        // spotify_artistsの順番に従って並び替え
        const sortedArtists = sortArtistsBySpotifyOrder(artistData, spotifyArtists);
        
        const artistNames = sortedArtists.map(artist => {
          if (typeof artist === 'object' && artist.name) {
            return artist.name;
          }
          return artist;
        }).filter(name => name && name.trim());
        
        if (artistNames.length > 0) {
          const result = artistNames.join(', ');
          console.log('🎯 formatPlaylistArtists result from artists:', result);
          return result;
        }
      }
    } catch (e) {
      console.log('🎯 Error processing artists:', e);
      // パースエラーの場合、文字列からアーティスト名を抽出
      try {
        // 複数のパターンでアーティスト名を抽出
        const patterns = [
          /"name":"([^"]+)"/g, // グローバルマッチで複数アーティストを抽出
        ];
        
        for (const pattern of patterns) {
          const matches = [...artists.matchAll(pattern)];
          if (matches.length > 0) {
            const artistNames = matches.map(match => match[1]);
            const result = artistNames.join(', ');
            console.log('🎯 formatPlaylistArtists result from pattern matching:', result);
            return result;
          }
        }
        
      } catch (e2) {
        // 最終的な抽出エラーは無視
      }
    }
  }

  console.log('🎯 formatPlaylistArtists fallback to Unknown Artist');
  return "Unknown Artist";
}

// spotify_artistsの順番に従ってアーティスト配列を並び替える関数
function sortArtistsBySpotifyOrder(artists, spotifyArtists) {
  if (!spotifyArtists || !Array.isArray(artists) || artists.length === 0) {
    return artists;
  }
  
  try {
    let spotifyOrder = [];
      if (typeof spotifyArtists === 'string') {
      // カンマ区切りの文字列の場合は分割
      if (spotifyArtists.includes(',')) {
        spotifyOrder = spotifyArtists.split(',').map(name => name.trim());
  } else {
        // JSON配列の場合はパース
        spotifyOrder = JSON.parse(spotifyArtists);
      }
    } else if (Array.isArray(spotifyArtists)) {
      spotifyOrder = spotifyArtists;
    }
    
    if (!Array.isArray(spotifyOrder) || spotifyOrder.length === 0) {
      return artists;
    }
    
    // spotify_artistsの順番に従って並び替え
    const sortedArtists = [...artists].sort((a, b) => {
      const aName = typeof a === 'object' ? a.name : a;
      const bName = typeof b === 'object' ? b.name : b;
      
      // より厳密な名前マッチング
      const aIndex = spotifyOrder.findIndex(name => {
        const normalizedSpotifyName = name.toLowerCase().trim();
        const normalizedArtistName = aName.toLowerCase().trim();
        return normalizedSpotifyName === normalizedArtistName ||
               normalizedSpotifyName.includes(normalizedArtistName) ||
               normalizedArtistName.includes(normalizedSpotifyName);
      });
      
      const bIndex = spotifyOrder.findIndex(name => {
        const normalizedSpotifyName = name.toLowerCase().trim();
        const normalizedArtistName = bName.toLowerCase().trim();
        return normalizedSpotifyName === normalizedArtistName ||
               normalizedSpotifyName.includes(normalizedArtistName) ||
               normalizedArtistName.includes(normalizedSpotifyName);
      });
      
      // 見つからない場合は最後に配置
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
    
    return sortedArtists;
  } catch (e) {
    // エラーの場合は元の配列を返す
    return artists;
  }
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
  
  // 各ボーカルオブジェクトのnameフィールドを直接チェック
  const hasF = vocalData.some(v => v.name && v.name.toLowerCase() === "f");
  const hasM = vocalData.some(v => v.name && v.name.toLowerCase() === "m");
  
  const icons = [];
  if (hasF) {
    icons.push(<MicrophoneIcon key="F" color="#fd5a5a" />);
  }
  if (hasM) {
    icons.push(<MicrophoneIcon key="M" color="#00a0e9" />);
  }
  return icons.length > 0 ? <span style={{ display: "inline-flex", gap: "4px" }}>{icons}</span> : null;
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
  onTrackOrderChange = null, // 新しいプロパティを追加
}) {
  const { data: session } = useSession();
  const { playTrack, setTrackList, updateCurrentTrackState } = usePlayer();
  const [isClient, setIsClient] = useState(false);
  const playerContext = useContext(PlayerContext);
  
  // クライアントサイドでのみDnDライブラリを初期化
  useEffect(() => {
    setIsClient(true);
  }, []);
  
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
    if (typeof window === 'undefined' || !isMobile || !playerContext?.currentTrack || !activeSongRef.current) return;

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
      if (typeof window !== 'undefined') {
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    };

    // 少し遅延を入れてスクロール実行（レンダリング完了後）
    const timer = setTimeout(scrollToActiveSong, 100);
    
    return () => clearTimeout(timer);
  }, [playerContext?.currentTrack, playerContext?.isPlaying, isMobile]);
  
  // PlayerContextの初期化状態をチェック
  const isPlayerReady = playTrack && setTrackList && updateCurrentTrackState;
  
  
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
  const [sortedTracks, setSortedTracks] = useState(tracks);

  // ドラッグ&ドロップ用のセンサー
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // プレイリスト情報を取得
  useEffect(() => {
    if (playlistId) {
      const fetchPlaylistInfo = async () => {
        try {
          const response = await fetch(`/api/playlists/${playlistId}`);
          if (response.ok) {
            const data = await response.json();
            setPlaylistInfo(data);
          }
        } catch (error) {
          console.error('Failed to fetch playlist info:', error);
        }
      };
      fetchPlaylistInfo();
    }
  }, [playlistId]);

  // tracksが変更された時にsortedTracksを更新
  useEffect(() => {
    setSortedTracks(tracks);
  }, [tracks]);


  // autoPlayFirst機能：最初の曲を自動再生
  useEffect(() => {
    if (autoPlayFirst && tracks.length > 0 && playTrack && setTrackList && updateCurrentTrackState) {
      
      try {
        const firstTrack = tracks[0];
        // プレイリスト名とIDを含むソースを作成（リンク用）
        const playlistName = playlistInfo?.name || 'Unknown Playlist';
        const finalSource = source || `playlist: ${playlistName}|${playlistId}`;
        
        // プレイリスト全体をキューに設定
        setTrackList(tracks);
        updateCurrentTrackState(firstTrack, 0);
        
        // 最初の曲を再生
        playTrack(firstTrack, 0, tracks, finalSource, onPageEnd);
      } catch (error) {
        console.error('❌ Auto-play setup failed:', error);
      }
    }
  }, [autoPlayFirst, tracks, playTrack, setTrackList, updateCurrentTrackState, source, playlistId, onPageEnd]);

  // Spotify Track IDsを抽出（ページ内の曲のみ）
  const trackIds = useMemo(() => {
    const ids = sortedTracks
      .map(track => track.spotify_track_id || track.track_id)
      .filter(id => id); // null/undefinedを除外
    
    
    return ids;
  }, [sortedTracks]);

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
    const processedTracks = sortedTracks.map(track => {

      // spotify_track_idがnullの場合は、track_idをspotify_track_idとして使用
      const spotifyTrackId = track.spotify_track_id || track.track_id;
      

      // genre_dataが存在しない場合、genre_nameから生成
      let generatedGenreData = null;
      if (track.genre_name && typeof track.genre_name === 'string') {
        try {
          // HTMLエンティティをデコード
          const decodedGenreName = he.decode(track.genre_name);
          // カンマ区切りの場合は分割して配列に変換
          if (decodedGenreName.includes(',')) {
            generatedGenreData = decodedGenreName.split(',').map(name => ({
              name: name.trim(),
              slug: name.trim().toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and'),
              term_id: Math.random().toString(36).substr(2, 9)
            }));
          } else {
            generatedGenreData = [{
              name: decodedGenreName,
              slug: decodedGenreName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and'),
              term_id: Math.random().toString(36).substr(2, 9)
            }];
          }
          // ジャンルデータ生成ログは削除
        } catch (e) {
          console.warn(`Failed to generate genre_data from genre_name:`, e);
        }
      }

      // spotify_artistsフィールドが存在する場合は、それを最優先で使用
      let generatedSpotifyArtists = null;
      if (track.spotify_artists && Array.isArray(track.spotify_artists) && track.spotify_artists.length > 0) {
        // spotify_artistsフィールドが既に存在する場合はそのまま使用（順番を保持）
        generatedSpotifyArtists = track.spotify_artists;
        // 既存のspotify_artists使用ログは削除
      } else if (track.artists && Array.isArray(track.artists)) {
        // spotify_artistsが存在しない場合のみ、artistsフィールドから生成
        try {
          // データベースのspotify_artistsの順番に合わせて並び替え
          // 例：データベースに["Mariah Carey", "Shenseea", "Kehlani"]が保存されている場合
          // artistsフィールドから生成する際も、この順番に合わせる
          
          // まず、artistsフィールドからアーティスト名を抽出
          const artistNames = track.artists.map(artist => {
            if (typeof artist === 'string') {
              try {
                const parsed = JSON.parse(artist);
                return parsed.name || parsed.artistorigin || artist;
              } catch (e) {
                return artist;
              }
            }
            if (typeof artist === 'object' && artist !== null) {
              return artist.name || artist.artistorigin || Object.values(artist)[0];
            }
            return String(artist);
          });
          
          // データベースのspotify_artistsの順番に合わせて並び替え
          if (track.spotify_artists && Array.isArray(track.spotify_artists)) {
            // データベースの順番を基準として、artistsフィールドから生成された名前を並び替え
            generatedSpotifyArtists = track.spotify_artists.filter(name => 
              artistNames.includes(name)
            );
            // 順番並び替えログは削除
          } else {
            // データベースのspotify_artistsがない場合は、artistsフィールドの順番を保持
            generatedSpotifyArtists = artistNames;
            // アーティスト順番保持ログは削除
          }
        } catch (e) {
          console.warn(`Failed to generate spotify_artists from artists:`, e);
        }
      }
      
      return {
        ...track,
        id: track.id || track.track_id || `temp_${Math.random()}`,
        // 生成されたデータまたは元のデータを使用
        style_id: track.style_id,
        genre_data: generatedGenreData || track.genre_data || [],
        spotify_artists: generatedSpotifyArtists || track.spotify_artists || [],
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
        thumbnail: (() => {
          const thumbnail = track.thumbnail_url || track.thumbnail;
          return thumbnail;
        })(),
        youtubeId: track.youtube_id || track.ytvideoid || '',
        spotifyTrackId: spotifyTrackId,
        genre_data: generatedGenreData || track.genre_data || track.genres || [],
        genres: generatedGenreData || track.genres || track.genre_data || [],
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
    
    
    
    return processedTracks;
  }, [sortedTracks]);

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
    // デバッグログは削除
    
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
    const trackIndex = sortedTracks.findIndex(t => t.id === track.id);
    
    // プレイリストでのソース情報のデバッグログは削除
    
    // 関数の可用性チェックログは削除
    
    try {
      // 処理された曲データを使用
      const processedTrack = safeTracks.find(t => t.id === track.id);
      
      if (processedTrack) {
        // デバッグログは削除
        
        // PlayerContextのplayTrack関数を直接呼び出し
        // プレイリスト全体をキューに設定してから再生
        setTrackList(safeTracks);
        updateCurrentTrackState(processedTrack, trackIndex);
        
        playTrack(processedTrack, trackIndex, safeTracks, finalSource, onPageEnd);
        
      } else {
        // デバッグログは削除
        
        // ソートされたトラックリストを使用
        setTrackList(sortedTracks);
        updateCurrentTrackState(track, trackIndex);
        
        playTrack(track, trackIndex, sortedTracks, finalSource, onPageEnd);
      }
    } catch (error) {
      console.error('💥 Error in handleThumbnailClick:', error);
      alert('曲の再生中にエラーが発生しました。もう一度お試しください。');
    }
  }, [source, playlistId, playTrack, safeTracks, onPageEnd, setTrackList, updateCurrentTrackState, sortedTracks]);

  // ドラッグ&ドロップハンドラー
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setSortedTracks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // 新しい順序をサーバーに保存
        saveNewOrder(newOrder);
        
        // 親コンポーネントに新しい順序を即座に通知
        if (onTrackOrderChange) {
          onTrackOrderChange(newOrder);
        }
        
        return newOrder;
      });
    }
  }, [onTrackOrderChange]);

  // 新しい順序をサーバーに保存
  const saveNewOrder = async (newOrder) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackOrder: newOrder.map((track, index) => ({
            id: track.id,
            position: index
          }))
        }),
      });

      if (!response.ok) {
        console.error('Failed to save new track order');
      } else {
        // サーバーに保存が成功したら、再生用のtracks配列も更新
        // 親コンポーネントに新しい順序を通知する必要があります
        console.log('Track order updated successfully:', newOrder);
        
        // 親コンポーネントに新しい順序を通知
        if (onTrackOrderChange) {
          onTrackOrderChange(newOrder);
        }
      }
    } catch (error) {
      console.error('Error saving new track order:', error);
    }
  };

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
    if (popupSong?.spotify_track_id && typeof window !== 'undefined') {
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
    setTrackToAdd({
      ...track,
      vocal_data: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : [])
    });
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
      if (typeof window !== 'undefined') {
        window.location.reload(); // 簡単な方法としてページを再読み込み
      }
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
          // ボーカル配列を必ず送信
          vocal_data: Array.isArray(track.vocal_data) && track.vocal_data.length > 0 ? track.vocal_data : (Array.isArray(track.vocals) ? track.vocals : []),
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

  // ドラッグ可能な曲アイテムコンポーネント
  const SortableSongItem = ({ track, index }) => {
    // クライアントサイドでのみDnD機能を有効化
    const sortableResult = isClient ? useSortable({ 
      id: track.id || `track-${index}`,
      disabled: false
    }) : {
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: null,
      isDragging: false
    };

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = sortableResult;



    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const title = decodeHtml(track.title || "No Title");
    const thumbnailUrl = getThumbnailUrl(track);
        const artistText = formatPlaylistArtists(track.artists, track.spotify_artists);
    const releaseDate = track.release_date ? formatYearMonth(track.release_date) : null;
    const genreText = formatMultipleGenres(track.genre_data, track.genre_name);
    // vocalData: 配列があれば必ずそれを使う（JSON文字列の場合は解析）
    let vocalData = [];
    if (Array.isArray(track.vocal_data) && track.vocal_data.length > 0) {
      vocalData = track.vocal_data;
    } else if (typeof track.vocal_data === 'string' && track.vocal_data.trim()) {
      try {
        vocalData = JSON.parse(track.vocal_data);
      } catch (e) {
        console.error('vocal_data JSON解析エラー:', e);
        vocalData = track.vocal_name ? [{ name: track.vocal_name }] : [];
      }
    } else if (track.vocal_name) {
      vocalData = [{ name: track.vocal_name }];
    }
    const spotifyTrackId = track.spotify_track_id || track.track_id;
    const isLiked = spotifyTrackId ? likedTracks.has(spotifyTrackId) : false;
    const isPlaying = playerContext?.currentTrack?.id === track.id && playerContext?.isPlaying;

    return (
      <li 
        ref={(el) => {
          // DnD用のrefとアクティブ楽曲用のrefを両方設定
          setNodeRef(el);
          if (isPlaying) {
            activeSongRef.current = el;
          }
        }}
        style={style} 
        key={track.id + '-' + index} 
        id={`song-${track.id}`} 
        className={`${styles.songItem} ${isPlaying ? styles.playing : ''}`}
        data-dragging={isDragging}
      >
        {/* 通しナンバー */}
        <div className={styles.songNumber}>
          {index + 1}
        </div>

        {/* ドラッグハンドル */}
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          <span className={styles.dragIcon}>⋮⋮</span>
        </div>

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
                console.log('🖼️ PlaylistSongList - Image load error:', {
                  failedUrl: e.target.src,
                  trackId: track.id,
                  trackTitle: title,
                  hasTriedOriginal: e.target.dataset.triedOriginal,
                  hasTriedWebP: e.target.dataset.triedWebP
                });

                if (!e.target.dataset.triedOriginal) { // First attempt (Cloudinary failed)
                  e.target.dataset.triedOriginal = "1";
                  if (e.target.src.includes('cloudinary.com')) {
                    const fileName = e.target.src.split("/").pop();
                    cloudinaryNotFoundCache.add(fileName);
                    console.log('🖼️ PlaylistSongList - Added to not found cache:', fileName);
                  }
                  const src = track.thumbnail_url || track.thumbnail || track.featured_media_url;
                  if (src) {
                    const webpUrl = convertToWebPUrl(src);
                    console.log('🖼️ PlaylistSongList - Trying WebP URL (99% success rate):', webpUrl);
                    e.target.src = webpUrl;
                  }
                } else if (!e.target.dataset.triedWebP) { // Second attempt (WebP failed)
                  e.target.dataset.triedWebP = "1";
                  if (e.target.src.includes('.webp')) {
                    const fileName = e.target.src.split("/").pop();
                    webpNotFoundCache.add(fileName);
                    console.log('🖼️ PlaylistSongList - Added to WebP not found cache (1% case):', fileName);
                  }
                  const src = track.thumbnail_url || track.thumbnail || track.featured_media_url;
                  if (src) {
                    console.log('🖼️ PlaylistSongList - Trying original URL as last resort:', src);
                    e.target.src = src;
                  }
                } else { // All attempts failed
                  console.log('🖼️ PlaylistSongList - Falling back to placeholder');
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
  };

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

      {isClient ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedTracks.map((track, index) => track.id || `track-${index}`)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.songList}>
              {sortedTracks.map((track, index) => {
                try {
                  return <SortableSongItem key={track.id + '-' + index} track={track} index={index} />;
                } catch (e) {
                  console.error(`ビルドエラー: 曲ID=${track.id}, タイトル=${track.title}`, e);
                  return null;
                }
              })}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className={styles.songList}>
          {sortedTracks.map((track, index) => {
            try {
              return <SortableSongItem key={track.id + '-' + index} track={track} index={index} />;
            } catch (e) {
              console.error(`ビルドエラー: 曲ID=${track.id}, タイトル=${track.title}`, e);
              return null;
            }
          })}
        </ul>
      )}
      {/* ポップアップメニュー */}
      {isPopupVisible && popupSong && (
        <ThreeDotsMenu
          song={popupSong}
          position={popupPosition}
          onClose={() => setIsPopupVisible(false)}
          onAddToPlaylist={() => handleAddToPlaylistClick(popupSong.id)}
          onCopyUrl={() => {
            if (typeof window !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(`${window.location.origin}/playlists/${playlistId}`);
            }
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
                  {(() => {
                    // determineArtistOrder関数を使用してアーティストの順番を決定
                    let orderedArtists = determineArtistOrder(song);
                    console.log('🎯 3点メニュー orderedArtists:', orderedArtists);
                    
                    if (!orderedArtists || orderedArtists.length === 0) {
                      console.log('🎯 3点メニュー: アーティストが見つかりません、フォールバック処理を実行');
                      
                      // フォールバック: 直接artistsフィールドから抽出を試行
                      let fallbackArtists = [];
                      if (typeof song.artists === 'string' && song.artists.trim()) {
                        try {
                          const parsed = JSON.parse(song.artists);
                          if (Array.isArray(parsed)) {
                            fallbackArtists = parsed;
                          }
                      } catch (e) {
                          // パースできない場合は文字列から抽出
                          const patterns = [/"name":"([^"]+)"/g];
                          for (const pattern of patterns) {
                            const matches = [...song.artists.matchAll(pattern)];
                            if (matches.length > 0) {
                              fallbackArtists = matches.map(match => ({ 
                                name: match[1], 
                                slug: match[1].toLowerCase().replace(/\s+/g, '-') 
                              }));
                              break;
                            }
                          }
                        }
                      }
                      
                      if (fallbackArtists.length === 0) {
                        console.log('🎯 3点メニュー: フォールバックでもアーティストが見つかりません');
                        return null;
                      }
                      
                      console.log('🎯 3点メニュー: フォールバックアーティスト:', fallbackArtists);
                      orderedArtists = fallbackArtists;
                    }
                    
                    return orderedArtists.map((artist, index) => {
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
                   }).filter(Boolean);
                  })()}
                </div>

                <div key="song-section" style={separatorStyle}>
                  {(() => {
                    // determineArtistOrder関数を使用してメインアーティストを取得
                    const orderedArtists = determineArtistOrder(song);
                    const mainArtist = orderedArtists?.[0];
                    
                    let artistSlug = 'unknown';
                    if (mainArtist) {
                      if (typeof mainArtist === 'string') {
                        artistSlug = he.decode(mainArtist).toLowerCase().replace(/\s+/g, '-');
                      } else if (typeof mainArtist === 'object' && mainArtist !== null) {
                        artistSlug = mainArtist.slug || he.decode(mainArtist.name || 'unknown').toLowerCase().replace(/\s+/g, '-');
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
