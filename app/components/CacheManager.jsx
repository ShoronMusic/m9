'use client';

import React, { useState, useEffect } from 'react';
import { getCacheManager } from '@/lib/cache-manager';
import styles from './CacheManager.module.css';

export default function CacheManager() {
  const [cacheManager, setCacheManager] = useState(null);
  const [cacheSize, setCacheSize] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const initCacheManager = async () => {
      const manager = getCacheManager();
      setCacheManager(manager);
      
      // 初期化完了後にキャッシュサイズを取得
      setTimeout(async () => {
        try {
          const sizeInfo = await manager.getCacheSize();
          setCacheSize(sizeInfo);
        } catch (error) {
          console.error('Failed to get cache size:', error);
        }
      }, 1000);
    };

    initCacheManager();
  }, []);

  const handleClearImageCache = async () => {
    if (!cacheManager) return;
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await cacheManager.clearImageCache();
      setMessage(result.message);
      
      // キャッシュサイズを更新
      const sizeInfo = await cacheManager.getCacheSize();
      setCacheSize(sizeInfo);
    } catch (error) {
      setMessage(`エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAllCache = async () => {
    if (!cacheManager) return;
    
    if (!confirm('全てのキャッシュをクリアしますか？これにより保存された設定も失われます。')) {
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await cacheManager.clearAllCache();
      setMessage(result.message);
      
      // キャッシュサイズを更新
      const sizeInfo = await cacheManager.getCacheSize();
      setCacheSize(sizeInfo);
    } catch (error) {
      setMessage(`エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimizeForMobile = async () => {
    if (!cacheManager) return;
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await cacheManager.optimizeForMobile();
      setMessage(result.message);
      
      // キャッシュサイズを更新
      const sizeInfo = await cacheManager.getCacheSize();
      setCacheSize(sizeInfo);
    } catch (error) {
      setMessage(`エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceReloadImages = async () => {
    if (!cacheManager) return;
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await cacheManager.forceReloadImages();
      setMessage(result.message);
    } catch (error) {
      setMessage(`エラー: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCacheSize = async () => {
    if (!cacheManager) return;
    
    try {
      const sizeInfo = await cacheManager.getCacheSize();
      setCacheSize(sizeInfo);
    } catch (error) {
      console.error('Failed to refresh cache size:', error);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>キャッシュ管理</h3>
      
      {/* キャッシュサイズ表示 */}
      <div className={styles.cacheInfo}>
        <div className={styles.cacheSize}>
          <span>キャッシュサイズ: </span>
          {cacheSize ? (
            <span className={styles.sizeValue}>
              {cacheSize.sizeInMB}MB
            </span>
          ) : (
            <span className={styles.loading}>読み込み中...</span>
          )}
        </div>
        <button 
          onClick={handleRefreshCacheSize}
          className={styles.refreshButton}
          disabled={isLoading}
        >
          🔄
        </button>
      </div>

      {/* 操作ボタン */}
      <div className={styles.buttonGroup}>
        <button
          onClick={handleClearImageCache}
          className={styles.button}
          disabled={isLoading}
        >
          🖼️ 画像キャッシュクリア
        </button>
        
        <button
          onClick={handleForceReloadImages}
          className={styles.button}
          disabled={isLoading}
        >
          🔄 画像強制リロード
        </button>
        
        <button
          onClick={handleOptimizeForMobile}
          className={styles.button}
          disabled={isLoading}
        >
          📱 スマホ最適化
        </button>
        
        <button
          onClick={handleClearAllCache}
          className={`${styles.button} ${styles.dangerButton}`}
          disabled={isLoading}
        >
          🗑️ 全キャッシュクリア
        </button>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div className={styles.message}>
          {message}
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          処理中...
        </div>
      )}

      {/* 説明 */}
      <div className={styles.description}>
        <h4>各機能の説明:</h4>
        <ul>
          <li><strong>画像キャッシュクリア:</strong> 古い画像のキャッシュを削除</li>
          <li><strong>画像強制リロード:</strong> 現在表示中の画像を最新版で再読み込み</li>
          <li><strong>スマホ最適化:</strong> モバイル向けにキャッシュを最適化</li>
          <li><strong>全キャッシュクリア:</strong> 全てのキャッシュを削除（注意が必要）</li>
        </ul>
      </div>
    </div>
  );
}
