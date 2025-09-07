'use client';

import { useState, useEffect } from 'react';
import styles from './isolated-spotify-test.module.css';

export default function IsolatedSpotifyTest() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState({
    login: false,
    playback: false,
    token: false
  });

  // テストトラック
  const testTrackId = '1JSTJqkT5qHq8MDJnJbRE1'; // The Police - Synchronicity

  // ログを追加する関数
  const addLog = (message, type = 'info', details = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, {
      id: Date.now(),
      message,
      type,
      timestamp,
      details
    }]);
  };

  // アクセストークンを取得
  const getAccessToken = async () => {
    try {
      const response = await fetch('/api/spotify/token');
      const data = await response.json();
      
      if (data.access_token) {
        setAccessToken(data.access_token);
        setIsLoggedIn(true);
        setCurrentStatus(prev => ({ ...prev, login: true, token: true }));
        addLog('Spotifyログイン済み', 'success', { token: data.access_token.substring(0, 20) + '...' });
        return data.access_token;
      } else {
        addLog('アクセストークンの取得に失敗しました', 'error', data);
        return null;
      }
    } catch (error) {
      addLog('アクセストークン取得エラー', 'error', error.message);
      return null;
    }
  };

  // デバイス一覧を取得
  const getDevices = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        addLog('デバイス一覧を取得しました', 'success', { devices: data.devices });
        
        // アクティブなデバイスを探す
        const activeDevice = data.devices.find(device => device.is_active);
        if (activeDevice) {
          setDeviceId(activeDevice.id);
          addLog('アクティブデバイスを発見しました', 'success', { deviceId: activeDevice.id, deviceName: activeDevice.name });
          return activeDevice.id;
        } else {
          addLog('アクティブなデバイスが見つかりません', 'warning');
          return null;
        }
      } else {
        const errorData = await response.json();
        addLog('デバイス取得エラー', 'error', errorData);
        return null;
      }
    } catch (error) {
      addLog('デバイス取得リクエストエラー', 'error', error.message);
      return null;
    }
  };

  // 現在の再生状態を取得
  const getCurrentPlaybackState = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.is_playing) {
          setCurrentTrack(data.item);
          setIsPlaying(true);
          setCurrentStatus(prev => ({ ...prev, playback: true }));
          addLog('現在再生中のトラックを取得しました', 'success', { 
            track: data.item?.name, 
            artist: data.item?.artists[0]?.name 
          });
        } else {
          addLog('現在再生中のトラックはありません', 'info');
        }
        return data;
      } else if (response.status === 204) {
        addLog('現在再生中のトラックはありません', 'info');
        return null;
      } else {
        const errorData = await response.json();
        addLog('再生状態取得エラー', 'error', errorData);
        return null;
      }
    } catch (error) {
      addLog('再生状態取得リクエストエラー', 'error', error.message);
      return null;
    }
  };

  // トラックを再生（Web API直接呼び出し）
  const playTrack = async (token, deviceId) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${testTrackId}`]
        }),
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        addLog('トラックの再生を開始しました', 'success', { trackId: testTrackId });
        setCurrentStatus(prev => ({ ...prev, playback: true }));
        
        // 少し待ってから再生状態を確認
        setTimeout(async () => {
          await getCurrentPlaybackState(token);
        }, 2000);
      } else {
        const errorData = await response.json();
        addLog('再生に失敗しました', 'error', errorData);
      }
    } catch (error) {
      addLog('再生リクエストエラー', 'error', error.message);
    }
  };

  // 再生を一時停止
  const pauseTrack = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        addLog('再生を一時停止しました', 'success');
        setIsPlaying(false);
        setCurrentStatus(prev => ({ ...prev, playback: false }));
      } else {
        const errorData = await response.json();
        addLog('一時停止に失敗しました', 'error', errorData);
      }
    } catch (error) {
      addLog('一時停止リクエストエラー', 'error', error.message);
    }
  };

  // テスト開始
  const startTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    setCurrentStatus({ login: false, playback: false, token: false });
    
    addLog('テスト開始', 'info');
    
    // 1. アクセストークンを取得
    const token = await getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    // 2. デバイス一覧を取得
    addLog('デバイス一覧を取得中...', 'info');
    const device = await getDevices(token);
    if (!device) {
      addLog('アクティブなデバイスが見つかりません。Spotifyアプリで音楽を再生してください。', 'warning');
      setIsLoading(false);
      return;
    }
    
    // 3. 現在の再生状態を確認
    addLog('現在の再生状態を確認中...', 'info');
    await getCurrentPlaybackState(token);
    
    // 4. テストトラックを再生
    addLog('テストトラックを再生中...', 'info');
    await playTrack(token, device);
    
    setIsLoading(false);
  };

  // 結果をクリア
  const clearResults = () => {
    setTestResults([]);
    setCurrentStatus({ login: false, playback: false, token: false });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Spotify ストリーム再生テスト</h1>
      
      <div className={styles.trackInfo}>
        <h2 className={styles.subtitle}>テスト対象トラック</h2>
        <div className={styles.trackDetails}>
          <div className={styles.albumArt}>
            <img src="https://i.scdn.co/image/ab67616d0000b273c8a11e48c91a982d086afc69" alt="Album Art" className={styles.albumArtImage} />
          </div>
          <div className={styles.trackInfoText}>
            <p><strong>Every Breath You Take</strong></p>
            <p>The Police</p>
            <p>Synchronicity (Remastered 2003)</p>
            <p>再生時間: 4:13</p>
            <p>Track ID: {testTrackId}</p>
            <a 
              href={`https://open.spotify.com/track/${testTrackId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.spotifyLink}
            >
              Spotifyで開く
            </a>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button 
          onClick={startTest} 
          disabled={isLoading}
          className={styles.startButton}
        >
          {isLoading ? 'テスト中...' : 'ストリーム再生テスト開始'}
        </button>
        <button onClick={clearResults} className={styles.clearButton}>
          結果をクリア
        </button>
      </div>

      {/* 現在の状態表示 */}
      <div className={styles.currentStatus}>
        <h3 className={styles.subtitle}>現在の状態</h3>
        <div className={styles.statusItems}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>ログイン状態:</span>
            <span className={`${styles.statusBadge} ${currentStatus.login ? styles.success : styles.error}`}>
              {currentStatus.login ? 'ログイン済み' : '未ログイン'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>再生状態:</span>
            <span className={`${styles.statusBadge} ${currentStatus.playback ? styles.success : styles.error}`}>
              {currentStatus.playback ? '再生中' : '停止中'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>アクセストークン:</span>
            <span className={`${styles.statusBadge} ${currentStatus.token ? styles.success : styles.error}`}>
              {currentStatus.token ? '有効' : '無効'}
            </span>
          </div>
        </div>
      </div>

      {/* 現在再生中のトラック情報 */}
      {currentTrack && (
        <div className={styles.currentTrack}>
          <h3 className={styles.subtitle}>現在再生中のトラック</h3>
          <div className={styles.trackDisplay}>
            <img 
              src={currentTrack.album.images[0]?.url} 
              alt="Album Art" 
              className={styles.currentAlbumArt}
            />
            <div className={styles.trackInfo}>
              <p className={styles.trackName}>{currentTrack.name}</p>
              <p className={styles.artistName}>{currentTrack.artists[0]?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* シンプルなコントロール */}
      {accessToken && (
        <div className={styles.simpleControls}>
          <h3 className={styles.subtitle}>再生コントロール</h3>
          <div className={styles.controlButtons}>
            <button 
              onClick={() => playTrack(accessToken, deviceId)} 
              className={styles.playButton}
              disabled={!deviceId}
            >
              ▶️ 再生
            </button>
            <button 
              onClick={() => pauseTrack(accessToken)} 
              className={styles.pauseButton}
            >
              ⏸️ 一時停止
            </button>
          </div>
        </div>
      )}

      <div className={styles.results}>
        <h3 className={styles.resultsTitle}>テスト結果</h3>
        {testResults.map((result) => (
          <div key={result.id} className={`${styles.resultCard} ${styles[result.type]}`}>
            <div className={styles.resultHeader}>
              <span className={styles.resultMessage}>{result.message}</span>
              <span className={styles.resultTime}>{result.timestamp}</span>
            </div>
            {result.details && (
              <details className={styles.resultDetails}>
                <summary className={styles.resultDetailsSummary}>▶ 詳細情報</summary>
                <pre className={styles.resultDetailsPre}>{JSON.stringify(result.details, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
