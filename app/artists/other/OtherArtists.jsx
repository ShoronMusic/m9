// src/app/artists/other/OtherArtists.jsx

'use client'; // クライアントコンポーネントとして宣言

import React, { useState } from 'react';
import Link from 'next/link';
import ScrollToTopButton from '../../components/ScrollToTopButton';
import styles from './OtherArtists.module.css'; // CSSモジュールのインポート

export default function OtherArtists({ initialCategories, totalArtistsCount, totalCount }) {
  const [categories, setCategories] = useState(initialCategories);
  const [hasMore, setHasMore] = useState(categories.length < totalCount);
  const [loading, setLoading] = useState(false);

  // Show More: 残りを一括取得
  const handleShowMore = async () => {
    setLoading(true);
    try {
      const REMAINING_LIMIT = 9999;
      const offset = categories.length;
      const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/my_namespace/v1/artists-other?limit=${REMAINING_LIMIT}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch remaining "artists-other" data');
      }
      const data = await res.json();
      const newItems = data.artists ?? data;

      setCategories([...categories, ...newItems]);
      setHasMore(false);
    } catch (error) {
      console.error('Error fetching more "artists-other":', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.artistIndexContainer}>
      <h1>Artists Index (Other)</h1>
      <p>Total artists: {totalArtistsCount}</p>
      <ul className={styles.artistMenu}>
        {categories.length > 0 ? (
          categories.map((cat) => (
            <li key={cat.term_id} className={styles.artistItem}>
              <Link href={`/${cat.slug}`} className={styles.artistLink} legacyBehavior>
                {cat.name}
              </Link>
              &nbsp;({cat.count})
            </li>
          ))
        ) : (
          <p>No artists found (names not starting with A-Z).</p>
        )}
      </ul>
      {hasMore && (
        <div className={styles.showMoreButtonContainer}>
          <button onClick={handleShowMore} disabled={loading} className={styles.showMoreButton}>
            {loading ? 'Loading...' : 'Show More'}
          </button>
        </div>
      )}
      <ScrollToTopButton />
    </div>
  );
}
