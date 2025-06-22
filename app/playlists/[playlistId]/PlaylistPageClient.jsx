"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "../../components/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import axios from "axios";
import ScrollToTopButton from "../../components/ScrollToTopButton";
import PlaylistSongList from "../../components/PlaylistSongList";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../css/theme";

const YouTubePlayer = dynamic(() => import("../../components/YouTubePlayer"), {
  ssr: false,
});

// スタイルID → スタイル名マッピング
const styleIdToNameMapping = {
  2845: "Alternative",
  4686: "Dance",
  2846: "Electronica",
  2848: "Hip-hop",
  2873: "Others",
  2844: "Pop",
  2847: "R&B",
  2849: "Rock",
  4687: "Drum and Bass",
};

export default function PlaylistPageClient({ playlistId }) {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  // 初期値は -1（未再生状態）にしておく
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [currentTrack, setCurrentTrack] = useState({
    artist: "",
    title: "",
    thumbnail: "",
    styleId: "",
    styleName: "",
  });
  // 編集モードなど
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const playerRef = useRef(null);

  // 作成者かどうかを判定するフラグ
  const [isOwner, setIsOwner] = useState(false);

  // 1) プレイリスト情報を Firestore から取得
  useEffect(() => {
    async function fetchPlaylist() {
      try {
        const playlistRef = doc(firestore, "playlists", playlistId);
        const playlistSnap = await getDoc(playlistRef);
        if (!playlistSnap.exists()) {
          alert("プレイリストが見つかりません。");
          router.push("/mypage");
          return;
        }
        const playlistData = playlistSnap.data();
        setPlaylist(playlistData);
        setNewTitle(playlistData.title || "");
        setNewDescription(playlistData.description || "");
        setIsPublic(!!playlistData.isPublic);

        // 作成者判定：ログイン済みかつ自分が作成者なら編集可能
        if (user && playlistData.userId === user.uid) {
          setIsOwner(true);
        } else {
          setIsOwner(false);
        }

        // 非公開の場合、ログインしていなければリダイレクト
        if (!playlistData.isPublic && !user) {
          alert("このプレイリストは非公開です。");
          router.push("/login");
          return;
        }

        // 曲データを取得
        if (playlistData.songIds && playlistData.songIds.length > 0) {
          const includeIds = playlistData.songIds.join(",");
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/custom/v1/playlist-songs?include=${includeIds}`
          );
          let songsData = response.data;
          // playlistData.songIds の順序に合わせて並び替え
          songsData.sort((a, b) => {
            return (
              playlistData.songIds.indexOf(a.id.toString()) -
              playlistData.songIds.indexOf(b.id.toString())
            );
          });
          // styleId → styleName
          const validSongs = songsData.map((song) => {
            let styleId = "unknown";
            let styleName = "Unknown Style";
            if (song.style && song.style.length > 0) {
              styleId = song.style[0];
              styleName = styleIdToNameMapping[styleId] || "Unknown Style";
            }
            return {
              ...song,
              styleId,
              styleName,
            };
          });
          setSongs(validSongs);
        }
      } catch (error) {
        console.error("プレイリストの読み込み中にエラーが発生しました:", error);
        alert("プレイリストの読み込み中にエラーが発生しました。");
        router.push("/mypage");
      }
    }
    fetchPlaylist();
  }, [playlistId, router, user]);

  // 2) プレイリスト情報の保存（公開設定含む）※作成者のみ操作可能
  const handleSaveEdit = async () => {
    try {
      const playlistRef = doc(firestore, "playlists", playlistId);
      await updateDoc(playlistRef, {
        title: newTitle,
        description: newDescription,
        isPublic: isPublic,
        updatedAt: serverTimestamp(),
      });
      setPlaylist((prev) => ({
        ...prev,
        title: newTitle,
        description: newDescription,
        isPublic: isPublic,
      }));
      setIsEditing(false);
      alert("プレイリスト情報を保存しました");
    } catch (error) {
      console.error("プレイリスト情報の保存中にエラー:", error);
      alert("プレイリスト情報の保存中にエラーが発生しました。");
    }
  };

  // 3) プレイリストから曲を削除（作成者のみ操作可能）
  const deleteSongFromPlaylist = async (index) => {
    const confirmDelete = confirm("この曲をプレイリストから削除しますか？");
    if (!confirmDelete) return;
    const newSongs = [...songs];
    newSongs.splice(index, 1);
    setSongs(newSongs);

    const newSongIds = newSongs.map((song) => song.id.toString());
    const playlistRef = doc(firestore, "playlists", playlistId);
    await updateDoc(playlistRef, {
      songIds: newSongIds,
      updatedAt: serverTimestamp(),
    });
  };

  // 4) 曲をアクティブ化
  const handleActivateSong = (index) => {
    const selectedSong = songs[index];
    if (!selectedSong) return;

    const artistName = selectedSong.custom_fields?.categories
      ? selectedSong.custom_fields.categories
          .map((cat) => cat.name.replace(/&amp;/g, "&"))
          .join(", ")
      : "Unknown Artist";

    setCurrentVideoId(selectedSong.acf?.ytvideoid || null);
    const newTrack = {
      artist: artistName,
      title: selectedSong.title?.rendered || "Unknown Title",
      thumbnail: selectedSong.featured_media_url || "/placeholder.jpg",
      styleId: selectedSong.styleId || "unknown",
      styleName: selectedSong.styleName || "Unknown Style",
    };
    console.log("Activated track:", newTrack);
    setCurrentTrack(newTrack);
    setCurrentSongIndex(index);

    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(selectedSong.acf?.ytvideoid || "");
    }
  };

  // 5) 次の曲へ
  const handleNext = () => {
    if (!songs || songs.length === 0) return;
    let nextSongIndex = currentSongIndex + 1;
    if (nextSongIndex >= songs.length) {
      nextSongIndex = 0;
    }
    const nextSong = songs[nextSongIndex];
    const artistName = nextSong.custom_fields?.categories
      ? nextSong.custom_fields.categories
          .map((cat) => cat.name.replace(/&amp;/g, "&"))
          .join(", ")
      : "Unknown Artist";

    setCurrentSongIndex(nextSongIndex);
    setCurrentVideoId(nextSong.acf?.ytvideoid || null);
    setCurrentTrack({
      artist: artistName,
      title: nextSong.title?.rendered || "Unknown Title",
      thumbnail: nextSong.featured_media_url || "/placeholder.jpg",
      styleSlug: nextSong.styleId || "unknown",
      styleName: nextSong.styleName || "Unknown Style",
    });

    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(nextSong.acf?.ytvideoid || "");
    }
  };

  // プレイリスト情報が読み込み中の場合
  if (!playlist) {
    return <div>Loading...</div>;
  }

  // 非公開プレイリストかつログインしていなければ（この場合は所有者のみ閲覧可能）
  if (!playlist.isPublic && !user) {
    // ※すでに useEffect 内でリダイレクトしている場合もありますが、念のための保険です
    router.push("/login");
    return <div>Redirecting...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 0 24px 0', textAlign: 'left', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}>
        {playlist && (
          <div style={{ marginBottom: '24px', width: '100%', display: 'flex', alignItems: 'flex-start', background: '#e3f2fd', borderRadius: '12px 12px 0 0', padding: '24px 24px 12px 24px' }}>
            {/* サムネイル4枚 */}
            <div style={{ width: '100px', height: '100px', display: 'grid', gridTemplateColumns: 'repeat(2, 50px)', gridTemplateRows: 'repeat(2, 50px)', gap: '0px', marginRight: '20px', flexShrink: 0 }}>
              {songs.slice(0, 4).map((song) => {
                // サムネイル画像のローカルwebp変換（外部URLでも必ずローカル参照）
                let thumb = '/placeholder.jpg';
                if (song.featured_media_url) {
                  const fileName = song.featured_media_url.split("/").pop().replace(/\.[a-zA-Z0-9]+$/, ".webp");
                  thumb = `/images/thum/${fileName}`;
                }
                return (
                  <img
                    key={song.id}
                    src={thumb}
                    alt={song.title?.rendered || 'No Title'}
                    style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                    onError={e => {
                      e.currentTarget.src = '/placeholder.jpg';
                      e.currentTarget.onerror = null;
                    }}
                  />
                );
              })}
            </div>
            {/* タイトル・日付・ハンドルネーム・編集ボタン */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ width: '100%', borderBottom: '2px solid #007bff', marginBottom: '0', paddingBottom: '4px' }}>
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  margin: 0,
                  padding: 0,
                  textAlign: 'left',
                  width: '100%',
                }}>
                  {playlist.title}
                </h1>
      <Layout>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 0 24px 0', textAlign: 'left', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}>
          {playlist && (
            <div style={{ marginBottom: '24px', width: '100%', display: 'flex', alignItems: 'flex-start', background: '#e3f2fd', borderRadius: '12px 12px 0 0', padding: '24px 24px 12px 24px' }}>
              {/* サムネイル4枚 */}
              <div style={{ width: '100px', height: '100px', display: 'grid', gridTemplateColumns: 'repeat(2, 50px)', gridTemplateRows: 'repeat(2, 50px)', gap: '0px', marginRight: '20px', flexShrink: 0 }}>
                {songs.slice(0, 4).map((song) => {
                  // サムネイル画像のローカルwebp変換（外部URLでも必ずローカル参照）
                  let thumb = '/placeholder.jpg';
                  if (song.featured_media_url) {
                    const fileName = song.featured_media_url.split("/").pop().replace(/\.[a-zA-Z0-9]+$/, ".webp");
                    thumb = `/images/thum/${fileName}`;
                  }
                  return (
                    <img
                      key={song.id}
                      src={thumb}
                      alt={song.title?.rendered || 'No Title'}
                      style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                      onError={e => {
                        e.currentTarget.src = '/placeholder.jpg';
                        e.currentTarget.onerror = null;
                      }}
                    />
                  );
                })}
              </div>
              {/* タイトル・日付・ハンドルネーム・編集ボタン */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: '100%', borderBottom: '2px solid #007bff', marginBottom: '0', paddingBottom: '4px' }}>
                  <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    margin: 0,
                    padding: 0,
                    textAlign: 'left',
                    width: '100%',
                  }}>
                    {playlist.title}
                  </h1>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', marginBottom: '4px', width: '100%' }}>
                  <span style={{ color: '#555', fontSize: '1.05em' }}>
                    {songs.length} songs{' '}
                    {(() => {
                      const ts = playlist.updatedAt || playlist.createdAt;
                      if (!ts) return null;
                      const d = new Date(ts.seconds * 1000);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      return `Update: ${y}.${m}.${day}`;
                    })()}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#555', fontSize: '1.05em' }}>
                      PLAYLIST by {playlist.userName || (user && user.displayName) || 'No Name'}
                    </span>
                    {isOwner && !isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        style={{
                          padding: '6px 18px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#0056b3'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = '#007bff'}
                      >
                        編集
                      </button>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* プレイリストの曲リスト */}
          <PlaylistSongList
            songs={songs}
            setSongs={setSongs}
            handleActivateSong={handleActivateSong}
            deleteSongFromPlaylist={deleteSongFromPlaylist}
            currentSongIndex={currentSongIndex}
            playlistId={playlistId}
            openExternalLink={(url) => window.open(url, "_blank")}
            isOwner={isOwner}
          />

          {/* クレジット等 */}
          {/* <div style={{ textAlign: "left", marginTop: "40px", padding: "20px 0", borderTop: "1px solid #ccc" }}>
            <p style={{ margin: "0", fontSize: "0.9em", color: "#555" }}>
              Many cover arts are provided by{" "}
              <a href="https://www.spotify.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <img
                  src="/images/Full_Logo_Black_RGB.svg"
                  alt="Spotify"
                  style={{ height: "21px", verticalAlign: "middle", marginLeft: "5px" }}
                />
              </a>
            </p>
          </div> */}
        </div>
        {/* YouTube プレーヤー */}
        {currentVideoId && (
          <YouTubePlayer
            ref={playerRef}
            videoId={currentVideoId}
            currentTrack={currentTrack}
            currentSongIndex={currentSongIndex}
            setCurrentSongIndex={setCurrentSongIndex}
            setCurrentVideoId={setCurrentVideoId}
            videoIds={songs.map((song) => song.acf?.ytvideoid || null)}
            posts={songs}
            setCurrentTrack={setCurrentTrack}
            autoPlay={true}
            onEnd={handleNext}
            playlistTitle={playlist.title}
          />
        )}
        <ScrollToTopButton />
      </Layout>
    </ThemeProvider>
  );
}
