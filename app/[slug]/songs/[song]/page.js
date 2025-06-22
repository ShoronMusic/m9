import SongDetailClient from "./SongDetailClient";
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import fs from 'fs/promises';
import path from 'path';

async function getSongData(slug, song) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'songs', `${slug}_${song}.json`);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContents);

    if (!data || typeof data !== 'object' || !data.title || !data.artists) {
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error reading song data for ${slug}_${song}.json:`, error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug, song } = params;
  const songData = await getSongData(slug, song);

  if (!songData) {
    return {
      title: 'Song Not Found',
      description: 'The requested song could not be found.'
    };
  }

  const artistNames = songData.artists?.map(a => a.name).join(", ") || "Unknown Artist";
  return {
    title: `${songData.title} - ${artistNames}`,
    description: `Lyrics and information for ${songData.title} by ${artistNames}`
  };
}

export default async function SongDetailPage({ params }) {
  const { slug, song } = params;
  const songData = await getSongData(slug, song);

  if (!songData) {
    notFound();
  }

  // セッションからアクセストークンを取得
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken || null;

  const artistNames = songData.artists?.map(a => a.name).join(", ") || "Unknown Artist";
  const description = `Artist: ${artistNames} | Title: ${songData.title} | Release: ${songData.releaseDate}`;

  return (
    <SongDetailClient 
      songData={songData} 
      description={description} 
      accessToken={accessToken}
    />
  );
}

export const revalidate = 43200; // 12時間ごとに再生成 
