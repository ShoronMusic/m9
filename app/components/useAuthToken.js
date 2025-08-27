'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export const useAuthToken = () => {
  const { data: session, status } = useSession();
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  // トークンの有効性をチェック
  const checkTokenValidity = useCallback(async () => {
    if (!session?.accessToken) {
      setIsTokenValid(false);
      setTokenError('アクセストークンがありません');
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
        return true;
      } else if (response.status === 401) {
        setIsTokenValid(false);
        setTokenError('トークンが無効です。再ログインが必要です');
        return false;
      } else {
        setIsTokenValid(false);
        setTokenError(`API エラー: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setIsTokenValid(false);
      setTokenError('ネットワークエラーが発生しました');
      return false;
    }
  }, [session?.accessToken]);

  // セッション状態が変更されたときにトークンの有効性をチェック
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      checkTokenValidity();
    } else if (status === 'unauthenticated') {
      setIsTokenValid(false);
      setTokenError(null);
    }
  }, [status, session, checkTokenValidity]);

  // トークンリフレッシュを試行
  const refreshToken = useCallback(async () => {
    if (status === 'authenticated') {
      // NextAuthのセッション更新を試行
      try {
        await checkTokenValidity();
        return isTokenValid;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      }
    }
    return false;
  }, [status, checkTokenValidity, isTokenValid]);

  // 再ログインを実行
  const handleReLogin = useCallback(() => {
    signIn('spotify');
  }, []);

  // ログアウトを実行
  const handleLogout = useCallback(() => {
    signOut();
  }, []);

  return {
    session,
    status,
    isTokenValid,
    tokenError,
    checkTokenValidity,
    refreshToken,
    handleReLogin,
    handleLogout,
  };
};
