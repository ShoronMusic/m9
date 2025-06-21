'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
// import Image from 'next/image'; // Imageを削除
import styles from './ArtistLetterPage.module.css';
import Pagination from '@/components/Pagination';
// import { getThumbnailPath } from '@/lib/utils'; // getThumbnailPathを削除

export default function ArtistLetterPageClient({ letter, artists, page, total, perPage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // アルファベットと数字のリストを生成
  const letters = [...Array(26)].map((_, i) => String.fromCharCode(65 + i)).concat('0-9');
  const [searchQuery, setSearchQuery] = useState('');

  // アーティスト名を検索クエリでフィルタリング (大文字小文字区別せず)
  const filteredArtists = artists.filter(artist => 
    artist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ページネーション計算
  const currentPage = page || 1;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // 表示範囲計算
  const startIdx = (currentPage - 1) * perPage + 1;
  const endIdx = Math.min(currentPage * perPage, total);

  // ページ切り替え
  const goToPage = (p) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) {
      params.set('page', p);
    } else {
      params.delete('page');
    }
    router.push(`/artists/${letter.toLowerCase()}${params.toString() ? '?' + params.toString() : ''}`);
  };

  // 検索中かどうか
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className={styles.container}>
      {/* Indexと検索をまとめるコンテナ */}
      <div className={styles.controlsContainer}> 
        {/* アルファベット索引 */}
        <div className={styles.letterIndex}>
          {letters.map((l) => (
            <Link
              key={l}
              href={`/artists/${l.toLowerCase()}`}
              className={`${styles.letterLink} ${l.toLowerCase() === letter.toLowerCase() ? styles.activeLetter : ''}`}
            >
              {l}
            </Link>
          ))}
        </div>

        {/* キーワード検索欄 */}
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="このリスト内を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>
      <header className={styles.header}>
        {/* Back Link は削除または別の場所に移動しても良い */}
        {/* 
        <Link href="/artists" className={styles.backLink}>
          ← Back to All Artists
        </Link> 
        */}
        <h1 className={styles.title}>
          Artists - {letter.toUpperCase()}
          <span className={styles.count}>({total > 0 ? `${startIdx} - ${endIdx} / ${total}` : ''})</span>
        </h1>
      </header>
      {!isSearching && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
      )}
      <div className={styles.artistList}>
        {isSearching ? (
          filteredArtists.length > 0 ? (
            filteredArtists.map((artist) => {
              const country = artist.country ?? null;
              const songCount = artist.songCount ?? 0;
              const japanName = artist.artistjpname ?? null;
              // thePrefixまたはthe_prefixで判定
              const isThe = (artist.thePrefix === 'The') ||
                artist.the_prefix === "1" ||
                artist.the_prefix === 1 ||
                artist.the_prefix === true ||
                artist.the_prefix === "true" ||
                artist.the_prefix === "on";
              const thePrefix = isThe ? 'The ' : '';
              return (
                <Link
                  key={artist.id}
                  href={`/${artist.slug}`}
                  className={styles.artistItem}
                >
                  <div className={styles.artistInfo}> 
                    <h2 className={styles.artistName}>{thePrefix}{artist.name}</h2>
                    <p className={styles.japanName}>{japanName || ''}</p>
                    <div className={styles.metaRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.origin}>{country}</span>
                      <span className={styles.songCount}>{songCount} songs</span>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', color: '#888', margin: '2em 0' }}>該当アーティストが見つかりません</div>
          )
        ) : (
          artists.map((artist) => {
            const country = artist.country ?? null;
            const songCount = artist.songCount ?? 0;
            const japanName = artist.artistjpname ?? null;
            const isThe = (artist.thePrefix === 'The') ||
              artist.the_prefix === "1" ||
              artist.the_prefix === 1 ||
              artist.the_prefix === true ||
              artist.the_prefix === "true" ||
              artist.the_prefix === "on";
            const thePrefix = isThe ? 'The ' : '';
            return (
              <Link
                key={artist.id}
                href={`/${artist.slug}`}
                className={styles.artistItem}
              >
                <div className={styles.artistInfo}> 
                  <h2 className={styles.artistName}>{thePrefix}{artist.name}</h2>
                  <p className={styles.japanName}>{japanName || ''}</p>
                  <div className={styles.metaRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={styles.origin}>{country}</span>
                    <span className={styles.songCount}>{songCount} songs</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
      {!isSearching && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  );
} 