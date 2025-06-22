import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ArtistPageClient from './ArtistPageClient';
import Layout from '@/components/Layout'; // This can be removed if Layout is handled globally
import fs from 'fs/promises';
import path from 'path';

// --- Consolidated Data Fetching Logic ---
const dataDir = path.join(process.cwd(), 'public', 'data');
const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");

async function fetchData(url) {
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    try {
      const res = await fetch(`${baseUrl}${url}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error(`Fetch failed for ${url}:`, error);
      return null;
    }
  } else {
    const filePath = path.join(dataDir, ...url.split('/'));
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // console.error(`Read file failed for ${filePath}:`, error);
      return null;
    }
  }
}

async function getArtistDetails(slug) {
  return await fetchData(`artists/${slug}.json`);
}

async function getArtistSongs(slug, page) {
  const data = await fetchData(`artists/${slug}/${page}.json`);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.songs)) return data.songs;
  if (Array.isArray(data.posts)) return data.posts;
  return [];
}

async function getAllArtistSongs(slug) {
  let allSongs = [];
    let pageNum = 1;
    while (true) {
        const songs = await getArtistSongs(slug, pageNum);
        if (songs.length === 0) break;
        allSongs = allSongs.concat(songs);
      pageNum++;
    }
    return allSongs;
}

// --- Page Component ---
export default async function ArtistPageWithPagination({ params }) {
  const { slug, page: pageStr } = params;
  const page = parseInt(pageStr, 10) || 1;

  if (!slug || isNaN(page)) {
    notFound();
  }

  const artistData = await getArtistDetails(slug);

  if (!artistData) {
    notFound();
  }

  const songs = await getArtistSongs(slug, page);
  const allSongs = await getAllArtistSongs(slug);
  const totalSongs = allSongs.length;
  const songsPerPage = 20;
  const totalPages = Math.ceil(totalSongs / songsPerPage);
  const startSongNumber = (page - 1) * songsPerPage + 1;
  const endSongNumber = Math.min(page * songsPerPage, totalSongs);

  return (
    <Suspense fallback={<div>Loading Artist...</div>}>
        <ArtistPageClient
        artistData={artistData}
        songs={songs}
        currentPage={page}
        totalPages={totalPages}
        totalSongs={totalSongs}
        startSongNumber={startSongNumber}
        endSongNumber={endSongNumber}
        allSongs={allSongs}
        />
      </Suspense>
  );
}

// --- Metadata and Static Generation ---
export async function generateMetadata({ params }) {
    const { slug } = params;
    const artistData = await getArtistDetails(slug);

    if (!artistData) {
        return {
            title: 'Artist Not Found',
            description: 'The requested artist could not be found.'
        };
    }

    const description = `Explore the songs and information for ${artistData.name}.`;

    return {
        title: `${artistData.name} | Artists`,
        description: description,
    };
}

export async function generateStaticParams() {
  // This can be computationally expensive if there are many artists and pages.
  // Consider limiting this or fetching a pre-built list of all artist slugs.
  const artists = await fetchData('artists.json');
  if (!artists) return [];

  const params = [];
  for (const artist of artists) {
    // This part is tricky as we don't know total pages without more requests.
    // Let's just generate for page 1 for now.
    params.push({ slug: artist.slug, page: '1' });
  }

  return params;
}

export const revalidate = 43200; // 12 hours