'use client';

import { useCallback, useEffect } from 'react';

// リモートモバイルログ送信システム
export function RemoteMobileLogger() {
  // 環境に応じてログ送信先を決定
  const getLogEndpoint = () => {
    if (typeof window === 'undefined') return null;
    
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // 本番環境の場合
    if (hostname === 'www.tunedive.com' || hostname === 'tunedive.com') {
      return `${protocol}//${hostname}/api/remote-logs`;
    }
    
    // ローカル環境の場合
    if (hostname === 'localhost' || hostname.includes('192.168.')) {
      return '/api/mobile-logs';
    }
    
    // その他の環境（ステージングなど）
    return '/api/remote-logs';
  };

  // ログを送信する関数
  const sendLog = useCallback(async (level, type, message, details = {}) => {
    try {
      // ブラウザ環境でのみ実行
      if (typeof window === 'undefined') return;

      const endpoint = getLogEndpoint();
      if (!endpoint) return;

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
        url: window.location.href,
        hostname: window.location.hostname,
        environment: window.location.hostname === 'localhost' ? 'development' : 'production'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        console.warn('Failed to send remote log:', response.status);
      } else {
        console.log('Remote log sent successfully:', type, message);
      }
    } catch (error) {
      console.warn('Failed to send remote log:', error);
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
    logInfo('リモートモバイルロガーが初期化されました', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      environment: window.location.hostname === 'localhost' ? 'development' : 'production',
      endpoint: getLogEndpoint()
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
export function useRemoteMobileLogger() {
  const getLogEndpoint = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname === 'www.tunedive.com' || hostname === 'tunedive.com') {
      return `${protocol}//${hostname}/api/remote-logs`;
    }
    
    if (hostname === 'localhost' || hostname.includes('192.168.')) {
      return '/api/mobile-logs';
    }
    
    return '/api/remote-logs';
  }, []);

  const sendLog = useCallback(async (level, type, message, details = {}) => {
    try {
      if (typeof window === 'undefined') return;

      const endpoint = getLogEndpoint();
      if (!endpoint) return;

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
        url: window.location.href,
        hostname: window.location.hostname,
        environment: window.location.hostname === 'localhost' ? 'development' : 'production'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        console.warn('Failed to send remote log:', response.status);
      }
    } catch (error) {
      console.warn('Failed to send remote log:', error);
    }
  }, [getLogEndpoint]);

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
