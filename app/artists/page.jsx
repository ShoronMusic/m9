// src/app/artists/page.jsx

import { Suspense } from 'react';
import { getAllArtists } from '@/lib/getArtistDetail';
import ArtistsPageClient from './ArtistsPageClient';
import fs from 'fs/promises';
import path from 'path';

export const metadata = {
  title: 'アーティスト一覧 | Music Database',
  description: 'アーティスト一覧ページ'
};

// キャッシュ設定を追加
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function ArtistsPage() {
  // アルファベットリスト
  const letters = [...Array(26)].map((_, i) => String.fromCharCode(65 + i)).concat('0-9');
  // 各アルファベットの全ページ分を取得
  const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
  const baseUrl = isRemote
    ? process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/"
    : path.join(process.cwd(), "public", "data", "artistlist") + path.sep;
  const artistsByLetter = {};
  for (const letter of letters) {
    artistsByLetter[letter] = [];
    let page = 1;
    while (true) {
      try {
        let json = null;
        if (isRemote) {
          // 外部サーバーからfetch
          const res = await fetch(`${baseUrl}artistlist/${letter}/${page}.json`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          if (!res.ok) break;
          json = await res.json();
        } else {
          // ローカルファイル
          const filePath = path.join(baseUrl, letter, `${page}.json`);
          const data = await fs.readFile(filePath, 'utf8');
          json = JSON.parse(data);
        }
        if (!json.artists || json.artists.length === 0) break;
        artistsByLetter[letter].push(...json.artists);
        page++;
      } catch (e) {
        break;
      }
    }
  }

  return (
    <Suspense fallback={<div>アーティスト一覧を読み込み中...</div>}>
      <ArtistsPageClient artistsByLetter={artistsByLetter} />
    </Suspense>
  );
}
