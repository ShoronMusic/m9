'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import Image from 'next/image';
import styles from './LoginStatus.module.css';

export default function LoginStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className={styles.loginButton}>Loading...</div>;
  }

  if (session) {
    return (
      <div className={styles.userInfo}>
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={30}
            height={30}
            className={styles.avatar}
          />
        )}
        <span className={styles.userName}>{session.user.name}</span>
        <button onClick={() => signOut()} className={styles.loginButton}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => signIn("spotify")} className={styles.loginButton}>
      Sign in with Spotify
    </button>
  );
} 