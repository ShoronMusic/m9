// src/app/genres/page.jsx

import { notFound } from 'next/navigation';
import { promises as fs } from 'fs';
import path from 'path';
import GenresPageClient from "./GenresPageClient";

async function getAllGenresGrouped() {
  const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
  const baseUrl = isRemote ? "https://xs867261.xsrv.jp/data/data/" : `file://${path.join(process.cwd(), "public", "data")}`;

  try {
    let genresData;
    if (isRemote) {
      const res = await fetch(`${baseUrl}genres.json`);
      if (!res.ok) throw new Error('Failed to fetch genres from remote URL.');
      genresData = await res.json();
    } else {
      const filePath = path.join(process.cwd(), "public", "data", "genres.json");
      const fileContent = await fs.readFile(filePath, 'utf-8');
      genresData = JSON.parse(fileContent);
    }
    
    if (!Array.isArray(genresData)) {
      console.error("Error: genres.json data is not an array.");
      return null;
    }
    
    // Group genres by the first letter
    const grouped = genresData.reduce((acc, genre) => {
      if (typeof genre.name !== 'string' || genre.name.length === 0) {
        return acc; // Skip entries without a valid name
      }
      let firstLetter = genre.name.charAt(0).toUpperCase();
      if (!/^[A-Z]$/.test(firstLetter)) {
        firstLetter = '0-9';
      }
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(genre);
      return acc;
    }, {});

    // Sort genres within each group alphabetically
    for (const key in grouped) {
      grouped[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return grouped;
    
  } catch (error) {
    console.error("Error fetching or parsing genres.json:", error);
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
