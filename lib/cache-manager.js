// キャッシュ管理ユーティリティ
class CacheManager {
  constructor() {
    this.swRegistration = null;
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', this.swRegistration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // 全キャッシュをクリア
  async clearAllCache() {
    if (!this.swRegistration) {
      throw new Error('Service Worker not available');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          if (event.data.success) {
            resolve({ success: true, message: 'キャッシュがクリアされました' });
          } else {
            reject(new Error(event.data.error || 'キャッシュクリアに失敗しました'));
          }
        }
      };

      this.swRegistration.active.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }

  // 画像キャッシュのみクリア
  async clearImageCache() {
    if (!this.swRegistration) {
      throw new Error('Service Worker not available');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'IMAGE_CACHE_CLEARED') {
          if (event.data.success) {
            resolve({ success: true, message: '画像キャッシュがクリアされました' });
          } else {
            reject(new Error(event.data.error || '画像キャッシュクリアに失敗しました'));
          }
        }
      };

      this.swRegistration.active.postMessage(
        { type: 'CLEAR_IMAGE_CACHE' },
        [messageChannel.port2]
      );
    });
  }

  // ブラウザのキャッシュをクリア
  async clearBrowserCache() {
    try {
      // IndexedDBのクリア
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            await indexedDB.deleteDatabase(db.name);
          }
        }
      }

      // localStorageとsessionStorageのクリア（プレイヤー状態以外）
      const keysToKeep = ['tunedive_player_state'];
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      }

      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          sessionStorage.removeItem(key);
        }
      }

      return { success: true, message: 'ブラウザキャッシュがクリアされました' };
    } catch (error) {
      throw new Error(`ブラウザキャッシュクリアに失敗: ${error.message}`);
    }
  }

  // 古い画像の強制リロード
  async forceReloadImages() {
    try {
      // 画像要素を全て取得
      const images = document.querySelectorAll('img');
      
      images.forEach(img => {
        if (img.src) {
          // クエリパラメータを追加してキャッシュを無効化
          const separator = img.src.includes('?') ? '&' : '?';
          img.src = `${img.src}${separator}t=${Date.now()}`;
        }
      });

      return { success: true, message: '画像が強制リロードされました' };
    } catch (error) {
      throw new Error(`画像強制リロードに失敗: ${error.message}`);
    }
  }

  // キャッシュサイズの確認
  async getCacheSize() {
    if (!this.swRegistration) {
      return { size: 0, message: 'Service Worker not available' };
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      return { size: totalSize, sizeInMB, message: `キャッシュサイズ: ${sizeInMB}MB` };
    } catch (error) {
      return { size: 0, message: `キャッシュサイズ取得に失敗: ${error.message}` };
    }
  }

  // スマホ向け最適化
  async optimizeForMobile() {
    try {
      const results = [];
      
      // 画像キャッシュをクリア
      try {
        const imageResult = await this.clearImageCache();
        results.push(imageResult);
      } catch (error) {
        results.push({ success: false, message: `画像キャッシュクリア失敗: ${error.message}` });
      }

      // 古い画像を強制リロード
      try {
        const reloadResult = await this.forceReloadImages();
        results.push(reloadResult);
      } catch (error) {
        results.push({ success: false, message: `画像リロード失敗: ${error.message}` });
      }

      // ブラウザキャッシュをクリア
      try {
        const browserResult = await this.clearBrowserCache();
        results.push(browserResult);
      } catch (error) {
        results.push({ success: false, message: `ブラウザキャッシュクリア失敗: ${error.message}` });
      }

      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      return {
        success: successCount === totalCount,
        results,
        message: `最適化完了: ${successCount}/${totalCount} 成功`
      };
    } catch (error) {
      throw new Error(`モバイル最適化に失敗: ${error.message}`);
    }
  }
}

// シングルトンインスタンス
let cacheManagerInstance = null;

export const getCacheManager = () => {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager();
  }
  return cacheManagerInstance;
};

export default CacheManager;
