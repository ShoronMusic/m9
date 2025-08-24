'use client';

import React, { useState, useEffect } from 'react';
import styles from './PlaylistFilters.module.css';

const PlaylistFilters = ({ playlists, onFilterChange }) => {
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // 利用可能な年とタグを抽出
  useEffect(() => {
    if (playlists && playlists.length > 0) {
      // 年を抽出
      const years = [...new Set(playlists
        .map(p => p.year)
        .filter(year => year !== null)
        .sort((a, b) => b - a))]; // 降順
      setAvailableYears(years);

      // タグを抽出
      const allTags = playlists
        .map(p => p.tags)
        .filter(tags => tags && tags.trim())
        .flatMap(tags => tags.split(',').map(tag => tag.trim()))
        .filter(tag => tag.length > 0);
      
      const uniqueTags = [...new Set(allTags)].sort();
      setAvailableTags(uniqueTags);
    }
  }, [playlists]);

  // フィルター適用
  const applyFilters = () => {
    const filteredPlaylists = playlists.filter(playlist => {
      const yearMatch = !selectedYear || playlist.year === selectedYear;
      const tagMatch = !selectedTag || 
        (playlist.tags && playlist.tags.toLowerCase().includes(selectedTag.toLowerCase()));
      
      return yearMatch && tagMatch;
    });

    onFilterChange(filteredPlaylists);
  };

  // フィルターリセット
  const resetFilters = () => {
    setSelectedYear(null);
    setSelectedTag(null);
    onFilterChange(playlists);
  };

  // 年フィルターの切り替え
  const toggleYearFilter = (year) => {
    if (selectedYear === year) {
      setSelectedYear(null); // 同じ年をクリックした場合はフィルターを解除
    } else {
      setSelectedYear(year); // 異なる年をクリックした場合はフィルターを適用
    }
  };

  // タグフィルターの切り替え
  const toggleTagFilter = (tag) => {
    if (selectedTag === tag) {
      setSelectedTag(null); // 同じタグをクリックした場合はフィルターを解除
    } else {
      setSelectedTag(tag); // 異なるタグをクリックした場合はフィルターを適用
    }
  };

  // フィルター変更時の自動適用
  useEffect(() => {
    applyFilters();
  }, [selectedYear, selectedTag]);

  return (
    <div className={styles.filtersContainer}>
      <h3 className={styles.filtersTitle}>フィルター</h3>
      
      <div className={styles.filterDescription}>
        <p>年またはタグをクリックしてプレイリストを絞り込みます。同じ項目を再度クリックするとフィルターが解除されます。</p>
      </div>
      
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>年</label>
        <div className={styles.filterOptions}>
          {availableYears.map(year => (
            <button
              key={year}
              className={`${styles.filterButton} ${selectedYear === year ? styles.active : ''}`}
              onClick={() => toggleYearFilter(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>タグ</label>
        <div className={styles.filterOptions}>
          {availableTags.map(tag => (
            <button
              key={tag}
              className={`${styles.filterButton} ${selectedTag === tag ? styles.active : ''}`}
              onClick={() => toggleTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterActions}>
        <button
          onClick={resetFilters}
          className={styles.resetButton}
        >
          フィルターリセット
        </button>
      </div>

      <div className={styles.filterInfo}>
        {selectedYear && <span className={styles.activeFilter}>年: {selectedYear}</span>}
        {selectedTag && <span className={styles.activeFilter}>タグ: {selectedTag}</span>}
        {!selectedYear && !selectedTag && <span>すべてのプレイリストを表示中</span>}
      </div>
    </div>
  );
};

export default PlaylistFilters;
