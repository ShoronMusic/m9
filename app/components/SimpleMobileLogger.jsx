'use client';

import { useCallback, useEffect } from 'react';

// シンプルなモバイルログ送信システム
export function SimpleMobileLogger() {
  // ログを送信する関数
  const sendLog = useCallback(async (level, type, message, details = {}) => {
    try {
      // ブラウザ環境でのみ実行
      if (typeof window === 'undefined') return;

      const logEntry = {
        level,
        type,
        message,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        online: navigator.onLine,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      const response = await fetch('/api/mobile-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        console.warn('Failed to send log to server:', response.status);
      }
    } catch (error) {
      console.warn('Failed to send log to server:', error);
    }
  }, []);

  // エラーログを送信
  const logError = useCallback((error, context = {}) => {
    if (typeof window === 'undefined') return;
    sendLog('error', 'javascript_error', error.message || 'Unknown error', {
      stack: error.stack,
      context,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }, [sendLog]);

  // 警告ログを送信
  const logWarning = useCallback((message, details = {}) => {
    if (typeof window === 'undefined') return;
    sendLog('warning', 'warning', message, {
      ...details,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }, [sendLog]);

  // 情報ログを送信
  const logInfo = useCallback((message, details = {}) => {
    if (typeof window === 'undefined') return;
    sendLog('info', 'info', message, {
      ...details,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }, [sendLog]);

  // グローバルエラーハンドラーを設定
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 既存のエラーハンドラーを保存
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;

    // エラーハンドラーを設定
    window.onerror = (message, source, lineno, colno, error) => {
      logError(error || new Error(message), { source, lineno, colno });
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
    };

    // 未処理のPromise拒否ハンドラーを設定
    window.onunhandledrejection = (event) => {
      logError(event.reason, { type: 'unhandled_rejection' });
      if (originalOnUnhandledRejection) {
        return originalOnUnhandledRejection(event);
      }
    };

    // ページ離脱時のログ
    const handleBeforeUnload = () => {
      logInfo('ページを離脱しました', {
        url: window.location.href,
        timeSpent: Date.now() - performance.timing.navigationStart
      });
    };

    // ネットワーク状態変化のログ
    const handleOnline = () => {
      logInfo('ネットワーク接続が復旧しました');
    };

    const handleOffline = () => {
      logWarning('ネットワーク接続が切断されました');
    };

    // イベントリスナーを追加
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初期化ログ
    logInfo('シンプルモバイルロガーが初期化されました', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screen: {
        width: window.screen.width,
        height: window.screen.height
      }
    });

    // クリーンアップ関数
    return () => {
      window.onerror = originalOnError;
      window.onunhandledrejection = originalOnUnhandledRejection;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [logError, logInfo, logWarning]);

  // このコンポーネントはUIを表示しない
  return null;
}

// ログ送信用のフック
export function useSimpleMobileLogger() {
  const sendLog = useCallback(async (level, type, message, details = {}) => {
    try {
      // ブラウザ環境でのみ実行
      if (typeof window === 'undefined') return;

      const logEntry = {
        level,
        type,
        message,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        online: navigator.onLine,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      const response = await fetch('/api/mobile-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        console.warn('Failed to send log to server:', response.status);
      }
    } catch (error) {
      console.warn('Failed to send log to server:', error);
    }
  }, []);

  return {
    logError: useCallback((error, context = {}) => {
      if (typeof window === 'undefined') return;
      sendLog('error', 'javascript_error', error.message || 'Unknown error', {
        stack: error.stack,
        context,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    }, [sendLog]),
    
    logWarning: useCallback((message, details = {}) => {
      if (typeof window === 'undefined') return;
      sendLog('warning', 'warning', message, {
        ...details,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    }, [sendLog]),
    
    logInfo: useCallback((message, details = {}) => {
      if (typeof window === 'undefined') return;
      sendLog('info', 'info', message, {
        ...details,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    }, [sendLog])
  };
}
