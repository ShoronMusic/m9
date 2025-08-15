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
  const icons = [];
  const hasF = vocalData.some((v) => v.name && v.name.toLowerCase() === "f");
  const hasM = vocalData.some((v) => v.name && v.name.toLowerCase() === "m");
  if (hasF) {
    icons.push(<MicrophoneIcon key="F" color="#fd5a5a" />);
  }
  if (hasM) {
    icons.push(<MicrophoneIcon key="M" color="#00a0e9" />);
  }
  return <span style={{ display: "inline-flex", gap: "6px", verticalAlign: "middle" }}>{icons}</span>;
}

export default function SongDetailClient({ songData, description, accessToken }) {
  const { data: session } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [showCreateNewPlaylistModal, setShowCreateNewPlaylistModal] = useState(false);
  
  // いいね機能用の状態
  const [isLiked, setIsLiked] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState(null);

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

  // いいね状態をチェック
  useEffect(() => {
    if (session?.accessToken && songData?.spotifyTrackId) {
      checkLikeStatus();
    }
  }, [session?.accessToken, songData?.spotifyTrackId]);

  // いいね状態をチェックする関数
  const checkLikeStatus = async () => {
    if (!session?.accessToken || !songData?.spotifyTrackId) return;
    
    try {
      setLikesLoading(true);
      setLikesError(null);
      
      const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${songData.spotifyTrackId}`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (response.ok) {
        const likedArray = await response.json();
        setIsLiked(likedArray[0] || false);
      } else if (response.status === 401) {
        setLikesError('認証エラー: Spotifyに再ログインしてください');
      } else {
        setLikesError('いいね情報の取得に失敗しました');
      }
    } catch (error) {
      console.error('Error checking like status:', error);
      setLikesError('ネットワークエラーが発生しました');
    } finally {
      setLikesLoading(false);
    }
  };

  // いいねの切り替え
  const handleLikeToggle = async () => {
    if (!session?.accessToken) {
      alert('この機能を使用するにはSpotifyでログインしてください。');
      return;
    }

    if (likesError) {
      alert(`エラー: ${likesError}`);
      return;
    }

    try {
      setLikesLoading(true);
      setLikesError(null);
      
      const method = isLiked ? 'DELETE' : 'PUT';
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${songData.spotifyTrackId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setIsLiked(!isLiked);
        console.log(isLiked ? 'いいねを解除しました' : 'いいねを追加しました');
      } else if (response.status === 401) {
        setLikesError('認証エラー: Spotifyに再ログインしてください');
        alert('認証エラーが発生しました。Spotifyに再ログインしてください。');
      } else {
        setLikesError('いいねの更新に失敗しました');
        alert(isLiked ? 'いいねの解除に失敗しました。' : 'いいねの追加に失敗しました。');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setLikesError('ネットワークエラーが発生しました');
      alert('エラーが発生しました。もう一度お試しください。');
    } finally {
      setLikesLoading(false);
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {songData.genres.map((genre, index) => (
                      <Link key={index} href={`/genres/${genre.slug}/1`} style={{ fontSize: '1.1em', color: '#1e6ebb', display: 'block' }}>
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
                      cursor: likesLoading ? "not-allowed" : "pointer",
                      opacity: likesLoading ? 0.5 : 1,
                      transition: "all 0.2s ease",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      if (!likesLoading) {
                        e.target.style.backgroundColor = "#f0f0f0";
                        e.target.style.transform = "scale(1.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!likesLoading) {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.transform = "scale(1)";
                      }
                    }}
                    title={likesError ? `エラー: ${likesError}` : (isLiked ? "いいねを解除" : "いいねを追加")}
                    disabled={likesLoading}
                  >
                    <img
                      src={isLiked ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
                      alt="Like"
                      style={{ 
                        width: "18px", 
                        height: "18px",
                        filter: likesError ? "grayscale(100%)" : "none"
                      }}
                    />
                    {likesLoading && (
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {songData.spotifyTrackId && (
                    <Link
                      href={`https://open.spotify.com/track/${songData.spotifyTrackId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none", color: "#1e6ebb", fontSize: "1.08em" }}
                    >
                      <img src="/svg/spotify.svg" alt="Spotify" style={{ width: "20px" }} />
                      Spotify
                      <img src="/svg/new-window.svg" alt="Open in new window" style={{ width: "20px" }} />
                    </Link>
                  )}
                </div>
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
            <img 
              src="/images/Full_Logo_Green_RGB.svg" 
              alt="Spotify" 
              style={{ height: '30px', width: 'auto', marginBottom: '15px' }} 
            />
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
  );
} 
