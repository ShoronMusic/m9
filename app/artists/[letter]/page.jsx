import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ArtistLetterPageClient from './ArtistLetterPageClient';
import fs from 'fs/promises';
import path from 'path';

// 有効なアルファベットと数字のリスト
const validLetters = [...Array(26)].map((_, i) => String.fromCharCode(65 + i).toLowerCase()).concat('0-9');

export async function generateMetadata({ params }) {
  const awaitedParams = await params;
  const letter = awaitedParams.letter.toLowerCase();
  if (!validLetters.includes(letter)) {
    return {
      title: 'Not Found',
      description: 'The requested page could not be found'
    };
  }
  return {
    title: `${letter.toUpperCase()} - Artists | Music8`,
    description: `Artists starting with ${letter.toUpperCase()} on Music8`
  };
}

export async function generateStaticParams() {
  // ページ番号は後でISR/SSGで拡張可能
  return validLetters.map(letter => ({
    letter: letter
  }));
}

export const revalidate = 43200; // 12時間ごとにISR

export default async function ArtistLetterPage({ params, searchParams }) {
  const awaitedParams = await params;
  const letter = awaitedParams.letter.toLowerCase();
  // ページ番号（クエリやparams.pageから取得、なければ1）
  const page = searchParams?.page ? parseInt(searchParams.page, 10) : 1;

  if (!validLetters.includes(letter) || isNaN(page) || page < 1) {
    notFound();
  }

  // 分割JSONから該当ページを読み込む → 全ページ分を合成
  let artists = [];
  let total = 0;
  let perPage = 50;
  try {
    // ISR/SSG/SSRでローカル・リモート自動切り替え
    const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
    const dirPath = isRemote
      ? null
      : path.join(process.cwd(), 'public', 'data', 'artistlist', letter.toUpperCase());
    let pageNum = 1;
    while (true) {
      let json = null;
      try {
        if (isRemote) {
          // 外部サーバーからfetch
          const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
          const res = await fetch(`${baseUrl}artistlist/${letter.toUpperCase()}/${pageNum}.json`);
          if (!res.ok) break;
          json = await res.json();
        } else {
          // ローカルファイル
          const filePath = path.join(dirPath, `${pageNum}.json`);
          const data = await fs.readFile(filePath, 'utf8');
          json = JSON.parse(data);
        }
        if (!json.artists || json.artists.length === 0) break;
        artists.push(...json.artists);
        if (json.total) total = json.total;
        if (json.perPage) perPage = json.perPage;
        pageNum++;
      } catch {
        break;
      }
    }
  } catch (e) {
    // ファイルがなければ404
    notFound();
  }

  return (
    <Suspense fallback={<div>{letter.toUpperCase()}から始まるアーティストを読み込み中...</div>}>
      <ArtistLetterPageClient 
        letter={letter.toUpperCase()} 
        artists={artists}
        page={page}
        total={total}
        perPage={perPage}
      />
    </Suspense>
  );
} 
