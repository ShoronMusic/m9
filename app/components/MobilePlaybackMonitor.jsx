'use client';

import { useEffect, useRef, useCallback } from 'react';

export default function MobilePlaybackMonitor({ 
  onPlaybackError, 
  onAuthError, 
  onScreenStateChange,
  onNetworkChange,
  onBatteryChange 
}) {
  const playbackStateRef = useRef({
    isPlaying: false,
    lastPosition: 0,
    lastUpdateTime: Date.now(),
    errorCount: 0,
    authErrorCount: 0,
    screenOffCount: 0,
    networkDisconnectCount: 0,
    wakeLockCount: 0,
    wakeLockReleaseCount: 0,
  });

  const logToAxiom = useCallback(async (level, type, message, details = {}) => {
    try {
      await fetch('/api/mobile-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          type,
          message,
          details: {
            ...details,
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
            screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
            viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
            viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
            isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
            platform: typeof navigator !== 'undefined' ? navigator.platform : '',
            language: typeof navigator !== 'undefined' ? navigator.language : '',
            online: typeof navigator !== 'undefined' ? navigator.onLine : true,
          }
        })
      });
    } catch (error) {
      console.error('Failed to log to Axiom:', error);
    }
  }, []);

  // 音楽再生状態の監視
  const monitorPlaybackState = useCallback(() => {
    const audioElements = document.querySelectorAll('audio, video');
    const currentTime = Date.now();
    
    audioElements.forEach((audio, index) => {
      if (audio) {
        const isPlaying = !audio.paused && !audio.ended && audio.readyState > 2;
        const currentPosition = audio.currentTime;
        
        // 再生が停止した場合
        if (playbackStateRef.current.isPlaying && !isPlaying) {
          const stopDuration = currentTime - playbackStateRef.current.lastUpdateTime;
          
          logToAxiom('warning', 'playback_stopped', '音楽再生が停止しました', {
            stopDuration,
            lastPosition: playbackStateRef.current.lastPosition,
            currentPosition,
            audioIndex: index,
            readyState: audio.readyState,
            networkState: audio.networkState,
            error: audio.error ? audio.error.message : null,
            component: 'MobilePlaybackMonitor'
          });
          
          playbackStateRef.current.errorCount++;
        }
        
        // 再生位置が進まない場合（フリーズ）
        if (isPlaying && Math.abs(currentPosition - playbackStateRef.current.lastPosition) < 0.1) {
          const freezeDuration = currentTime - playbackStateRef.current.lastUpdateTime;
          
          if (freezeDuration > 5000) { // 5秒以上フリーズ
            logToAxiom('error', 'playback_frozen', '音楽再生がフリーズしました', {
              freezeDuration,
              currentPosition,
              audioIndex: index,
              readyState: audio.readyState,
              networkState: audio.networkState,
              component: 'MobilePlaybackMonitor'
            });
          }
        }
        
        playbackStateRef.current.isPlaying = isPlaying;
        playbackStateRef.current.lastPosition = currentPosition;
        playbackStateRef.current.lastUpdateTime = currentTime;
      }
    });
  }, [logToAxiom]);

  // 画面のオン/オフ状態監視
  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    const currentTime = Date.now();
    
    if (!isVisible) {
      playbackStateRef.current.screenOffCount++;
      
      logToAxiom('warning', 'screen_off', '画面がオフになりました', {
        screenOffCount: playbackStateRef.current.screenOffCount,
        isPlaying: playbackStateRef.current.isPlaying,
        lastPosition: playbackStateRef.current.lastPosition,
        component: 'MobilePlaybackMonitor'
      });
      
      if (onScreenStateChange) {
        onScreenStateChange(false);
      }
    } else {
      logToAxiom('info', 'screen_on', '画面がオンになりました', {
        screenOffCount: playbackStateRef.current.screenOffCount,
        isPlaying: playbackStateRef.current.isPlaying,
        component: 'MobilePlaybackMonitor'
      });
      
      if (onScreenStateChange) {
        onScreenStateChange(true);
      }
    }
  }, [logToAxiom, onScreenStateChange]);

  // ネットワーク状態監視
  const handleOnline = useCallback(() => {
    logToAxiom('info', 'network_online', 'ネットワーク接続が復旧しました', {
      component: 'MobilePlaybackMonitor'
    });
    
    if (onNetworkChange) {
      onNetworkChange(true);
    }
  }, [logToAxiom, onNetworkChange]);

  const handleOffline = useCallback(() => {
    playbackStateRef.current.networkDisconnectCount++;
    
    logToAxiom('error', 'network_offline', 'ネットワーク接続が切断されました', {
      networkDisconnectCount: playbackStateRef.current.networkDisconnectCount,
      isPlaying: playbackStateRef.current.isPlaying,
      component: 'MobilePlaybackMonitor'
    });
    
    if (onNetworkChange) {
      onNetworkChange(false);
    }
  }, [logToAxiom, onNetworkChange]);

  // バッテリー状態監視
  const handleBatteryChange = useCallback(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        const batteryLevel = Math.round(battery.level * 100);
        const isCharging = battery.charging;
        
        if (batteryLevel < 20 && !isCharging) {
          logToAxiom('warning', 'low_battery', 'バッテリー残量が少なくなっています', {
            batteryLevel,
            isCharging,
            isPlaying: playbackStateRef.current.isPlaying,
            component: 'MobilePlaybackMonitor'
          });
        }
        
        if (onBatteryChange) {
          onBatteryChange({ level: batteryLevel, isCharging });
        }
      });
    }
  }, [logToAxiom, onBatteryChange]);

  // 認証エラーの監視
  const handleAuthError = useCallback((error) => {
    playbackStateRef.current.authErrorCount++;
    
    logToAxiom('error', 'auth_error', '認証エラーが発生しました', {
      authErrorCount: playbackStateRef.current.authErrorCount,
      errorMessage: error.message || error,
      isPlaying: playbackStateRef.current.isPlaying,
      component: 'MobilePlaybackMonitor'
    });
    
    if (onAuthError) {
      onAuthError(error);
    }
  }, [logToAxiom, onAuthError]);

  // ページ離脱時の監視
  const handleBeforeUnload = useCallback(() => {
    logToAxiom('info', 'page_unload', 'ページを離脱しました', {
      totalErrors: playbackStateRef.current.errorCount,
      totalAuthErrors: playbackStateRef.current.authErrorCount,
      totalScreenOffs: playbackStateRef.current.screenOffCount,
      totalNetworkDisconnects: playbackStateRef.current.networkDisconnectCount,
      totalWakeLocks: playbackStateRef.current.wakeLockCount,
      totalWakeLockReleases: playbackStateRef.current.wakeLockReleaseCount,
      isPlaying: playbackStateRef.current.isPlaying,
      component: 'MobilePlaybackMonitor'
    });
  }, [logToAxiom]);

  // 初期化
  useEffect(() => {
    // 再生状態監視の開始
    const playbackInterval = setInterval(monitorPlaybackState, 1000);
    
    // イベントリスナーの追加
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    // バッテリー監視の開始
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        battery.addEventListener('levelchange', handleBatteryChange);
        battery.addEventListener('chargingchange', handleBatteryChange);
        handleBatteryChange(); // 初期状態を記録
      });
    }
    
    // Wake Lock APIの監視
    if ('wakeLock' in navigator) {
      // Wake Lockの状態変化を監視
      const originalRequest = navigator.wakeLock.request;
      
      // Wake Lock取得の監視
      navigator.wakeLock.request = async function(type) {
        try {
          // ページが可視状態でない場合はWake Lockを取得しない
          if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            console.log('🔒 Wake Lock request skipped - page not visible');
            throw new Error('The requesting page is not visible');
          }

          const wakeLock = await originalRequest.call(this, type);
          playbackStateRef.current.wakeLockCount++;
          
          logToAxiom('info', 'wake_lock_acquired', 'Wake Lockが取得されました', {
            component: 'MobilePlaybackMonitor',
            wakeLockType: type,
            wakeLockCount: playbackStateRef.current.wakeLockCount,
          });

          // Wake Lock解放イベントの監視
          wakeLock.addEventListener('release', () => {
            playbackStateRef.current.wakeLockReleaseCount++;
            logToAxiom('info', 'wake_lock_released', 'Wake Lockが解放されました', {
              component: 'MobilePlaybackMonitor',
              wakeLockReleaseCount: playbackStateRef.current.wakeLockReleaseCount,
            });
          });

          return wakeLock;
        } catch (error) {
          // ページが非表示の場合はエラーログを送信しない（正常な動作）
          if (error.message !== 'The requesting page is not visible') {
            logToAxiom('error', 'wake_lock_error', `Wake Lock取得エラー: ${error.message}`, {
              component: 'MobilePlaybackMonitor',
              error: error.message,
            });
          }
          throw error;
        }
      };
    }

    // 初期状態を記録
    logToAxiom('info', 'monitor_started', 'モバイル再生監視を開始しました', {
      screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
      isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
      platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      wakeLockSupported: 'wakeLock' in navigator,
      component: 'MobilePlaybackMonitor'
    });
    
    // クリーンアップ
    return () => {
      clearInterval(playbackInterval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      
      if ('getBattery' in navigator) {
        navigator.getBattery().then((battery) => {
          battery.removeEventListener('levelchange', handleBatteryChange);
          battery.removeEventListener('chargingchange', handleBatteryChange);
        });
      }

      // Wake Lock APIの復元
      if ('wakeLock' in navigator && navigator.wakeLock.request !== navigator.wakeLock.request) {
        // 元の関数を復元（必要に応じて）
        console.log('Wake Lock API monitoring cleaned up');
      }
    };
  }, [monitorPlaybackState, handleVisibilityChange, handleOnline, handleOffline, handleBatteryChange, handleBeforeUnload, logToAxiom]);

  // このコンポーネントはUIを表示しない
  return null;
}

// 認証エラー監視用のフック
export function useAuthErrorMonitor() {
  const logAuthError = useCallback(async (error) => {
    try {
      await fetch('/api/mobile-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          type: 'auth_error',
          message: `認証エラー: ${error.message || error}`,
          details: {
            errorMessage: error.message || error,
            errorStack: error.stack,
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            component: 'useAuthErrorMonitor'
          }
        })
      });
    } catch (logError) {
      console.error('Failed to log auth error:', logError);
    }
  }, []);

  return { logAuthError };
}
