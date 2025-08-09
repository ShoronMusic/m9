// /components/Layout.js
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import GlobalMenu from "./GlobalMenu";
import { FaBars } from "react-icons/fa";
import styles from "./Layout.module.css";
import ScrollToTopButton from "./ScrollToTopButton";
import LoginStatus from './LoginStatus';
import { usePlayer } from "./PlayerContext";
import { useSession } from "next-auth/react";

export default function Layout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLocked, setIsLocked] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { toggleLock, currentTrack } = usePlayer();
  const { data: session } = useSession();

  // プレイヤーが表示されているかどうかを判定
  const isPlayerVisible = session && session.accessToken && currentTrack;

  useEffect(() => {
    const savedLockState = localStorage.getItem("isLocked");
    if (savedLockState) {
      setIsLocked(JSON.parse(savedLockState));
    }
  }, []);

  // モバイル判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    console.log('Toggle menu clicked, current state:', isMenuOpen);
    setMenuOpen(!isMenuOpen);
  };

  // デバッグ用：メニューの状態を監視
  useEffect(() => {
    console.log('Menu state changed:', isMenuOpen);
  }, [isMenuOpen]);

  return (
    <div className={`${styles.pageWrapper} ${isPlayerVisible ? styles.withPlayer : ''}`}>
      <header className={styles.header}>
        <div className={styles.logoTitle}>
          <Link href="/" className={styles.logoLink}>
            TuneDive
          </Link>
        </div>
        <nav className={styles.menu}>
          <GlobalMenu />
        </nav>
        <div className={styles.loginStatusContainer}>
          <LoginStatus />
        </div>
        <div className={styles.mobileMenu}>
          <FaBars onClick={toggleMenu} className={styles.menuIcon} />
        </div>
      </header>

      {/* モバイル表示でのみメニューを表示 */}
      {isMobile && (
        <nav className={`${styles.mobileNav} ${isMenuOpen ? styles.menuOpen : styles.menuClosed}`}>
          <GlobalMenu />
        </nav>
      )}

      {/* グローバルにArtistSearchを表示する場合 - 重複のためコメントアウトまたは削除 */}
      {/* <div className={styles.searchArea}>
        <ArtistSearch />
      </div> */}

      <div className={styles.container}>
        <div className={styles.content}>
          <main className={isLocked ? styles.locked : ""}>
            {pathname !== "/" && (
              <div className={styles.navigationButtons}>
                <button onClick={() => router.back()} className={styles.button}>
                  &lt; Back
                </button>
                <button onClick={toggleLock} className={`${styles.button} ${isLocked ? styles.lockedButton : ""}`}>
                  {isLocked ? "Unlock Link" : "Link Lock"}
                </button>
              </div>
            )}
            {children}
          </main>
          <footer style={{ textAlign: "left", marginTop: "40px", padding: "20px 0", borderTop: "1px solid #ccc" }}>
            <p style={{ margin: "0", fontSize: "0.9em", color: "#555" }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Many cover arts are provided by
                <a href="https://www.spotify.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <img
                    src="/images/Full_Logo_Black_RGB.svg"
                    alt="Spotify"
                    style={{ height: "21px", verticalAlign: "middle", marginLeft: "2px" }}
                  />
                </a>
              </span>
            </p>
            <div style={{ textAlign: "right", marginTop: "10px" }}>
              <ScrollToTopButton />
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}