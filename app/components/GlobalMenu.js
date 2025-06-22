// components/GlobalMenu.js

import Link from 'next/link';
import styles from './GlobalMenu.module.css';

export default function GlobalMenu() {
  return (
    <nav className={styles.globalMenu}>
      <ul className={styles.gmenu}>
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/styles">Styles</Link>
        </li>
        <li>
          <Link href="/artists">Artists</Link>
        </li>
        <li>
          <Link href="/genres">Genres</Link>
        </li>
        <li>
          <Link href="/info">About</Link>
        </li>
      </ul>
    </nav>
  );
}
