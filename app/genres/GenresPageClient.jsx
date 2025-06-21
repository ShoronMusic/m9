// src/app/genres/GenresPageClient.jsx

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ScrollToTopButton from '../components/ScrollToTopButton'; // パスを調整
import styles from './GenresPage.module.css'; // CSS Modules のインポート

export default function GenresPageClient({ genres }) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const alphabetAndNumbers = ['0-9', ...alphabet, 'Other'];
  const [visibleGenres, setVisibleGenres] = useState(10);

  const loadMoreGenres = () => {
    setVisibleGenres((prev) => prev + 10);
  };

  return (
    <>
      <div className={styles.anchorMenu}>
        {alphabetAndNumbers.map(letter => (
          <Link key={letter} href={`#${letter}`} className={styles.anchorLink}>
            {letter}
          </Link>
        ))}
      </div>
      <div>
        <h1>Genres List</h1>
        {alphabetAndNumbers.map((letter) => (
          <div key={letter} id={letter} className={styles.letterArea} style={{ position: 'relative' }}>
            <h2><span>{letter}</span></h2>
            <span className={styles.letterBg}>{letter}</span>
            <ul className={styles.genreGrid}>
              {genres[letter]?.slice(0, visibleGenres).map((genre) => (
                <li key={genre.slug}>
                  <Link href={`/genres/${encodeURIComponent(genre.slug)}/`}>
                    <span dangerouslySetInnerHTML={{ __html: genre.name }} /> ({genre.count})
                  </Link>
                </li>
              )) || <p>No genres found for this letter.</p>}
            </ul>
            {genres[letter]?.length > visibleGenres && (
              <button onClick={loadMoreGenres} className={styles.loadMoreButton}>
                Load More
              </button>
            )}
          </div>
        ))}
      </div>
      <ScrollToTopButton />
    </>
  );
}