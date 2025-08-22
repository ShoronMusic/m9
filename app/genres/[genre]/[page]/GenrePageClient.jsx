'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SongList from '@/components/SongList';
import Pagination from '@/components/Pagination';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import styles from './GenrePageClient.module.css';

import { getStyleName } from '@/lib/styleMapping';

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
    
    // スタイル情報の抽出（compact-songs.jsonから取得した情報をそのまま使用）
    let styleId = song.style_id || null;
    let styleName = song.style_name || null;
    
    // style_idはあるがstyle_nameがない場合、getStyleNameで補完
    if (styleId && !styleName) {
      styleName = getStyleName(styleId);
    }
    
    // スタイル情報のデバッグログ
    if (posts.indexOf(song) === 0) {
      console.log('🎨 GenrePageClient - Style info from compact-songs.json:', {
        songTitle: song.title,
        style_id: song.style_id,
        style_name: song.style_name,
        styles: song.styles,
        extractedStyleId: styleId,
        extractedStyleName: styleName
      });
    }
    

    
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
      genres: song.genres, // PlayTrackerが期待する形式
      vocal_data: song.vocals || song.vocal_data,
      style: song.styles,
      styles: song.styles, // PlayTrackerが期待する形式
      style_id: styleId,
      style_name: styleName,
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
      <div className={styles.header}>
        <div className={styles.genreLabel}>
          Genre
        </div>
        <h1 className={styles.genreTitle}>
          {genreName}
        </h1>
        <div className={styles.divider} />
        {genreDescription && <p className={styles.description}>{genreDescription}</p>}
        <div className={styles.pageDetails}>
          <span className={styles.songCount}>
            全 {total} 曲中 {((pageNumber - 1) * 20) + 1} - {Math.min(pageNumber * 20, total)} 曲を表示
          </span>
          <span className={styles.pageNumber}>
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
        source={`genres/${genreSlug}/${pageNumber}`}
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
