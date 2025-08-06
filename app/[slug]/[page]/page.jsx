import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ArtistPageClient from './ArtistPageClient';
import Layout from '@/components/Layout'; // This can be removed if Layout is handled globally
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

// --- Consolidated Data Fetching Logic ---
const dataDir = path.join(process.cwd(), 'public', 'data');
const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");

async function fetchData(url, retries = 3) {
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウトに延長
        
        const res = await fetch(`${baseUrl}${url}`, {
          signal: controller.signal,
          headers: {
            		'User-Agent': 'TuneDive-App/1.0',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          // 大きなファイルのキャッシュを無効化
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.error(`HTTP ${res.status} for ${url}`);
          if (attempt === retries) return null;
          continue;
        }
        
        return await res.json();
      } catch (error) {
        console.error(`Fetch attempt ${attempt} failed for ${url}:`, error.message);
        if (attempt === retries) return null;
        
        // リトライ前に少し待機
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return null;
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
  const data = await fetchData(`artists/${slug}.json`);
  console.log(`Artist data for ${slug}:`, data);
  
  // データが取得できない場合のフォールバック
  if (!data) {
    console.error(`Failed to fetch artist data for ${slug}`);
    return null;
  }
  
  // データの構造を確認
  if (!data.name && !data.title) {
    console.error(`Invalid artist data structure for ${slug}:`, data);
    return null;
  }
  
  return data;
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

  // セッションからaccessTokenを取得
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken || null;

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
        accessToken={accessToken}
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
  // 大きなファイルのキャッシュエラーを回避するため、静的生成を制限
  // 本番環境では動的ルーティングを使用
  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  try {
    const artists = await fetchData('artists.json');
    if (!artists || !Array.isArray(artists)) return [];

    // 開発環境では最初の100件のみを静的生成
    const limitedArtists = artists.slice(0, 100);
    const params = [];
    
    for (const artist of limitedArtists) {
      if (artist.slug) {
        params.push({ slug: artist.slug, page: '1' });
      }
    }

    return params;
  } catch (error) {
    console.error('Error in generateStaticParams:', error);
    return [];
  }
}

// キャッシュ設定を調整
export const revalidate = 0; // 動的レンダリングを強制
export const dynamic = 'force-dynamic';