'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './LoginStatus.module.css';

export default function LoginStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className={styles.loginButton}>Loading...</div>;
  }

  if (session) {
    return (
      <div className={styles.container}>
        <img 
            src="/icons/Spotify_logo_without_text.svg" 
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
        <button onClick={() => signOut()} className={styles.loginButton}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Link href="/api/auth/signin/spotify" passHref>
      <button className={styles.loginButton}>Sign in with Spotify</button>
    </Link>
  );
} 