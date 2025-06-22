// src/app/genres/GenresPageClient.jsx

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './GenresPage.module.css';

const GenresPageClient = ({ genres: genresGrouped }) => {
  const [visibleCounts, setVisibleCounts] = useState({});
  const initialVisibleCount = 20;

  const handleLoadMore = (groupKey) => {
    setVisibleCounts((prevCounts) => ({
      ...prevCounts,
      [groupKey]: (prevCounts[groupKey] || initialVisibleCount) + 20,
    }));
  };

  const sortedGroupKeys = Object.keys(genresGrouped).sort((a, b) => {
    if (a === '0-9') return -1;
    if (b === '0-9') return 1;
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className={styles.container}>
      <div className={styles.stickyNav}>
        {sortedGroupKeys.map((groupKey) => (
          <a key={groupKey} href={`#${groupKey}`} className={styles.navLink}>
            {groupKey}
          </a>
        ))}
      </div>

      <div className={styles.listContainer}>
        <h1>Genres List</h1>
        {sortedGroupKeys.map((groupKey) => {
          const genres = genresGrouped[groupKey] || [];
          const visibleCount = visibleCounts[groupKey] || initialVisibleCount;
          const displayedGenres = genres.slice(0, visibleCount);

          if (genres.length === 0) return null;

          return (
            <div key={groupKey} id={groupKey} className={styles.genreGroup}>
              <span className={styles.backgroundLetter}>{groupKey}</span>
              <h2 className={styles.groupHeader}>{groupKey}</h2>
              <ul className={styles.genreGrid}>
                {displayedGenres.map((genre) => (
                  <li key={genre.id || genre.name} className={styles.genreItem}>
                    <Link href={`/genres/${genre.slug}/1`} passHref>
                      {genre.name} ({genre.count})
                    </Link>
                  </li>
                ))}
              </ul>
              {genres.length > visibleCount && (
                <button onClick={() => handleLoadMore(groupKey)} className={styles.loadMoreButton}>
                  Load More
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GenresPageClient;