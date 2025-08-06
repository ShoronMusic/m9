"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignIn() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSpotifySignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("spotify", { callbackUrl: "/" });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 既にログインしている場合はリダイレクト
    getSession().then((session) => {
      if (session) {
        router.push("/");
      }
    });
  }, [router]);

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
        color: 'var(--tunedive-text-primary)'
      }}>
        TuneDive にログイン
      </h1>
      
      <div style={{ 
        backgroundColor: 'var(--tunedive-surface)', 
        padding: '20px', 
        borderRadius: '12px',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <p style={{ marginBottom: '1rem', color: 'var(--tunedive-text-secondary)' }}>
          Spotifyアカウントでログインして、音楽の深層に潜りましょう
        </p>
        
        <button
          onClick={handleSpotifySignIn}
          disabled={isLoading}
          style={{
            backgroundColor: '#1DB954',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            width: '100%',
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 2px 4px rgba(29, 185, 84, 0.3)'
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 8px rgba(29, 185, 84, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 4px rgba(29, 185, 84, 0.3)';
            }
          }}
        >
          {isLoading ? 'ログイン中...' : 'Spotifyでログイン'}
        </button>
      </div>
      
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
  );
} 