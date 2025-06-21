// components/GlobalMenu.js

import Link from 'next/link';

export default function GlobalMenu() {
  return (
    <nav className="global-menu">
      <ul className="gmenu">
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

      <style jsx>{`
        .global-menu {
          margin-bottom: 20px;
        }
        .gmenu {
          list-style: none;
          display: flex;
          justify-content: center; /* 中央寄せの場合 */
          gap: 20px; /* 各項目の間隔 */
          padding: 0;
          margin: 0;
        }
        /* li 要素は flex コンテナの子要素として自動的に横並びになります */
      `}</style>
    </nav>
  );
}
