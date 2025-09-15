'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './LoginStatus.module.css';

export default function LoginStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loginStatus}>
          <div className={styles.loadingText}>Loading...</div>
        </div>
      </div>
    );
  }

  // セッションエラーがある場合
  if (session?.error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorStatus}>
          <div className={styles.errorText}>
            認証エラーが発生しました。再ログインしてください。
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className={styles.retryButton}
          >
            再ログイン
          </button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className={styles.container}>
        <div className={styles.userStatus}>
          <img 
              src="/svg/spotify.svg"
              alt="Spotify"
              className={styles.spotifyIcon}
          />
          <span className={styles.spotifyText}>Connected</span>
          <Image 
              src={session.user.image} 
              alt={session.user.name} 
              width={30} 
              height={30} 
              className={styles.avatar}
          />
          <Link href="/mypage" className={styles.mypageLink}>
            My Page
          </Link>
        </div>
      </div>
    );
  }

  // ログイン前の状態
  return (
    <div className={styles.container}>
      <div className={styles.loginStatus}>
        <div className={styles.loginPrompt}>
          <span className={styles.loginText}>Sign in to continue</span>
        </div>
        <Link href="/api/auth/signin/spotify" passHref>
          <button className={styles.loginButton}>
            <img 
              src="/icons/Spotify_Icon_RGB_White.png"
              alt="Spotify"
              className={styles.spotifyIcon}
              style={{ width: '20px', height: '20px', marginRight: '8px' }}
            />
            Sign in with Spotify
          </button>
        </Link>
      </div>
    </div>
  );
} 