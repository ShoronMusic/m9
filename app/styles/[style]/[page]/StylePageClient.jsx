'use client';

import { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { config } from '@/config/config';
import Pagination from '@/components/Pagination';
import SongList from '@/components/SongList';
import he from 'he'; // he パッケージをインポート
import { useRouter } from 'next/navigation';
import { firestore, auth } from '@/components/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import styles from './StylePageClient.module.css';

// HTML エンティティをデコードするヘルパー関数
function decodeHtml(html = "") {
  return html ? he.decode(html) : "";
}

// --- ここから追加: アーティスト名＋国籍表示用関数 ---
function formatArtistsWithOrigin(artists = []) {
  if (!Array.isArray(artists) || artists.length === 0) {
    return "Unknown Artist";
  }
  const formattedElements = artists.map((artist, index) => {
    let displayName = artist.name || "Unknown Artist";
    if (artist.prefix === "1" && !/^The\s+/i.test(displayName)) {
      displayName = "The " + displayName;
    }
    const origin = artist.artistorigin || artist.acf?.artistorigin;
    const originText = origin && origin !== "Unknown" ? ` (${origin})` : "";
    return (
      <span key={artist.id || index}>
        {displayName}{originText}{index !== artists.length - 1 ? ', ' : ''}
      </span>
    );
  });
  return formattedElements;
}
// --- ここまで追加 ---

export default function StylePageClient({ styleData, initialPage = 1, autoPlayFirst }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [likedSongs, setLikedSongs] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [viewCounts, setViewCounts] = useState({});
  const [userViewCounts, setUserViewCounts] = useState({});
  const [likeRefreshKey, setLikeRefreshKey] = useState(0);
  const songsPerPage = config.pagination.itemsPerPage;

  if (!styleData) {
    return <div className="text-red-500">データの取得に失敗しました。</div>;
  }

  const songs = Array.isArray(styleData?.songs) ? styleData.songs : [];
  const totalSongs = styleData?.total;
  const totalPages = styleData?.totalPages;

  // --- ここから追加: アーティスト配列生成ロジック ---
  const wpStylePosts = songs.map(song => {
    let artists = [];
    if (Array.isArray(song.artists) && song.artists.length > 0) {
      artists = song.artists.map(a => ({
        ...a,
        acf: {
          ...(a.acf || {}),
          artistorigin: a.artistorigin || a.acf?.artistorigin || song.acf?.artist_acf?.artistorigin || "",
        }
      }));
    } else if (song.artist) {
      artists = [{
        name: song.artist,
        acf: {
          ...(song.acf?.artist_acf || {}),
          artistorigin: song.acf?.artist_acf?.artistorigin || "",
        },
        id: song.artist_id || undefined,
        slug: song.artist_slug || undefined,
      }];
    }
    
    // Spotify IDを優先的に使用
    const spotify_track_id = song.spotify_track_id || song.spotifyTrackId || song.acf?.spotify_track_id || song.acf?.spotifyTrackId || '';
    
    // YouTube IDはフォールバックとして保持
    const ytvideoid = song.ytvideoid || song.youtube_id || song.acf?.ytvideoid || song.acf?.youtube_id || song.videoId || '';
    
    return {
      ...song,
      title: { rendered: song.title },
      artists,
      acf: {
        ...song.acf,
        spotify_track_id,
        ytvideoid,
        youtube_id: ytvideoid,
      },
      date: song.releaseDate || song.date || song.post_date || '',
      thumbnail: song.thumbnail,
      youtubeId: ytvideoid,
      spotifyTrackId: spotify_track_id,
      genre_data: song.genres,
      vocal_data: song.vocals,
      style: song.styles,
      slug: song.titleSlug || song.slug || (typeof song.title === 'string' ? song.title.toLowerCase().replace(/ /g, "-") : (song.title?.rendered ? song.title.rendered.toLowerCase().replace(/ /g, "-") : song.id)),
      content: { rendered: song.content },
    };
  }).filter(song => {
    // Spotify IDがある楽曲のみを表示
    const hasSpotifyId = song.acf?.spotify_track_id || song.spotifyTrackId;
    return hasSpotifyId;
  });
  // --- ここまで追加 ---

  // 表示範囲の計算
  const startIndex = Math.min((currentPage - 1) * songsPerPage + 1, totalSongs);
  const endIndex = Math.min(currentPage * songsPerPage, totalSongs);

  // ページ末尾到達時の処理
  const handlePageEnd = () => {
    if (currentPage < totalPages) {
      router.push(`/styles/${styleData.slug}/${currentPage + 1}?autoplay=1`);
    }
  };

  // Pagination に渡す関数
  const handlePageChange = (arg) => {
    const newPage = typeof arg === 'number' ? arg : parseInt(arg?.target?.value || arg?.target?.innerText || '1', 10);
    if (!isNaN(newPage) && newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
      router.push(`/styles/${styleData.slug}/${newPage}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // autoPlayFirstがtrueの場合に最初の曲を自動再生する
  useEffect(() => {
    if (autoPlayFirst && wpStylePosts.length > 0) {
      console.log('AutoPlayFirst enabled for page', currentPage);
    }
  }, [autoPlayFirst, wpStylePosts.length, currentPage, styleData.slug]);

  const decodedGenreName = decodeHtml(styleData?.name);

  // 視聴回数を取得する関数
  const fetchViewCounts = async () => {
    try {
      if (!songs || songs.length === 0) return;
      const songIds = songs.map(song => String(song.id)).filter(Boolean);
      if (songIds.length === 0) return;

      const viewCountsData = {};
      const chunkedIds = [];
      for (let i = 0; i < songIds.length; i += 30) {
          chunkedIds.push(songIds.slice(i, i + 30));
      }

      const promises = chunkedIds.map((chunk) => {
        const q = query(collection(firestore, "songViews"), where("__name__", "in", chunk));
        return getDocs(q);
      });

      const snapshots = await Promise.all(promises);
      snapshots.forEach((snapshot) => {
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            viewCountsData[docSnap.id] = data.totalViewCount || 0;
          }
        });
      });

      setViewCounts(viewCountsData);
    } catch (error) {
      console.error('Error fetching view counts:', error);
      setViewCounts({});
    }
  };

  // いいねを取得する関数
  const fetchLikes = async (userId = null) => {
    try {
      if (!songs || songs.length === 0) return;
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

      setLikeCounts(likeCountsData);
      setLikedSongs(likedSongsData);
    } catch (error) {
      console.error("Error fetching likes:", error);
      setLikeCounts({});
      setLikedSongs({});
    }
  };

  // いいね・視聴数の再取得トリガー
  const handleLike = () => {
    setLikeRefreshKey(prev => prev + 1);
  };

  // いいねと視聴回数を取得
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (songs && songs.length > 0) {
        const userId = auth.currentUser?.uid;
        if (isMounted) {
          // await fetchLikes(userId); // いいね取得を一時的に無効化
          await fetchViewCounts();
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [songs, likeRefreshKey]);

  return (
    <div className={styles.container} style={{ padding: 20 }}>
      <div style={{ textAlign: 'left', marginBottom: '24px' }}>
        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '2px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          STYLE
        </div>
        <h1 style={{
          textAlign: 'left',
          fontSize: '2.2em',
          fontWeight: 800,
          margin: 0,
          color: '#222',
          letterSpacing: '-0.01em',
          lineHeight: 1.1
        }}>{decodedGenreName || 'スタイル名不明'}</h1>
        <div style={{ borderBottom: '2px solid #e0e0e0', width: '60px', margin: '12px 0 12px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.95em', color: '#555' }}>
            全 {totalSongs} 曲中 {startIndex} - {endIndex} 曲を表示
          </span>
          <span style={{ fontSize: '0.9em', color: '#888' }}>
            ページ {currentPage} / {totalPages}
          </span>
        </div>
      </div>

      <SongList 
        songs={wpStylePosts} 
        styleSlug={styleData.slug} 
        styleName={styleData?.name} 
        total={totalSongs}
        songsPerPage={songsPerPage}
        currentPage={currentPage}
        onPageEnd={handlePageEnd}
        pageType={'style'}
        autoPlayFirst={autoPlayFirst}
        likedSongs={likedSongs}
        likeCounts={likeCounts}
        viewCounts={viewCounts}
        userViewCounts={userViewCounts}
        handleLike={handleLike}
      />

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
} 