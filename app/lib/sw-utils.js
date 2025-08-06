// Service Worker ユーティリティ関数

// Service Worker の登録
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered successfully:', registration);
      
      // 更新の確認
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新しいService Workerが利用可能
            console.log('New Service Worker available');
          }
        });
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

// プレイヤー状態をService Workerに送信
export const updatePlayerStateInSW = (state) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPDATE_PLAYER_STATE',
      state
    });
  }
};

// Service Workerからプレイヤー状態を取得
export const getPlayerStateFromSW = () => {
  return new Promise((resolve) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'PLAYER_STATE') {
          resolve(event.data.state);
        }
      };
      
      navigator.serviceWorker.controller.postMessage({
        type: 'GET_PLAYER_STATE'
      }, [channel.port2]);
    } else {
      resolve(null);
    }
  });
};

// バックグラウンド同期の登録
export const registerBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('background-audio-sync');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
};

// プッシュ通知の許可を要求
export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// オフライン状態の検出
export const isOnline = () => {
  return navigator.onLine;
};

// オンライン/オフライン状態の監視
export const onOnlineStatusChange = (callback) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // クリーンアップ関数を返す
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// バッテリー状態の監視（対応ブラウザのみ）
export const getBatteryInfo = async () => {
  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      return {
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime
      };
    } catch (error) {
      console.error('Battery API not available:', error);
      return null;
    }
  }
  return null;
};

// デバイスの省電力モード検出
export const detectPowerSaveMode = () => {
  // バッテリー情報から省電力モードを推測
  return getBatteryInfo().then(battery => {
    if (battery) {
      // バッテリー残量が低い場合や充電中でない場合
      return battery.level < 0.2 || (!battery.charging && battery.level < 0.5);
    }
    return false;
  });
};

// バックグラウンド処理の最適化
export const optimizeForBackground = (isBackground) => {
  if (isBackground) {
    // バックグラウンド時の最適化
    console.log('Optimizing for background mode');
    
    // 更新頻度を下げる
    if (window.performance && window.performance.memory) {
      // メモリ使用量を監視
      const memoryInfo = window.performance.memory;
      if (memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.8) {
        console.warn('High memory usage detected');
      }
    }
  }
};

// デバイス情報の取得
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  
  return {
    isMobile,
    isIOS,
    isAndroid,
    userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine
  };
};

// パフォーマンス監視
export const monitorPerformance = () => {
  if ('performance' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          console.log(`Performance: ${entry.name} - ${entry.duration}ms`);
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    
    return observer;
  }
  return null;
};
