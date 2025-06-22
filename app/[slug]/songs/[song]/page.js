import SongDetailClient from "./SongDetailClient";
import { notFound } from 'next/navigation';

const API_BASE_URL = 'https://xs867261.xsrv.jp/data/data';

async function getSongData(slug, song) {
  try {
    const filePath = `${API_BASE_URL}/songs/${slug}_${song}.json`;
    const res = await fetch(filePath, {
      next: { revalidate: 0 },
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    if (!data || typeof data !== 'object') {
      return null;
    }

    if (!data.title || !data.artists) {
      return null;
    }

    return data;
  } catch (error) {
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

  const artistNames = songData.artists?.map(a => a.name).join(", ") || "Unknown Artist";
  const description = `Artist: ${artistNames} | Title: ${songData.title} | Release: ${songData.releaseDate}`;

  return (
    <SongDetailClient songData={songData} description={description} />
  );
}

export const revalidate = 43200; // 12時間ごとに再生成 
