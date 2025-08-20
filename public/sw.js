// Service Worker for TuneDive - Background Audio Management
const CACHE_NAME = 'tunedive-v1';
const AUDIO_CACHE_NAME = 'tunedive-audio-v1';

// インストール時の処理
self.addEventListener('install', (event) => {
  console.log('TuneDive Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/offline.html',
        '/manifest.json'
      ]);
    })
  );
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  console.log('TuneDive Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== AUDIO_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// メッセージ受信時の処理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // プレイヤー状態の更新
  if (event.data && event.data.type === 'UPDATE_PLAYER_STATE') {
    const playerState = event.data.state;
    // バックグラウンドでプレイヤー状態を保持
    event.waitUntil(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.put('player-state', new Response(JSON.stringify(playerState)));
      })
    );
  }
  
  // プレイヤー状態の取得
  if (event.data && event.data.type === 'GET_PLAYER_STATE') {
    event.waitUntil(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match('player-state');
      }).then((response) => {
        if (response) {
          return response.json();
        }
        return null;
      }).then((state) => {
        event.ports[0].postMessage({ type: 'PLAYER_STATE', state });
      })
    );
  }
  
  // キャッシュクリアの処理
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        // 新しいキャッシュを作成
        return caches.open(CACHE_NAME);
      }).then((cache) => {
        // 基本的なファイルのみキャッシュ
        return cache.addAll([
          '/',
          '/offline.html',
          '/manifest.json'
        ]);
      }).then(() => {
        console.log('Cache cleared successfully');
        // クリア完了を通知
        event.ports[0].postMessage({ type: 'CACHE_CLEARED', success: true });
      }).catch((error) => {
        console.error('Cache clear failed:', error);
        event.ports[0].postMessage({ type: 'CACHE_CLEARED', success: false, error: error.message });
      })
    );
  }
  
  // 画像キャッシュのみクリア
  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('image') || cacheName.includes('thumbnail')) {
              console.log('Clearing image cache:', cacheName);
              return caches.delete(cacheName);
            }
            return Promise.resolve();
          })
        );
      }).then(() => {
        console.log('Image cache cleared successfully');
        event.ports[0].postMessage({ type: 'IMAGE_CACHE_CLEARED', success: true });
      }).catch((error) => {
        console.error('Image cache clear failed:', error);
        event.ports[0].postMessage({ type: 'IMAGE_CACHE_CLEARED', success: false, error: error.message });
      })
    );
  }
});

// フェッチ時の処理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Spotify API へのリクエストはキャッシュしない
  if (request.url.includes('api.spotify.com')) {
    return;
  }
  
  // オーディオファイルの処理
  if (request.destination === 'audio' || request.url.includes('.mp3') || request.url.includes('.ogg')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }
  
  // その他のリクエスト
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request).then((networkResponse) => {
        // 成功したリクエストのみキャッシュ
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // オフライン時のフォールバック
        if (request.destination === 'document') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});

// バックグラウンド同期（対応ブラウザのみ）
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-audio-sync') {
    event.waitUntil(
      // バックグラウンドでプレイヤー状態を同期
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match('player-state');
      }).then((response) => {
        if (response) {
          return response.json();
        }
        return null;
      }).then((state) => {
        if (state) {
          // プレイヤー状態を更新
          console.log('Background audio sync:', state);
        }
      })
    );
  }
});

// プッシュ通知の処理
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || '新しい音楽が追加されました',
      icon: '/images/icon-192x192.png',
      badge: '/images/badge-72x72.png',
      tag: 'tunedive-notification',
      data: data
    };
    
    event.waitUntil(
      self.registration.showNotification('TuneDive', options)
    );
  }
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 既存のウィンドウがあればフォーカス
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 新しいウィンドウを開く
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('TuneDive Service Worker loaded');
