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
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        fontSize: '2rem', 
        marginBottom: '2rem',
        color: '#333'
      }}>
        Music8 にログイン
      </h1>
      
      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Spotifyアカウントでログインして、音楽を楽しみましょう
        </p>
        
        <button
          onClick={handleSpotifySignIn}
          disabled={isLoading}
          style={{
            backgroundColor: '#1DB954',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            width: '100%'
          }}
        >
          {isLoading ? 'ログイン中...' : 'Spotifyでログイン'}
        </button>
      </div>
      
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
  );
} 