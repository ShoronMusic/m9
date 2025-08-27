'use client';

import { useEffect, useRef, useCallback } from 'react';

export default function MobileLifecycleManager({ 
  onAppActive, 
  onAppInactive, 
  onNetworkChange,
  onOrientationChange,
  onResize,
  children 
}) {
  const isActive = useRef(true);
  const lastActivityTime = useRef(Date.now());
  const activityTimeoutRef = useRef(null);
  const networkStatusRef = useRef(navigator.onLine);

  // アプリの可視性変更を監視
  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    const now = Date.now();
    
    if (isVisible && !isActive.current) {
      // アプリがアクティブになった
      isActive.current = true;
      lastActivityTime.current = now;
      
      if (onAppActive) {
        onAppActive();
      }
      
      console.log('📱 App became active');
    } else if (!isVisible && isActive.current) {
      // アプリが非アクティブになった
      isActive.current = false;
      
      if (onAppInactive) {
        onAppInactive();
      }
      
      console.log('📱 App became inactive');
    }
  }, [onAppActive, onAppInactive]);

  // ページフォーカス/ブラーイベントを監視
  const handleFocus = useCallback(() => {
    if (!isActive.current) {
      isActive.current = true;
      lastActivityTime.current = Date.now();
      
      if (onAppActive) {
        onAppActive();
      }
      
      console.log('📱 Page focused');
    }
  }, [onAppActive]);

  const handleBlur = useCallback(() => {
    if (isActive.current) {
      isActive.current = false;
      
      if (onAppInactive) {
        onAppInactive();
      }
      
      console.log('📱 Page blurred');
    }
  }, [onAppInactive]);

  // ネットワーク状態の変更を監視
  const handleOnline = useCallback(() => {
    const wasOffline = !networkStatusRef.current;
    networkStatusRef.current = true;
    
    if (wasOffline && onNetworkChange) {
      onNetworkChange(true);
    }
    
    console.log('📱 Network: Online');
  }, [onNetworkChange]);

  const handleOffline = useCallback(() => {
    const wasOnline = networkStatusRef.current;
    networkStatusRef.current = false;
    
    if (wasOnline && onNetworkChange) {
      onNetworkChange(false);
    }
    
    console.log('📱 Network: Offline');
  }, [onNetworkChange]);

  // 画面の向き変更を監視
  const handleOrientationChange = useCallback(() => {
    if (onOrientationChange) {
      const orientation = window.screen.orientation?.type || 'unknown';
      onOrientationChange(orientation);
    }
    
    console.log('📱 Orientation changed:', window.screen.orientation?.type);
  }, [onOrientationChange]);

  // ウィンドウサイズ変更を監視
  const handleResize = useCallback(() => {
    if (onResize) {
      const dimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth <= 768,
        isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
        isDesktop: window.innerWidth > 1024
      };
      onResize(dimensions);
    }
  }, [onResize]);

  // タッチイベントの監視（モバイル特有）
  const handleTouchStart = useCallback(() => {
    lastActivityTime.current = Date.now();
    
    // アクティビティタイムアウトをリセット
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    // 5分間アクティビティがない場合、非アクティブ状態にする
    activityTimeoutRef.current = setTimeout(() => {
      if (isActive.current) {
        isActive.current = false;
        
        if (onAppInactive) {
          onAppInactive();
        }
        
        console.log('📱 App inactive due to inactivity timeout');
      }
    }, 5 * 60 * 1000); // 5分
  }, [onAppInactive]);

  // スクロールイベントの監視（モバイル特有）
  const handleScroll = useCallback(() => {
    lastActivityTime.current = Date.now();
  }, []);

  // キーボードイベントの監視（モバイル特有）
  const handleKeyDown = useCallback(() => {
    lastActivityTime.current = Date.now();
  }, []);

  // 初期化
  useEffect(() => {
    // 初期状態を設定
    isActive.current = document.visibilityState === 'visible';
    lastActivityTime.current = Date.now();
    networkStatusRef.current = navigator.onLine;

    // イベントリスナーを追加
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    // 初期サイズ情報を送信
    handleResize();

    // クリーンアップ
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('keydown', handleKeyDown);
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [
    handleVisibilityChange,
    handleFocus,
    handleBlur,
    handleOnline,
    handleOffline,
    handleOrientationChange,
    handleResize,
    handleTouchStart,
    handleScroll,
    handleKeyDown
  ]);

  // 子コンポーネントをレンダリング
  return children;
}
