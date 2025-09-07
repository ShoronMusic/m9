'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayer } from '../components/PlayerContext';
import styles from './test-spotify.module.css';

export default function TestSpotifyPage() {
  const { data: session } = useSession();
  const { setCurrentTrack, isPlaying, togglePlay, playTrack } = usePlayer();
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // テスト用のトラックデータ
  const testTrack = {
    id: '1JSTJqkT5qHq8MDJnJbRE1',
    spotify_track_id: '1JSTJqkT5qHq8MDJnJbRE1',
    title: 'Every Breath You Take',
    artists: 'The Police',
    album: 'Synchronicity (Remastered 2003)',
    duration: 253000, // 4分13秒
    thumbnail: 'https://i.scdn.co/image/ab67616d0000b273c8a11e48c91e982d086afc69',
    spotify_url: 'https://open.spotify.com/track/1JSTJqkT5qHq8MDJnJbRE1'
  };

  const addTestResult = (test, status, message, details = {}) => {
    setTestResults(prev => [...prev, {
      id: Date.now(),
      test,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    }]);
  };

  const runSpotifyTests = async () => {
    setIsLoading(true);
    setTestResults([]);

    try {
      // テスト1: セッション確認
      addTestResult(
        'セッション確認',
        session ? 'success' : 'error',
        session ? 'Spotifyログイン済み' : 'Spotifyログインが必要',
        { 
          hasSession: !!session,
          hasAccessToken: !!session?.accessToken,
          userId: session?.user?.id 
        }
      );

      if (!session) {
        addTestResult('テスト中断', 'error', 'Spotifyログインが必要です');
        return;
      }

      // テスト2: トラック設定
      addTestResult(
        'トラック設定',
        'info',
        'テストトラックを設定中...',
        { trackId: testTrack.id, title: testTrack.title }
      );

      // playTrack関数を使用してトラックを設定・再生
      playTrack(testTrack, 0, [testTrack], 'test-page');

      // テスト3: プレイヤー初期化待機
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addTestResult(
        'プレイヤー初期化',
        'success',
        'Spotifyプレイヤーが初期化されました',
        { trackId: testTrack.id }
      );

      // テスト4: 再生テスト
      addTestResult(
        '再生テスト',
        'info',
        'playTrackで再生を開始しました',
        { trackId: testTrack.id }
      );

      // テスト5: 再生状態確認
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      addTestResult(
        '再生状態確認',
        isPlaying ? 'success' : 'warning',
        isPlaying ? '正常に再生中です' : '再生が開始されていません',
        { 
          isPlaying,
          trackId: testTrack.id,
          title: testTrack.title,
          artists: testTrack.artists
        }
      );

      // テスト6: トラック情報確認
      addTestResult(
        'トラック情報確認',
        'success',
        'トラック情報が正しく設定されました',
        {
          id: testTrack.id,
          title: testTrack.title,
          artists: testTrack.artists,
          album: testTrack.album,
          duration: testTrack.duration,
          spotify_url: testTrack.spotify_url
        }
      );

    } catch (error) {
      addTestResult(
        'エラー',
        'error',
        `テスト中にエラーが発生しました: ${error.message}`,
        { error: error.toString() }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Spotify ストリーム再生テスト</h1>
      
      <div className={styles.trackInfo}>
        <h2>テスト対象トラック</h2>
        <div className={styles.trackCard}>
          <img 
            src={testTrack.thumbnail} 
            alt={testTrack.title}
            className={styles.thumbnail}
          />
          <div className={styles.trackDetails}>
            <h3>{testTrack.title}</h3>
            <p className={styles.artists}>{testTrack.artists}</p>
            <p className={styles.album}>{testTrack.album}</p>
            <p className={styles.duration}>
              再生時間: {Math.floor(testTrack.duration / 60000)}:{(testTrack.duration % 60000 / 1000).toFixed(0).padStart(2, '0')}
            </p>
            <p className={styles.trackId}>Track ID: {testTrack.id}</p>
            <a 
              href={testTrack.spotify_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.spotifyLink}
            >
              Spotify で開く
            </a>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button 
          onClick={runSpotifyTests}
          disabled={isLoading}
          className={styles.testButton}
        >
          {isLoading ? 'テスト実行中...' : 'ストリーム再生テスト開始'}
        </button>
        
        <button 
          onClick={clearResults}
          className={styles.clearButton}
        >
          結果をクリア
        </button>
      </div>

      <div className={styles.results}>
        <h2>テスト結果</h2>
        {testResults.length === 0 ? (
          <p className={styles.noResults}>テストを実行してください</p>
        ) : (
          <div className={styles.resultsList}>
            {testResults.map((result) => (
              <div 
                key={result.id} 
                className={`${styles.resultItem} ${styles[result.status]}`}
              >
                <div className={styles.resultHeader}>
                  <span className={styles.testName}>{result.test}</span>
                  <span className={styles.status}>{result.status}</span>
                  <span className={styles.timestamp}>
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className={styles.resultMessage}>{result.message}</div>
                {Object.keys(result.details).length > 0 && (
                  <details className={styles.resultDetails}>
                    <summary>詳細情報</summary>
                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.currentStatus}>
        <h2>現在の状態</h2>
        <div className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>ログイン状態:</span>
            <span className={session ? styles.statusSuccess : styles.statusError}>
              {session ? 'ログイン済み' : '未ログイン'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>再生状態:</span>
            <span className={isPlaying ? styles.statusSuccess : styles.statusInfo}>
              {isPlaying ? '再生中' : '停止中'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>アクセストークン:</span>
            <span className={session?.accessToken ? styles.statusSuccess : styles.statusError}>
              {session?.accessToken ? '有効' : 'なし'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
