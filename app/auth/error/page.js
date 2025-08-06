"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AuthError() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (error) => {
    switch (error) {
      case "spotify":
        return "Spotifyログインでエラーが発生しました。";
      case "Configuration":
        return "認証設定に問題があります。";
      case "AccessDenied":
        return "アクセスが拒否されました。";
      default:
        return "認証でエラーが発生しました。";
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'var(--tunedive-background)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <h1 style={{ 
        fontSize: '2rem', 
        marginBottom: '2rem',
        color: 'var(--tunedive-error)'
      }}>
        認証エラー
      </h1>
      
      <div style={{ 
        backgroundColor: 'var(--tunedive-surface)', 
        padding: '20px', 
        borderRadius: '12px',
        marginBottom: '2rem',
        border: '1px solid var(--tunedive-error)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ marginBottom: '1rem', color: 'var(--tunedive-error)' }}>
          {getErrorMessage(error)}
        </p>
        
        <p style={{ fontSize: '0.9rem', color: 'var(--tunedive-text-secondary)' }}>
          しばらく時間をおいてから再度お試しください。
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => router.push('/auth/signin')}
          style={{
            backgroundColor: '#1DB954',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 2px 4px rgba(29, 185, 84, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 4px 8px rgba(29, 185, 84, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 4px rgba(29, 185, 84, 0.3)';
          }}
        >
          再試行
        </button>
        
        <button
          onClick={() => router.push('/')}
          style={{
            backgroundColor: 'var(--tunedive-primary)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 2px 4px rgba(30, 58, 138, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 4px 8px rgba(30, 58, 138, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 4px rgba(30, 58, 138, 0.3)';
          }}
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
} 