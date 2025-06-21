// src/app/genres/[genre]/[page]/page.jsx

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import fs from 'fs/promises';
import path from 'path';
import GenrePageClient from './GenrePageClient';
import { config } from '@/config/config';

export const revalidate = 43200; // 12時間ごとに再生成

async function getGenreData(genre) {
  const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
  const baseUrl = process.env.DATA_BASE_URL || 'https://xs867261.xsrv.jp/data/data/';
  
  try {
    if (isRemote) {
      // リモートURLのパスを修正
      const [pageRes, songsRes] = await Promise.all([
        fetch(`${baseUrl}genres/pages/${genre}.json`),
        fetch(`${baseUrl}genres/songs/${genre}.json`)
      ]);

      if (!pageRes.ok || !songsRes.ok) {
        console.error(`[getGenreData] Failed to fetch genre data: ${pageRes.status} ${pageRes.statusText} or ${songsRes.status} ${songsRes.statusText}`);
        return null;
      }

      const [genreInfo, songsData] = await Promise.all([
        pageRes.json(),
        songsRes.json()
      ]);

      return {
        ...genreInfo,
        songs: Array.isArray(songsData.songs) ? songsData.songs : []
      };
    } else {
      const pagePath = path.join(process.cwd(), 'public', 'data', 'genres', 'pages', `${genre}.json`);
      const songsPath = path.join(process.cwd(), 'public', 'data', 'genres', 'songs', `${genre}.json`);
      
      const [pageFile, songsFile] = await Promise.all([
        fs.readFile(pagePath, 'utf-8'),
        fs.readFile(songsPath, 'utf-8')
      ]);
      
      const genreInfo = JSON.parse(pageFile);
      const songsData = JSON.parse(songsFile);
      
      return {
        ...genreInfo,
        songs: Array.isArray(songsData.songs) ? songsData.songs : []
      };
    }
  } catch (error) {
    console.error('[getGenreData] Error:', error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { genre, page } = params;
  const pageNum = parseInt(page, 10);
  const genreMetaData = await getGenreData(genre);
  const genreName = genreMetaData?.name || genre;

  return {
    title: pageNum === 1
      ? `${genreName} | ${config?.site?.name || 'Music8'}`
      : `${genreName} - Page ${pageNum} | ${config?.site?.name || 'Music8'}`,
    description: `${genreName} genre music list. Find songs in the ${genreName} genre. Page ${pageNum}.`,
    openGraph: {
      title: `${genreName} - Page ${pageNum} | ${config?.site?.name || 'Music8'}`,
      description: `${genreName} genre music list. Page ${pageNum}.`,
      type: 'website',
    },
  };
}

export default async function Page({ params }) {
  const { genre, page } = params;
  const pageNum = parseInt(page, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    notFound();
  }

  const genreData = await getGenreData(genre);
  console.log('page.jsx genreData:', genreData);

  if (!genreData) {
    notFound();
  }

  // ページネーション
  const ITEMS_PER_PAGE = 20;
  const total = genreData.songs.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startIndex = (pageNum - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // 公開年月でソート
  const sortedSongs = [...genreData.songs].sort((a, b) => {
    const dateA = a.releaseDate || a.date || a.post_date || '';
    const dateB = b.releaseDate || b.date || b.post_date || '';
    return new Date(dateB) - new Date(dateA); // 降順（新しい順）
  });

  const posts = sortedSongs.slice(startIndex, endIndex);

  return (
    <Suspense fallback={<div>Loading genre songs...</div>}>
      <GenrePageClient
        genreSlug={genre}
        pageNumber={pageNum}
        genreSonglist={{
          posts,
          total,
          totalPages
        }}
        genreName={genreData.name}
        genreDescription={genreData.description}
      />
    </Suspense>
  );
}
