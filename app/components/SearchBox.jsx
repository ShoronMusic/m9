'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import styles from './SearchBox.module.css';

const SearchBox = forwardRef(({ onSearchExampleClick }, ref) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [total, setTotal] = useState(0);
  
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // 外部から検索クエリを設定するための関数を公開
  useImperativeHandle(ref, () => ({
    setQuery: (newQuery) => {
      console.log('🔧 External setQuery called with:', newQuery);
      setQuery(newQuery);
      if (newQuery.trim()) {
        performSearch(newQuery);
      }
    }
  }));

  // 検索例ボタンからの値設定
  useEffect(() => {
    if (onSearchExampleClick) {
      console.log('🔧 Setting up onSearchExampleClick callback');
      onSearchExampleClick((newQuery) => {
        console.log('🔧 onSearchExampleClick callback called with:', newQuery);
        setQuery(newQuery);
        if (newQuery.trim()) {
          performSearch(newQuery);
        }
      });
    }
  }, [onSearchExampleClick]);

  // 検索実行
  const performSearch = async (searchQuery) => {
    console.log('🚀 performSearch called with:', searchQuery);
    
    if (!searchQuery.trim()) {
      console.log('❌ Empty search query, clearing results');
      setResults([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    console.log('⏳ Starting search for:', searchQuery);
    
    try {
      const apiUrl = `/api/search?q=${encodeURIComponent(searchQuery)}`;
      console.log('🌐 Fetching from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      console.log('📥 API response:', data);
      
      if (response.ok) {
        setResults(data.results || []);
        setTotal(data.total || 0);
        console.log('✅ Search successful, results:', data.results?.length || 0);
      } else {
        console.error('❌ Search error:', data.error);
        setResults([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('❌ Search request failed:', error);
      setResults([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
      console.log('🏁 Search completed, loading state cleared');
    }
  };

  // 検索クエリの変更を監視（デバウンス付き）
  useEffect(() => {
    console.log('🔄 Query changed to:', query);
    
    const timer = setTimeout(() => {
      if (query.trim()) {
        console.log('⏰ Debounced search triggered for:', query);
        performSearch(query);
      } else {
        console.log('🧹 Clearing results due to empty query');
        setResults([]);
        setTotal(0);
      }
    }, 300); // 300msのデバウンス

    return () => clearTimeout(timer);
  }, [query]);

  // クリックアウトで検索結果を非表示
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 検索結果の表示/非表示を制御
  useEffect(() => {
    const shouldShow = results.length > 0 || isLoading;
    console.log('👁️ Setting showResults to:', shouldShow, '(results:', results.length, 'loading:', isLoading, ')');
    setShowResults(shouldShow);
  }, [results, isLoading]);

  const handleInputFocus = () => {
    console.log('🎯 Input focused, showResults:', results.length > 0 || isLoading);
    if (results.length > 0 || isLoading) {
      setShowResults(true);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    console.log('✏️ Input changed to:', newValue);
    setQuery(newValue);
    setShowResults(true);
  };

  const handleResultClick = () => {
    console.log('🖱️ Result clicked, hiding results');
    setShowResults(false);
    setQuery('');
  };

  return (
    <div className={styles.searchContainer} ref={searchRef}>
      <div className={styles.searchBox}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="アーティスト名や曲名を検索..."
          className={styles.searchInput}
        />
        {isLoading && (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner}></div>
          </div>
        )}
        {query && !isLoading && (
          <button
            onClick={() => {
              console.log('🧹 Clear button clicked');
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className={styles.clearButton}
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
        <div className={styles.searchResults}>
          {isLoading ? (
            <div className={styles.loadingMessage}>検索中...</div>
          ) : results.length > 0 ? (
            <>
              <div className={styles.resultsHeader}>
                <span className={styles.resultsCount}>
                  {total}件の結果
                </span>
              </div>
              <div className={styles.resultsList}>
                {results.map((song) => (
                  <a
                    key={song.id}
                    href={song.url}
                    className={styles.resultItem}
                    onClick={handleResultClick}
                  >
                    <div className={styles.songInfo}>
                      <div className={styles.songTitle}>{song.title}</div>
                      <div className={styles.artistNames}>
                        {song.artists_name.join(', ')}
                      </div>
                    </div>
                    <div className={styles.resultArrow}>→</div>
                  </a>
                ))}
              </div>
            </>
          ) : query.trim() ? (
            <div className={styles.noResults}>
              検索結果が見つかりませんでした
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});

SearchBox.displayName = 'SearchBox';

export default SearchBox;
