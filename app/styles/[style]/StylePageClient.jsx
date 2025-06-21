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
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

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
  const [userViewCounts, setUserViewCounts] = useState({});
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

  // 視聴回数を取得する関数
  const fetchViewCounts = async () => {
    try {
      if (!songs || songs.length === 0) return;
      const songIds = songs.map(song => String(song.id)).filter(Boolean);
      if (songIds.length === 0) return;
      const viewCountsData = {};
      // Firestoreの10件制限やwhere('__name__', 'in', ...)の問題を回避し、1件ずつ取得
      for (const id of songIds) {
        const docRef = doc(firestore, 'songViews', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          viewCountsData[id] = data.totalViewCount || 0;
        }
      }
      setViewCounts(viewCountsData);
      console.log('fetchViewCounts:', viewCountsData);
    } catch (error) {
      console.error('Error fetching view counts:', error);
      setViewCounts({});
    }
  };

  // いいねを取得する関数
  const fetchLikes = async (userId = null) => {
    const likeCountsData = {};
    const likedSongsData = {};
    try {
      const querySnapshot = await getDocs(collection(firestore, "likes"));
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        likeCountsData[docSnap.id] = data.likeCount || 0;
        if (userId && data.userIds && data.userIds.includes(userId)) {
          likedSongsData[docSnap.id] = true;
        }
      });
      setLikeCounts(likeCountsData);
      setLikedSongs(likedSongsData);
      console.log('fetchLikes:', likedSongsData, userId);
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
          await fetchLikes(userId);
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