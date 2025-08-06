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
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        fontSize: '2rem', 
        marginBottom: '2rem',
        color: '#d32f2f'
      }}>
        認証エラー
      </h1>
      
      <div style={{ 
        backgroundColor: '#ffebee', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '2rem',
        border: '1px solid #f44336'
      }}>
        <p style={{ marginBottom: '1rem', color: '#d32f2f' }}>
          {getErrorMessage(error)}
        </p>
        
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
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
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          再試行
        </button>
        
        <button
          onClick={() => router.push('/')}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
} 