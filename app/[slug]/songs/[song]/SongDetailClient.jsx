"use client";

import React, { useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import MicrophoneIcon from "../../../components/MicrophoneIcon";
import ScrollToTopButton from "../../../components/ScrollToTopButton";
import SongDetailSpotifyPlayer from "../../../components/SongDetailSpotifyPlayer";
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
  useEffect(() => {
    // デバッグ用
    // console.log("受け取った songData:", songData);
  }, [songData]);

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
      />
    </div>
  ) : null;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <ThemeProvider theme={theme}>
        <Head>
          <title>{pageTitleStr} | Music8</title>
          <meta name="description" content={description} />
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
                        <img src="/icons/spotify.svg" alt="Spotify" style={{ width: "20px" }} />
                        Spotify
                        <img src="/icons/new-window.svg" alt="Open in new window" style={{ width: "20px" }} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Spotifyプレーヤー */}
        {songData.spotifyTrackId && accessToken && (
          <SongDetailSpotifyPlayer 
            accessToken={accessToken} 
            songData={songData} 
          />
        )}
        
        <ScrollToTopButton />
      </ThemeProvider>
    </div>
  );
} 
