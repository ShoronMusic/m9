'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SongList from '../../components/SongList'; // Adjusted path
import Pagination from '../../components/Pagination'; // Adjusted path
import styles from './GenrePageClient.module.css'; // Adjusted path and filename

const ITEMS_PER_PAGE = 20;

export default function GenrePageClient({ genreName, pageNumber, genreSonglist, genreSlug, genreDescription }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const autoPlayParam = searchParams.get("autoplay") || "";
  const autoPlayFirst = (autoPlayParam === "1" || autoPlayParam === "last");

  const posts = genreSonglist.posts || [];
  const total = genreSonglist.total || 0;
  const totalPages = genreSonglist.totalPages || 1;

  const [songs, setSongs] = useState(posts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(pageNumber < totalPages);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{genreName}</h1>
      {genreDescription && (
          <p className="text-gray-600 mb-8">{genreDescription}</p>
      )}
      <p className={styles.totalSongs}>Total Songs: {total}</p>
      
      {total > 0 && (
        <div className={styles.paginationInfo}>
          <p>Page {pageNumber} of {totalPages}</p>
        </div>
      )}

      <SongList
        songs={songs}
        currentPage={pageNumber}
        songsPerPage={ITEMS_PER_PAGE}
        styleSlug={genreSlug}
        styleName={genreName}
        onPageEnd={() => {
          if (pageNumber < totalPages) {
            router.push(`/genres/${genreSlug}/${pageNumber + 1}?autoplay=1`);
          }
        }}
        onPreviousPage={() => {
          if (pageNumber > 1) {
            router.push(`/genres/${genreSlug}/${pageNumber - 1}?autoplay=last`);
          }
        }}
        autoPlayFirst={false}
        total={total}
        pageType="genre"
      />

      {totalPages > 1 && (
        <Pagination
          totalPages={totalPages}
          currentPage={pageNumber}
          onPageChange={(newPage) => {
            if (newPage >= 1 && newPage <= totalPages) {
              router.push(`/genres/${genreSlug}/${newPage}`);
            }
          }}
        />
      )}

      {/*
      <div className={styles.footer}>
        <p className={styles.footerText}>
          Many cover arts are provided by{" "}
          <a href="https://www.spotify.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <img
              src="/images/Full_Logo_Black_RGB.svg"
              alt="Spotify"
              className={styles.spotifyLogo}
            />
          </a>
        </p>
      </div>
      */}
    </div>
  );
} 