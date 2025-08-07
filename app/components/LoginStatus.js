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

  if (session) {
    return (
      <div className={styles.container}>
        <img 
            src="/svg/spotify.svg"
            alt="Spotify"
            className={styles.spotifyIcon}
        />
        <div className={styles.userInfo}>
            <Image 
                src={session.user.image} 
                alt={session.user.name} 
                width={30} 
                height={30} 
                className={styles.avatar}
            />
            <span className={styles.userName}>{session.user.name}</span>
        </div>
        <div className={styles.userActions}>
          <Link href="/mypage" className={styles.mypageLink}>
            マイページ
          </Link>
          <button onClick={() => signOut()} className={styles.loginButton}>
            Sign Out
          </button>
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
              src="/svg/spotify.svg"
              alt="Spotify"
              className={styles.spotifyIcon}
              style={{ width: '16px', height: '16px', marginRight: '8px' }}
            />
            Sign in with Spotify
          </button>
        </Link>
      </div>
    </div>
  );
} 