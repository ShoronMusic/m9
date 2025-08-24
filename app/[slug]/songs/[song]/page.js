import SongDetailClient from "./SongDetailClient";
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import fs from 'fs/promises';
import path from 'path';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

async function getSongData(slug, song) {
  try {
    let data;
    
    if (process.env.NODE_ENV === 'development') {
      // ローカル環境ではローカルファイルを使用
      const filePath = path.join(process.cwd(), 'public', 'data', 'songs', `${slug}_${song}.json`);
      const fileContents = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(fileContents);
    } else {
      // 本番環境ではリモートURLを使用
      const remoteUrl = `https://xs867261.xsrv.jp/data/data/songs/${slug}_${song}.json`;
      console.log('🔍 Fetching from remote URL:', remoteUrl);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
        
        const response = await fetch(remoteUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'TuneDive-Server/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error('❌ Remote fetch failed:', response.status, response.statusText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        data = await response.json();
        console.log('✅ Remote data fetched successfully:', {
          title: data?.title,
          artists: data?.artists?.length,
          hasContent: !!data?.content
        });
      } catch (fetchError) {
        console.error('❌ Remote fetch error:', fetchError.message);
        if (fetchError.name === 'AbortError') {
          throw new Error('Remote data fetch timeout');
        }
        throw fetchError;
      }
    }

    // より厳密なデータ検証
    if (!data || typeof data !== 'object') {
      console.error(`Invalid data format for ${slug}_${song}.json`);
      return null;
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
      console.error(`Missing or invalid title for ${slug}_${song}.json`);
      return null;
    }

    if (!data.artists || !Array.isArray(data.artists) || data.artists.length === 0) {
      console.error(`Missing or empty artists array for ${slug}_${song}.json`);
      return null;
    }

    // artists配列の各要素を検証
    for (const artist of data.artists) {
      if (!artist || typeof artist !== 'object' || !artist.name || typeof artist.name !== 'string') {
        console.error(`Invalid artist data in ${slug}_${song}.json`);
        return null;
      }
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
  
  try {
    const songData = await getSongData(slug, song);

    if (!songData) {
      console.error(`Song data not found for slug: ${slug}, song: ${song}`);
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
        slug={slug}
      />
    );
  } catch (error) {
    console.error(`Unexpected error in SongDetailPage for ${slug}/${song}:`, error);
    notFound();
  }
}

export const revalidate = 43200; // 12時間ごとに再生成 
