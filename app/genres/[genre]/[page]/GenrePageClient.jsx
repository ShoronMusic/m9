'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SongList from '@/components/SongList';
import Pagination from '@/components/Pagination';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import styles from './GenrePageClient.module.css';

export default function GenrePageClient({ 
  genreSlug, 
  pageNumber, 
  genreSonglist, 
  genreName, 
  genreDescription, 
  autoPlayFirst,
  accessToken = null 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoplay = searchParams.get('autoplay') === '1';
  const [isLoading, setIsLoading] = useState(false);
  const { posts, total, totalPages } = genreSonglist;
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);

  // SongListが期待する形式に変換
  const wpStylePosts = posts.map(song => {
    let artists = [];
    if (Array.isArray(song.artists) && song.artists.length > 0) {
      artists = song.artists;
    } else if (song.artist) {
      artists = [{ name: song.artist, acf: song.acf?.artist_acf || {}, id: song.artist_id || undefined, slug: song.artist_slug || undefined }];
    }
    // 動画ID/Spotify IDを一元化
    const ytvideoid = song.ytvideoid || song.youtube_id || song.acf?.ytvideoid || song.acf?.youtube_id || song.videoId || '';
    const spotify_track_id = song.spotify_track_id || song.spotifyTrackId || song.acf?.spotify_track_id || song.acf?.spotifyTrackId || '';
    const spotify_url = song.spotify_url || song.acf?.spotify_url || '';
    return {
      ...song,
      title: { rendered: song.title },
      artist: artists.map(a => a.name).join(', '),
      artists,
      acf: {
        ...song.acf,
        ytvideoid,
        youtube_id: ytvideoid,
        spotify_track_id,
        spotify_url,
      },
      date: song.releaseDate || song.date || song.post_date || '',
      featured_media_url: song.thumbnail,
      genre_data: song.genres,
      vocal_data: song.vocals || song.vocal_data,
      style: song.styles,
      slug: song.slug,
      content: { rendered: song.content },
    };
  });

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setIsLoading(true);
    router.push(`/genres/${genreSlug}/${newPage}`);
  };

  // ページ末尾到達時の処理
  const handlePageEnd = () => {
    if (pageNumber < totalPages) {
      router.push(`/genres/${genreSlug}/${pageNumber + 1}?autoplay=1`);
    }
  };

  // autoPlayFirstがtrueの場合に最初の曲を自動再生する
  useEffect(() => {
    if (autoPlayFirst && wpStylePosts.length > 0) {
      console.log('AutoPlayFirst enabled for page', pageNumber);
    }
  }, [autoPlayFirst, wpStylePosts.length, pageNumber, genreSlug]);

  useEffect(() => {
    setCurrentSongIndex(0);
    setIsPlaying(autoplay);
  }, [autoplay, pageNumber]);

  useEffect(() => {
    setIsLoading(false);
  }, [posts]);

  return (
    <div className={styles.container}>
      <div className={styles.header} style={{ textAlign: 'left', marginBottom: '24px' }}>
        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '2px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Genre
        </div>
        <h1 style={{
          textAlign: 'left',
          fontSize: '2.2em',
          fontWeight: 800,
          margin: 0,
          color: '#222',
          letterSpacing: '-0.01em',
          lineHeight: 1.1
        }}>{genreName}</h1>
        <div style={{ borderBottom: '2px solid #e0e0e0', width: '60px', margin: '12px 0 12px 0' }} />
        {genreDescription && <p className={styles.description} style={{ textAlign: 'left', color: '#666', fontSize: '1em', margin: '0 0 8px 0' }}>{genreDescription}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.95em', color: '#555' }}>
            全 {total} 曲中 {((pageNumber - 1) * 20) + 1} - {Math.min(pageNumber * 20, total)} 曲を表示
          </span>
          <span style={{ fontSize: '0.9em', color: '#888' }}>
            ページ {pageNumber} / {totalPages}
          </span>
        </div>
      </div>
      <SongList
        songs={wpStylePosts}
        currentPage={pageNumber}
        songsPerPage={20}
        styleSlug={String(genreSlug)}
        styleName={genreName}
        onPageEnd={handlePageEnd}
        onPreviousPage={() => {
          if (pageNumber > 1) {
            router.push(`/genres/${genreSlug}/${pageNumber - 1}?autoplay=last`);
          }
        }}
        autoPlayFirst={autoPlayFirst}
        total={total}
        pageType="genre"
        accessToken={accessToken}
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
      <ScrollToTopButton />
    </div>
  );
}
