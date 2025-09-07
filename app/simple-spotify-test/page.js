'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './simple-spotify-test.module.css';

export default function SimpleSpotifyTestPage() {
  const { data: session } = useSession();
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);

  // テスト用のトラックデータ
  const testTrack = {
    id: '1JSTJqkT5qHq8MDJnJbRE1',
    name: 'Every Breath You Take',
    artists: [{ name: 'The Police' }],
    album: { name: 'Synchronicity (Remastered 2003)' },
    duration_ms: 253000,
    external_urls: { spotify: 'https://open.spotify.com/track/1JSTJqkT5qHq8MDJnJbRE1' },
    uri: 'spotify:track:1JSTJqkT5qHq8MDJnJbRE1'
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

  // Spotify Web APIを直接呼び出す関数
  const callSpotifyAPI = async (endpoint, method = 'GET', body = null) => {
    if (!session?.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Spotify API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return response.json();
  };

  // デバイス一覧を取得
  const getDevices = async () => {
    try {
      const devices = await callSpotifyAPI('/me/player/devices');
      addTestResult(
        'デバイス取得',
        'success',
        `${devices.devices.length}個のデバイスが見つかりました`,
        { devices: devices.devices }
      );
      return devices.devices;
    } catch (error) {
      addTestResult(
        'デバイス取得',
        'error',
        `デバイス取得に失敗: ${error.message}`,
        { error: error.toString() }
      );
      throw error;
    }
  };

  // 現在の再生状態を取得
  const getCurrentPlaybackState = async () => {
    try {
      const state = await callSpotifyAPI('/me/player');
      addTestResult(
        '再生状態取得',
        'success',
        state ? '再生状態を取得しました' : '現在再生中のデバイスがありません',
        { state }
      );
      return state;
    } catch (error) {
      addTestResult(
        '再生状態取得',
        'error',
        `再生状態取得に失敗: ${error.message}`,
        { error: error.toString() }
      );
      throw error;
    }
  };

  // トラックを再生
  const playTrack = async (trackUri) => {
    try {
      const body = {
        uris: [trackUri],
        position_ms: 0
      };

      await callSpotifyAPI('/me/player/play', 'PUT', body);
      addTestResult(
        'トラック再生',
        'success',
        'トラックの再生を開始しました',
        { trackUri, body }
      );
      setIsPlaying(true);
      setCurrentTrack(testTrack);
    } catch (error) {
      addTestResult(
        'トラック再生',
        'error',
        `トラック再生に失敗: ${error.message}`,
        { error: error.toString() }
      );
      throw error;
    }
  };

  // 再生を一時停止
  const pausePlayback = async () => {
    try {
      await callSpotifyAPI('/me/player/pause', 'PUT');
      addTestResult(
        '再生一時停止',
        'success',
        '再生を一時停止しました',
        {}
      );
      setIsPlaying(false);
    } catch (error) {
      addTestResult(
        '再生一時停止',
        'error',
        `一時停止に失敗: ${error.message}`,
        { error: error.toString() }
      );
      throw error;
    }
  };

  // 再生を再開
  const resumePlayback = async () => {
    try {
      await callSpotifyAPI('/me/player/play', 'PUT');
      addTestResult(
        '再生再開',
        'success',
        '再生を再開しました',
        {}
      );
      setIsPlaying(true);
    } catch (error) {
      addTestResult(
        '再生再開',
        'error',
        `再生再開に失敗: ${error.message}`,
        { error: error.toString() }
      );
      throw error;
    }
  };

  // 完全なテストを実行
  const runFullTest = async () => {
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

      // テスト2: デバイス取得
      const devices = await getDevices();
      if (devices.length === 0) {
        addTestResult('テスト中断', 'error', '利用可能なデバイスがありません。Spotifyアプリを開いてください。');
        return;
      }

      // アクティブなデバイスを探す
      const activeDevice = devices.find(device => device.is_active) || devices[0];
      setDeviceId(activeDevice.id);
      
      addTestResult(
        'デバイス選択',
        'success',
        `デバイスを選択しました: ${activeDevice.name}`,
        { deviceId: activeDevice.id, deviceName: activeDevice.name }
      );

      // テスト3: 現在の再生状態確認
      await getCurrentPlaybackState();

      // テスト4: トラック再生
      addTestResult(
        'トラック情報',
        'info',
        'テストトラック情報',
        {
          name: testTrack.name,
          artists: testTrack.artists.map(a => a.name).join(', '),
          album: testTrack.album.name,
          duration: `${Math.floor(testTrack.duration_ms / 60000)}:${((testTrack.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}`,
          uri: testTrack.uri
        }
      );

      await playTrack(testTrack.uri);

      // テスト5: 再生状態確認
      await new Promise(resolve => setTimeout(resolve, 2000));
      await getCurrentPlaybackState();

      addTestResult(
        'テスト完了',
        'success',
        'すべてのテストが完了しました',
        { trackName: testTrack.name, isPlaying }
      );

    } catch (error) {
      addTestResult(
        'テストエラー',
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

  const togglePlayback = async () => {
    if (isPlaying) {
      await pausePlayback();
    } else {
      await resumePlayback();
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>シンプル Spotify 再生テスト</h1>
      <p className={styles.subtitle}>既存プレイヤーを使わずにSpotify Web APIを直接使用</p>
      
      <div className={styles.trackInfo}>
        <h2>テスト対象トラック</h2>
        <div className={styles.trackCard}>
          <div className={styles.trackDetails}>
            <h3>{testTrack.name}</h3>
            <p className={styles.artists}>{testTrack.artists.map(a => a.name).join(', ')}</p>
            <p className={styles.album}>{testTrack.album.name}</p>
            <p className={styles.duration}>
              再生時間: {Math.floor(testTrack.duration_ms / 60000)}:{((testTrack.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}
            </p>
            <p className={styles.trackId}>Track URI: {testTrack.uri}</p>
            <a 
              href={testTrack.external_urls.spotify} 
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
          onClick={runFullTest}
          disabled={isLoading}
          className={styles.testButton}
        >
          {isLoading ? 'テスト実行中...' : '完全テスト開始'}
        </button>
        
        {currentTrack && (
          <button 
            onClick={togglePlayback}
            className={isPlaying ? styles.pauseButton : styles.playButton}
          >
            {isPlaying ? '⏸️ 一時停止' : '▶️ 再生'}
          </button>
        )}
        
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
            <span className={styles.statusLabel}>デバイスID:</span>
            <span className={deviceId ? styles.statusSuccess : styles.statusError}>
              {deviceId || '未選択'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>現在の曲:</span>
            <span className={currentTrack ? styles.statusSuccess : styles.statusInfo}>
              {currentTrack ? currentTrack.name : 'なし'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.instructions}>
        <h2>テスト手順</h2>
        <ol>
          <li>Spotifyアプリを開いて音楽を再生できる状態にしてください</li>
          <li>「完全テスト開始」ボタンをクリックしてください</li>
          <li>テストが完了したら、再生/一時停止ボタンで制御をテストしてください</li>
        </ol>
      </div>
    </div>
  );
}

