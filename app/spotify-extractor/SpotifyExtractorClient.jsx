'use client';

import { useState, useEffect } from 'react';
import styles from './SpotifyExtractor.module.css';

export default function SpotifyExtractorClient() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [envLoaded, setEnvLoaded] = useState(false);

  // コンポーネントマウント時に.env.localから認証情報を取得
  useEffect(() => {
    const loadEnvCredentials = async () => {
      try {
        const response = await fetch('/api/spotify-credentials');
        if (response.ok) {
          const data = await response.json();
          if (data.hasCredentials) {
            setEnvLoaded(true);
          } else {
            setError('❌ .env.localファイルにSPOTIFY_CLIENT_IDとSPOTIFY_CLIENT_SECRETが設定されていません');
            setEnvLoaded(true);
          }
        } else {
          console.log('環境変数の取得に失敗しました');
          setError('❌ 環境変数の取得に失敗しました');
          setEnvLoaded(true);
        }
      } catch (err) {
        console.log('環境変数の取得中にエラーが発生しました');
        setError('❌ 環境変数の取得中にエラーが発生しました');
        setEnvLoaded(true);
      }
    };

    loadEnvCredentials();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!playlistUrl.trim()) {
      setError('プレイリストURLを入力してください');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/spotify-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlistUrl
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'プレイリストの抽出に失敗しました');
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!envLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          🔄 認証情報を読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>🎯 プレイリストURL</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="playlistUrl" className={styles.label}>
              SpotifyプレイリストURL:
            </label>
            <input
              type="url"
              id="playlistUrl"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className={styles.input}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitButton}
          >
            {isLoading ? '🔄 抽出中...' : '🚀 楽曲リストを抽出'}
          </button>
        </form>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {results && (
        <div className={styles.results}>
          <h2 className={styles.resultsTitle}>📋 抽出結果</h2>
          
          <div className={styles.playlistInfo}>
            <h3 className={styles.playlistName}>{results.playlistName}</h3>
            <p className={styles.playlistDescription}>{results.description}</p>
            <p className={styles.trackCount}>🎵 総曲数: {results.tracks.length}曲</p>
            <p className={styles.extractTime}>⏰ 抽出日時: {results.extractTime}</p>
          </div>

          <div className={styles.trackList}>
            <h4 className={styles.trackListTitle}>楽曲リスト:</h4>
            {results.tracks.map((track, index) => (
              <div key={index} className={styles.trackItem}>
                <span className={styles.trackNumber}>{index + 1}.</span>
                <span className={styles.trackInfo}>
                  {track.artists} - {track.title}
                </span>
                <span className={styles.trackAlbum}>({track.album})</span>
                <span className={styles.trackDuration}>[{track.duration}]</span>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              onClick={() => {
                const text = results.tracks.map((track, index) => 
                  `${index + 1}. ${track.artists} - ${track.title}`
                ).join('\n');
                navigator.clipboard.writeText(text);
              }}
              className={styles.copyButton}
            >
              📋 Artist - Title リストをコピー
            </button>
            
            <button
              onClick={() => {
                const fullText = [
                  `🎵 Spotify Playlist Extractor 結果`,
                  `=====================================`,
                  `📋 プレイリスト名: ${results.playlistName}`,
                  `📝 説明: ${results.description}`,
                  `🎵 総曲数: ${results.tracks.length}曲`,
                  `⏰ 抽出日時: ${results.extractTime}`,
                  ``,
                  `=== 楽曲リスト ===`,
                  ``,
                  ...results.tracks.map((track, index) => 
                    `${index + 1}. ${track.artists} - ${track.title} (${track.album}) [${track.duration}]`
                  )
                ].join('\n');
                navigator.clipboard.writeText(fullText);
              }}
              className={styles.copyButton}
            >
              📋 詳細リストをコピー
            </button>
          </div>
        </div>
      )}

      <div className={styles.help}>
        <h3 className={styles.helpTitle}>💡 使用方法</h3>
        <ol className={styles.helpList}>
          <li>Spotify Developer DashboardでClient IDとClient Secretを取得</li>
          <li><code>.env.local</code>ファイルに認証情報を設定（自動読み込み）</li>
          <li>SpotifyプレイリストURLを入力（例: https://open.spotify.com/playlist/37i9dQZF1DWZryfp6NSvtz）</li>
          <li>「楽曲リストを抽出」ボタンをクリック</li>
          <li>結果をコピーして使用</li>
        </ol>
        
        <div className={styles.envSetup}>
          <h4>🔧 .env.localファイルの設定</h4>
          <p>プロジェクトルートに<code>.env.local</code>ファイルを作成し、以下を設定してください：</p>
          <pre className={styles.envExample}>
{`SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here`}
          </pre>
        </div>
      </div>
    </div>
  );
}
