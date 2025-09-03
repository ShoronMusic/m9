'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

// ローカルストレージのキー
const SESSION_STATE_KEY = 'tunedive_session_state';
const LAST_CHECK_KEY = 'tunedive_last_check';

export const useAuthToken = () => {
  const { data: session, status, update } = useSession();
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const lastCheckTime = useRef(0);
  const checkInterval = useRef(null);
  const visibilityChangeHandler = useRef(null);

  // ローカルストレージから状態を復元
  const restoreSessionState = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedState = localStorage.getItem(SESSION_STATE_KEY);
        const savedLastCheck = localStorage.getItem(LAST_CHECK_KEY);
        
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          setIsTokenValid(parsedState.isTokenValid || false);
          setTokenError(parsedState.tokenError || null);
          setIsRecovering(parsedState.isRecovering || false);
        }
        
        if (savedLastCheck) {
          lastCheckTime.current = parseInt(savedLastCheck, 10) || 0;
        }
      }
    } catch (error) {
      console.error('Failed to restore session state:', error);
    }
  }, []);

  // 状態をローカルストレージに保存
  const saveSessionState = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        const stateToSave = {
          isTokenValid,
          tokenError,
          isRecovering,
          timestamp: Date.now()
        };
        localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(stateToSave));
        localStorage.setItem(LAST_CHECK_KEY, lastCheckTime.current.toString());
      }
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  }, [isTokenValid, tokenError, isRecovering]);

  // ローカルストレージの状態をクリア
  const clearSessionState = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_STATE_KEY);
        localStorage.removeItem(LAST_CHECK_KEY);
      }
    } catch (error) {
      console.error('Failed to clear session state:', error);
    }
  }, []);

  // トークンの有効性をチェック
  const checkTokenValidity = useCallback(async (forceCheck = false) => {
    const now = Date.now();
    
    // 強制チェックでない場合、前回のチェックから5分以内ならスキップ
    if (!forceCheck && (now - lastCheckTime.current) < 5 * 60 * 1000) {
      return isTokenValid;
    }

    if (!session?.accessToken) {
      setIsTokenValid(false);
      setTokenError('アクセストークンがありません');
      lastCheckTime.current = now;
      return false;
    }

    try {
      // Spotify APIを使用してトークンの有効性をチェック
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });

      if (response.ok) {
        setIsTokenValid(true);
        setTokenError(null);
        lastCheckTime.current = now;
        return true;
      } else if (response.status === 401) {
        setIsTokenValid(false);
        setTokenError('トークンが無効です。再ログインが必要です');
        lastCheckTime.current = now;
        return false;
      } else {
        setIsTokenValid(false);
        setTokenError(`API エラー: ${response.status}`);
        lastCheckTime.current = now;
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setIsTokenValid(false);
      setTokenError('ネットワークエラーが発生しました');
      lastCheckTime.current = now;
      return false;
    }
  }, [session?.accessToken, isTokenValid]);

  // セッション復旧を試行
  const attemptSessionRecovery = useCallback(async () => {
    if (status === 'authenticated' && !isTokenValid) {
      setIsRecovering(true);
      try {
        console.log('Attempting session recovery...');
        
        // NextAuthのセッション更新を試行
        const updatedSession = await update();
        
        if (updatedSession?.accessToken) {
          console.log('Session recovery successful');
          // 更新されたセッションでトークンの有効性をチェック
          const isValid = await checkTokenValidity(true);
          setIsRecovering(false);
          return isValid;
        } else {
          console.log('Session recovery failed - no access token');
          setIsRecovering(false);
          return false;
        }
      } catch (error) {
        console.error('Session recovery error:', error);
        setIsRecovering(false);
        return false;
      }
    }
    return false;
  }, [status, isTokenValid, update, checkTokenValidity]);

  // ページ可視性変更時の処理
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === 'visible') {
      console.log('Page became visible, checking session...');
      
      // ページが可視になった時点でセッション状態をチェック
      if (status === 'authenticated') {
        // 少し待ってからチェック（他の処理が完了するのを待つ）
        setTimeout(async () => {
          await checkTokenValidity(true);
        }, 1000);
      }
    }
  }, [status, checkTokenValidity]);

  // 初期化時に保存された状態を復元
  useEffect(() => {
    restoreSessionState();
  }, [restoreSessionState]);

  // 状態変更時にローカルストレージに保存
  useEffect(() => {
    saveSessionState();
  }, [saveSessionState]);

  // セッション状態が変更されたときにトークンの有効性をチェック
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      checkTokenValidity();
    } else if (status === 'unauthenticated') {
      setIsTokenValid(false);
      setTokenError(null);
      setIsRecovering(false);
      clearSessionState();
    }
  }, [status, session, checkTokenValidity, clearSessionState]);

  // 定期的なトークンチェック（5分間隔）
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      checkInterval.current = setInterval(() => {
        checkTokenValidity();
      }, 5 * 60 * 1000); // 5分間隔
    }

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [status, session, checkTokenValidity]);

  // ページ可視性の監視
  useEffect(() => {
    if (typeof document !== 'undefined') {
      visibilityChangeHandler.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', visibilityChangeHandler.current);
      
      return () => {
        if (visibilityChangeHandler.current) {
          document.removeEventListener('visibilitychange', visibilityChangeHandler.current);
        }
      };
    }
  }, [handleVisibilityChange]);

  // アプリのライフサイクルイベント（モバイル対応）
  useEffect(() => {
    const handleAppStateChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App became active, checking session...');
        setTimeout(async () => {
          if (status === 'authenticated') {
            await checkTokenValidity(true);
          }
        }, 1000);
      }
    };

    // ページフォーカス時の処理
    const handleFocus = () => {
      console.log('Page focused, checking session...');
      setTimeout(async () => {
        if (status === 'authenticated') {
          await checkTokenValidity(true);
        }
      }, 1000);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleAppStateChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleAppStateChange);
      }
    };
  }, [status, checkTokenValidity]);

  // トークンリフレッシュを試行
  const refreshToken = useCallback(async () => {
    if (status === 'authenticated') {
      return await attemptSessionRecovery();
    }
    return false;
  }, [status, attemptSessionRecovery]);

  // 再ログインを実行
  const handleReLogin = useCallback(() => {
    signIn('spotify');
  }, []);

  // ログアウトを実行
  const handleLogout = useCallback(() => {
    signOut();
    clearSessionState();
  }, [clearSessionState]);

  // 手動でセッション復旧を試行
  const handleManualRecovery = useCallback(async () => {
    return await attemptSessionRecovery();
  }, [attemptSessionRecovery]);

  // エラーをクリア
  const clearTokenError = useCallback(() => {
    setTokenError(null);
  }, []);

  return {
    session,
    status,
    isTokenValid,
    tokenError,
    isRecovering,
    checkTokenValidity,
    refreshToken,
    handleReLogin,
    handleLogout,
    handleManualRecovery,
    clearTokenError,
  };
};
