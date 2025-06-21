// src/app/genres/page.jsx

import { notFound } from 'next/navigation';
import GenresPageClient from './GenresPageClient';
import { promises as fs } from 'fs';
import path from 'path';

async function getAllGenresGrouped() {
  const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
  const baseUrl = process.env.DATA_BASE_URL || 'https://xs867261.xsrv.jp/data/data/';
  const filePath = path.join(process.cwd(), 'public', 'data', 'genres.json');
  
  try {
    let genres;
    if (isRemote) {
      const res = await fetch(`${baseUrl}genres.json`);
      if (!res.ok) {
        console.error(`[getAllGenresGrouped] Failed to fetch genres: ${res.status} ${res.statusText}`);
        return null;
      }
      genres = await res.json();
    } else {
      const file = await fs.readFile(filePath, 'utf-8');
      genres = JSON.parse(file);
    }

    if (!Array.isArray(genres)) {
      console.error('[getAllGenresGrouped] Invalid genres data format');
      return null;
    }

    // ジャンルをグループ化
    const grouped = genres.reduce((acc, genre) => {
      if (!genre?.name) return acc;
      const firstLetter = genre.name.charAt(0).toUpperCase();
      const groupKey = /^[0-9]/.test(firstLetter) ? "0-9" : firstLetter;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push({ ...genre, count: genre.count || 0 });
      return acc;
    }, {});

    // 各グループ内をアルファベット順にソート
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    });

    // 空のグループを追加
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const alphabetAndNumbers = ['0-9', ...alphabet, 'Other'];
    alphabetAndNumbers.forEach(letter => {
      if (!grouped[letter]) {
        grouped[letter] = [];
      }
    });

    return grouped;
  } catch (error) {
    console.error('[getAllGenresGrouped] Error:', error);
    return null;
  }
}

export async function generateMetadata() {
  return {
    title: 'Genres List | Music8',
    description: 'Discover our comprehensive genres list at Music8. Find your favorite music genres categorized alphabetically. Explore the diversity of music styles available on our platform.',
    openGraph: {
      title: 'Genres List | Music8',
      description: 'Explore diverse music genres at Music8. Browse our comprehensive collection of music styles, from classical to contemporary.',
      type: 'website',
    },
  };
}

export default async function GenresPage() {
  const genresGrouped = await getAllGenresGrouped();
  if (!genresGrouped) {
    notFound();
  }

  return <GenresPageClient genres={genresGrouped} />;
}

export const revalidate = 43200; // 12時間ごとに再生成
