'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './ArtistsPage.module.css';

export default function ArtistsPageClient({ artistsByLetter }) {
  const router = useRouter();
  // アルファベットと数字のリストを生成
  const letters = [...Array(26)].map((_, i) => String.fromCharCode(65 + i)).concat('0-9');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredArtists, setFilteredArtists] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 全アーティスト配列を作成（1ページ目のみ）
  const allArtists = Object.values(artistsByLetter).flat();

  // 検索クエリが変更されたときの処理
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim() === '') {
      setFilteredArtists([]);
      setShowSuggestions(false);
      return;
    }

    // 完全一致
    const exactMatches = allArtists.filter(artist =>
      artist.name.toLowerCase() === query.toLowerCase() ||
      (artist.japanName && artist.japanName === query)
    );

    // 前方一致
    const startsWithMatches = allArtists.filter(artist =>
      (artist.name.toLowerCase().startsWith(query.toLowerCase()) ||
       (artist.japanName && artist.japanName.startsWith(query)))
      && !exactMatches.includes(artist)
    );

    // 部分一致
    const partialMatches = allArtists.filter(artist =>
      (artist.name.toLowerCase().includes(query.toLowerCase()) ||
       (artist.japanName && artist.japanName.includes(query)))
      && !exactMatches.includes(artist)
      && !startsWithMatches.includes(artist)
    );

    // 優先順位で結合し、最大10件
    const filtered = [...exactMatches, ...startsWithMatches, ...partialMatches].slice(0, 10);

    setFilteredArtists(filtered);
    setShowSuggestions(true);
  };

  // 検索処理
  const handleSearch = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
  };

  // 候補をクリックしたときの処理
  const handleSuggestionClick = (artist) => {
    setSearchQuery('');
    setShowSuggestions(false);
    // アーティストの詳細ページへ遷移
    router.push(`/${artist.slug}`);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Artist List Alphabetical Index</h1>
      <div className={styles.controlsContainer}>
        {/* アルファベット索引 */}
        <div className={styles.letterIndex}>
          {letters.map((letter) => (
            <Link
              key={letter}
              href={`/artists/${letter.toLowerCase()}`}
              className={styles.letterLink}
            >
              {letter}
            </Link>
          ))}
        </div>

        {/* キーワード検索欄 */}
        <div className={styles.searchWrapper}>
          <form className={styles.searchContainer} onSubmit={handleSearch}>
            <input 
              type="text"
              placeholder="アーティスト名で検索..."
              value={searchQuery}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />
          </form>
          
          {/* 検索候補の表示 */}
          {showSuggestions && filteredArtists.length > 0 && (
            <div className={styles.suggestions}>
              {filteredArtists.map((artist) => (
                <div
                  key={artist.id}
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionClick(artist)}
                >
                  <span className={styles.artistName}>{artist.name}</span>
                  {artist.japanName && (
                    <span className={styles.japanName}>{artist.japanName}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 