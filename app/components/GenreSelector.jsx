"use client";
import { useState, useEffect } from 'react';
import styles from './GenreSelector.module.css';

export default function GenreSelector({ artist, selectedGenres, onGenreChange, allGenres, categoryId }) {
  const [artistGenres, setArtistGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genreCount, setGenreCount] = useState({});
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedVocals, setSelectedVocals] = useState([]);
  const [publishDate, setPublishDate] = useState('');
  const [categorySlug, setCategorySlug] = useState('');

  // アーティストの投稿とジャンルを取得
  useEffect(() => {
    const fetchArtistGenres = async () => {
      if (!categoryId) {
        console.log('[ジャンル情報取得] カテゴリーIDが指定されていません');
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        // シンプルなエンドポイントを使用
        const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/wp/v2/posts?categories=${categoryId}&_fields=id,title,genre`;
        console.log('[ジャンル情報取得] APIエンドポイント:', apiUrl);

        const res = await fetch(apiUrl);
        console.log('[ジャンル情報取得] レスポンスステータス:', res.status);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const posts = await res.json();
        console.log('[ジャンル情報取得] 取得したデータ:', posts);

        // ジャンルの使用回数をカウント
        const counts = {};
        let postsWithGenres = 0;
        posts.forEach(post => {
          if (post.genre && Array.isArray(post.genre) && post.genre.length > 0) {
            postsWithGenres++;
            post.genre.forEach(genreId => {
              counts[genreId] = (counts[genreId] || 0) + 1;
            });
            console.log(`投稿 "${post.title.rendered}" のジャンル:`, post.genre);
          }
        });

        // 使用されているジャンルを抽出してソート
        const usedGenres = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .map(([id, count]) => {
            const genreId = parseInt(id);
            const genreInfo = allGenres.find(g => g.id === genreId);
            return {
              id: genreId,
              name: genreInfo ? genreInfo.name : `不明なジャンル (ID: ${genreId})`,
              count,
              percentage: Math.round((count / postsWithGenres) * 100)
            };
          });

        console.log('[ジャンル情報取得] 使用されているジャンル:', 
          usedGenres.map(g => `${g.name} (ID: ${g.id}): ${g.count}曲, ${g.percentage}%`));
        setArtistGenres(usedGenres);
        setGenreCount(counts);

      } catch (error) {
        console.error('[ジャンル情報取得] エラー:', error);
        setError(`ジャンル情報の取得に失敗しました: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      fetchArtistGenres();
    }
  }, [categoryId]);

  // その他のジャンルをグループ化
  const groupedOtherGenres = () => {
    // アーティストが使用したジャンルのIDセット
    const usedGenreIds = new Set(artistGenres.map(g => g.id));
    
    // 使用されていないジャンルを抽出してアルファベット順にソート
    const unusedGenres = allGenres
      .filter(genre => !usedGenreIds.has(genre.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    // アルファベットでグループ化
    return unusedGenres.reduce((acc, genre) => {
      const firstLetter = genre.name.charAt(0).toUpperCase();
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(genre);
      return acc;
    }, {});
  };

  // ジャンル選択完了時の処理
  const handleGenreComplete = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // 基本情報とタクソノミーの保存
      const postData = {
        title: title,
        content: `${artist} - ${title}`,
        youtubeId: youtubeId,
        categoryId: categoryId,
        styles: selectedStyles,
        vocals: selectedVocals,
        genres: selectedGenres,
        publishDate: publishDate
      };

      const response = await fetch('/api/proxy-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '保存に失敗しました');
      }

      if (result.warning) {
        console.warn('Warning:', result.warning);
      }

      // 保存成功後、サムネイル画像アップロード画面へ遷移
      const params = new URLSearchParams({
        postId: result.post.id,
        artist: artist,
        title: title,
        categorySlug: categorySlug
      });

      if (typeof window !== 'undefined') {
        window.location.href = `/thumbnail-upload?${params.toString()}`;
      }

    } catch (error) {
      console.error('Save error:', error);
      setError(`保存に失敗しました: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div>ジャンル情報を読み込み中...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  const otherGenresGrouped = groupedOtherGenres();

  return (
    <div className={styles.container}>
      <div className={styles.artistGenres}>
        <h3 className={styles.sectionTitle}>このアーティストのジャンル一覧</h3>
        {artistGenres.length > 0 ? (
          <div className={styles.frequentGenres}>
            {artistGenres.map(genre => (
              <div key={genre.id} className={styles.genreItem}>
                <label className={styles.genreLabel}>
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(genre.id)}
                    onChange={() => onGenreChange(genre.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles.genreName}>
                    {genre.name} ({genre.count}曲, {genre.percentage}%)
                  </span>
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noGenres}>ジャンルが見つかりません</p>
        )}
      </div>

      {/* 区切り線 */}
      <hr className={styles.divider} />

      {/* その他のジャンル（アルファベット順） */}
      <div className={styles.otherGenres}>
        <h3 className={styles.sectionTitle}>その他のジャンル</h3>
        <div className={styles.alphabeticalGroups}>
          {Object.entries(groupedOtherGenres())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([letter, genres]) => (
              <div key={letter} className={styles.alphabetGroup}>
                <h4 className={styles.letterHeading}>{letter}</h4>
                <div className={styles.genreList}>
                  {genres.map(genre => (
                    <label key={genre.id} className={styles.genreItem}>
                      <input
                        type="checkbox"
                        checked={selectedGenres.includes(genre.id)}
                        onChange={() => onGenreChange(genre.id)}
                        className={styles.checkbox}
                      />
                      <span className={styles.genreName}>{genre.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
} 