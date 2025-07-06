'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { config } from '@/config/config';
import Pagination from '@/components/Pagination';
import SongList from '@/components/SongList';
import he from 'he'; // he パッケージをインポート
import { useRouter } from 'next/navigation';
import { firestore, auth } from '@/components/firebase';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';

// HTML エンティティをデコードするヘルパー関数
function decodeHtml(html = "") {
  return html ? he.decode(html) : "";
}

export default function StylePageClient({ styleData, initialPage = 1, autoPlayFirst }) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [likedSongs, setLikedSongs] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [viewCounts, setViewCounts] = useState({});
  const [likeRefreshKey, setLikeRefreshKey] = useState(0);
  const songsPerPage = config.pagination.itemsPerPage;

  if (!styleData) {
    return <div className="text-red-500">データの取得に失敗しました。</div>;
  }

  const songs = Array.isArray(styleData?.songs) ? styleData.songs : [];
  const totalSongs = styleData?.totalSongs || songs.length;
  const totalPages = styleData?.totalPages || 1;

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

  const decodedGenreName = decodeHtml(styleData?.name);

  // 視聴回数を効率的に取得する関数
  const fetchViewCounts = async (songIds) => {
    if (!songIds || songIds.length === 0) return;
    try {
      const viewCountsData = {};
      // 表示中の曲のIDのみを対象に、一度のクエリで視聴回数を取得
      const q = query(collection(firestore, 'songViews'), where(documentId(), 'in', songIds));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(docSnap => {
        viewCountsData[docSnap.id] = docSnap.data().totalViewCount || 0;
      });
      // データがない曲は0で初期化
      songIds.forEach(id => {
        if (!viewCountsData[id]) viewCountsData[id] = 0;
      });
      setViewCounts(viewCountsData);
    } catch (error) {
      console.error('Error fetching view counts:', error);
      setViewCounts({});
    }
  };

  // いいね情報を効率的に取得する関数
  const fetchLikes = async (songIds, userId = null) => {
    if (!songIds || songIds.length === 0) return;
    const likeCountsData = {};
    const likedSongsData = {};
    try {
      // 表示中の曲のIDのみを対象に、一度のクエリでいいね情報を取得
      const q = query(collection(firestore, "likes"), where(documentId(), 'in', songIds));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const songId = docSnap.id;
        likeCountsData[songId] = data.likeCount || 0;
        if (userId && data.userIds?.includes(userId)) {
          likedSongsData[songId] = true;
        }
      });
      // データがない曲は0で初期化
      songIds.forEach(id => {
        if (!likeCountsData[id]) likeCountsData[id] = 0;
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
        const songIds = songs.map(song => String(song.id)).filter(Boolean);
        if (songIds.length === 0) return;

        const userId = auth.currentUser?.uid;
        if (isMounted) {
          // 2つのデータ取得を並列で実行して高速化
          await Promise.all([fetchLikes(songIds, userId), fetchViewCounts(songIds)]);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [songs, likeRefreshKey]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{decodedGenreName || 'スタイル名不明'}</h1>
      {styleData?.description && (
        <p className="text-gray-600 mb-8">{styleData.description}</p>
      )}

      {totalSongs > 0 && (
        <div className="text-sm text-gray-600 mb-4 space-y-1">
          <p>全 {totalSongs} 曲中 {startIndex} - {endIndex} 曲を表示</p>
          <p>ページ {currentPage} / {totalPages}</p>
        </div>
      )}

      <SongList 
        songs={songs} 
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