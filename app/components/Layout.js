// /components/Layout.js
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import GoogleLoginButton from "./GoogleLoginButton";
import GlobalMenu from "./GlobalMenu";
import { FaBars } from "react-icons/fa";
import styles from "./Layout.module.css";
import "../css/globals.css";
import ScrollToTopButton from "./ScrollToTopButton";
import LoginStatus from './LoginStatus';

export default function Layout({ children }) {
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const savedLockState = localStorage.getItem("isLocked");
    if (savedLockState) {
      setIsLocked(JSON.parse(savedLockState));
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const toggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    localStorage.setItem("isLocked", JSON.stringify(newLockState));
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logoTitle}>
          <Link href="/" className={styles.logoLink}>
            Music8
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

      {menuOpen && (
        <nav className={styles.mobileNav}>
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
            <div className={styles.buttonGroup}>
              <button onClick={goBack} className={styles.backButton}>
                <span>&lt; Back</span>
              </button>
              <button
                onClick={toggleLock}
                className={`${styles.lockButton} ${isLocked ? styles.locked : ""}`}
              >
                <span>{isLocked ? "Link Unlock" : "Link Lock"}</span>
              </button>
            </div>
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
    </>
  );
}