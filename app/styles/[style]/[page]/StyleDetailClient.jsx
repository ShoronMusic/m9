'use client';

import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import styles from './StylePage.module.css';

export default function StyleDetailClient({ styleData }) {
  if (!styleData) {
    return (
      <div className={styles.container}>
        <p>スタイル情報が見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.styleName}>{styleData.name}</h1>
          {styleData.acf?.styledescription && (
            <p className={styles.description}>{styleData.acf.styledescription}</p>
          )}
        </div>

        {styleData.acf?.styleartists && styleData.acf.styleartists.length > 0 && (
          <div className={styles.artistsSection}>
            <h2>アーティスト</h2>
            <ul className={styles.artistList}>
              {styleData.acf.styleartists.map((artist, index) => (
                <li key={index} className={styles.artistItem}>
                  <a href={`/${artist.slug}/1`} className={styles.artistLink}>
                    {artist.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {styleData.songs && styleData.songs.length > 0 && (
          <div>
            <h2>曲一覧</h2>
            <ul>
              {styleData.songs.map((song, idx) => (
                <li key={idx}>
                  <a href={`/${song.artists?.[0]?.slug || 'unknown-artist'}/songs/${song.titleSlug || song.slug || song.title?.rendered || song.id}`}>
                    {song.title?.rendered || song.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
} 