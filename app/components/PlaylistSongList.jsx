'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
            return parsed.name;
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
        return artist.name || Object.values(artist)[0] || JSON.stringify(artist);
      }
      return artist;
    });
    
    return formattedArtists.join(', ');
  }
  
  // 配列以外の場合は文字列として処理
  if (typeof artists === 'string') {
    if (artists.startsWith('{') || artists.startsWith('[')) {
      try {
        const parsed = JSON.parse(artists);
        if (parsed && typeof parsed === 'object' && parsed.name) {
          return parsed.name;
        }
        return Object.values(parsed)[0] || artists;
      } catch (e) {
        return artists;
      }
    }
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

// ──────────────────────────────
// PlaylistSongList コンポーネント本体
// ──────────────────────────────

export default function PlaylistSongList({
  tracks = [],
  playlistId,
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
    return tracks
      .map(track => track.spotify_track_id || track.track_id)
      .filter(id => id); // null/undefinedを除外
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
    return tracks.map(track => ({
      ...track,
      id: track.id || track.track_id || `temp_${Math.random()}`
    }));
  }, [tracks]);

  // Spotify APIを使用したいいねボタン用の toggleLike 関数
  const handleLikeToggle = async (trackId) => {
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
    const finalSource = source || `playlist/${playlistId}`;
    player.playTrack(track, tracks.findIndex(t => t.id === track.id), tracks, finalSource);
  }, [source, playlistId, player, tracks]);

  const handleThreeDotsClick = (e, track) => {
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
    setPopupSong(track);
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

  // 既存プレイリストに追加
  const addTrackToPlaylist = async (track, playlistId) => {
    try {
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
          thumbnail_url: getThumbnailUrl(track),
          style_id: track.style_id,
          style_name: track.style_name,
          release_date: track.release_date
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

  return (
    <div className={styles.songlistWrapper}>
      {groupedTracks.map((group) => (
        <div key={group.year || "all"} className={styles.yearGroup}>
          {group.year && <h2 className={styles.yearTitle}>{group.year}</h2>}
          <ul className={styles.songList}>
            {Array.isArray(group.songs) && group.songs.map((track, index) => {
              try {
                const title = decodeHtml(track.title || "No Title");
                const thumbnailUrl = getThumbnailUrl(track);
                const artistText = formatPlaylistArtists(track.artists);
                const releaseDate = formatPlaylistDate(track.release_date);
                const styleText = formatPlaylistStyle(track.style_name);
                const addedDate = formatPlaylistDate(track.added_at);

                // Spotify Track IDを取得
                const spotifyTrackId = track.spotify_track_id || track.track_id;
                const isLiked = spotifyTrackId ? likedTracks.has(spotifyTrackId) : false;
                const isPlaying = player.currentTrack && player.currentTrack.id === track.id && player.isPlaying;

                return (
                  <li key={track.id + '-' + index} id={`song-${track.id}`} className={`${styles.songItem} ${isPlaying ? styles.playing : ''}`}>
                    <div className="ranking-thumbnail-container">
                      {/* ランキング表示が必要ならここに */}
                    </div>
                    <button
                      className={styles.thumbnailContainer}
                      onClick={() => handleThumbnailClick(track, index)}
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
                      <div className={styles.line1} style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                        <span style={{ marginRight: "auto" }}>
                          {artistText} - {title}
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
                        {releaseDate !== "Unknown Date" && (
                          <span>{releaseDate}</span>
                        )}
                        {styleText !== "Unknown Style" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            ({styleText})
                          </span>
                        )}
                        {addedDate !== "Unknown Date" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            追加: {addedDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className={styles.threeDotsButton}
                      onClick={(e) => handleThreeDotsClick(e, track)}
                      aria-label="More options"
                    >
                      ⋮
                    </button>
                  </li>
                );
              } catch (e) {
                console.error(`ビルドエラー: 曲ID=${track.id}, タイトル=${track.title}`, e);
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

                <div key="copy-url-section">
                  <button onClick={onCopyUrl} style={menuButtonStlye}>
                    <img src="/svg/copy.svg" alt="" style={{ width: 16, marginRight: 8 }} />
                    プレイリストのURLをコピー
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
