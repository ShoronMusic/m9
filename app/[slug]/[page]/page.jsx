import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ArtistPageClient from './ArtistPageClient';
import fs from 'fs/promises';
import path from 'path';

// --- Restore data fetching logic ---
const dataDir = path.join(process.cwd(), 'public', 'data');
const artistsDir = path.join(dataDir, 'artists'); // Correct directory for artist JSONs
const artistsJsonPath = path.join(dataDir, 'artists.json'); // Path to artists.json
const songsPerPage = 20; // Define globally for consistency

const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");

async function getArtistJsonBySlug(slug) {
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    const res = await fetch(`${baseUrl}artists/${slug}.json`);
    if (res.ok) return await res.json();
    return null;
  } else {
    const filePath = path.join(dataDir, 'artists', `${slug}.json`);
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(jsonString);
    } catch (error) {
      return null;
    }
  }
}

async function getSongsByArtistSlugAndPage(slug, page) {
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    const res = await fetch(`${baseUrl}artists/${slug}/${page}.json`);
    if (res.ok) {
      const songsData = await res.json();
      if (Array.isArray(songsData)) {
        return songsData;
      } else if (Array.isArray(songsData.songs)) {
        return songsData.songs;
      } else if (Array.isArray(songsData.posts)) {
        return songsData.posts;
      }
      return [];
    }
    return [];
  } else {
    const filePath = path.join(dataDir, 'artists', slug, `${page}.json`);
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const songsData = JSON.parse(jsonString);
      if (Array.isArray(songsData)) {
        return songsData;
      } else if (Array.isArray(songsData.songs)) {
        return songsData.songs;
      } else if (Array.isArray(songsData.posts)) {
        return songsData.posts;
      }
      return [];
    } catch (error) {
      return [];
    }
  }
}

// --- 全アーティストリストを読み込む (キャッシュ可能なら改善の余地あり) ---
let allArtistsList = null;
async function getAllArtistsList() {
  if (allArtistsList) return allArtistsList;
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    const res = await fetch(`${baseUrl}artists.json`);
    if (res.ok) {
      allArtistsList = await res.json();
      return allArtistsList;
    }
    allArtistsList = [];
    return allArtistsList;
  } else {
    try {
      const jsonString = await fs.readFile(artistsJsonPath, 'utf-8');
      allArtistsList = JSON.parse(jsonString);
    } catch (error) {
      allArtistsList = [];
    }
    return allArtistsList;
  }
}

async function getTotalPagesForArtist(slug) {
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    let pageNum = 1;
    while (true) {
      const res = await fetch(`${baseUrl}artists/${slug}/${pageNum}.json`);
      if (!res.ok) break;
      pageNum++;
    }
    return pageNum - 1 > 0 ? pageNum - 1 : 1;
  } else {
    const artistDir = path.join(dataDir, 'artists', slug);
    try {
      const files = await fs.readdir(artistDir);
      const pageFiles = files.filter(f => /^\d+\.json$/.test(f));
      return pageFiles.length > 0 ? pageFiles.length : 1;
    } catch {
      return 1;
    }
  }
}

// 全ページ分の曲を取得する関数を追加
async function getAllSongsByArtistSlug(slug) {
  let allSongs = [];
  if (isRemote) {
    const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
    let pageNum = 1;
    while (true) {
      const res = await fetch(`${baseUrl}artists/${slug}/${pageNum}.json`);
      if (!res.ok) break;
      const songsData = await res.json();
      if (Array.isArray(songsData)) {
        allSongs = allSongs.concat(songsData);
      } else if (Array.isArray(songsData.songs)) {
        allSongs = allSongs.concat(songsData.songs);
      } else if (Array.isArray(songsData.posts)) {
        allSongs = allSongs.concat(songsData.posts);
      }
      pageNum++;
    }
    return allSongs;
  } else {
    const artistDir = path.join(dataDir, 'artists', slug);
    try {
      const files = await fs.readdir(artistDir);
      const pageFiles = files.filter(f => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
      for (const file of pageFiles) {
        const filePath = path.join(artistDir, file);
        try {
          const jsonString = await fs.readFile(filePath, 'utf-8');
          const songsData = JSON.parse(jsonString);
          if (Array.isArray(songsData)) {
            allSongs = allSongs.concat(songsData);
          } else if (Array.isArray(songsData.songs)) {
            allSongs = allSongs.concat(songsData.songs);
          } else if (Array.isArray(songsData.posts)) {
            allSongs = allSongs.concat(songsData.posts);
          }
        } catch (e) {
          // 読み込み失敗時はスキップ
        }
      }
    } catch (e) {
      // ディレクトリがない場合など
    }
    return allSongs;
  }
}

async function getArtistDataForPage(slug, page) {
  try {
    const artistData = await getArtistJsonBySlug(slug);
    if (!artistData) return null;

    const artistsList = await getAllArtistsList();
    const artistListItem = artistsList.find(artist => artist.slug === slug);

    if (artistListItem && artistListItem.the_prefix !== undefined) {
      if (!artistData.acf) artistData.acf = {};
      artistData.acf.the_prefix = String(artistListItem.the_prefix);
    } else {
      if (artistData.acf) delete artistData.acf.the_prefix;
    }

    let members = [];
    if (artistData.acf && Array.isArray(artistData.acf.member)) {
      members = artistData.acf.member.map(m => ({
        name: m.name || 'Unknown Member',
        slug: m.slug || null,
        count: m.count || 0,
        the_prefix: m.the_prefix ?? null
      })).filter(m => m.slug);
    } else if (artistListItem && Array.isArray(artistListItem.member)) {
      members = artistListItem.member.map(m => ({
        name: m.name || 'Unknown Member',
        slug: m.slug || null,
        count: m.count || 0
      })).filter(m => m.slug);
    }

    let artistSongs = await getSongsByArtistSlugAndPage(slug, page);
    if (!Array.isArray(artistSongs)) artistSongs = [];
    const totalSongs = artistData.count || artistSongs.length;
    const currentPage = Math.max(1, page);
    const safeTotalPages = await getTotalPagesForArtist(slug);
    if (currentPage > safeTotalPages) return null;
    const paginatedSongs = artistSongs; // 1ページ分のみ

    // ★ここから全曲分で割合を計算するよう修正
    const allSongs = await getAllSongsByArtistSlug(slug);
    const styleIdToName = {
      2844: 'Pop', 4686: 'Dance', 2845: 'Alternative', 2846: 'Electronica',
      2847: 'R&B', 2848: 'Hip-Hop', 6703: 'Rock', 2849: 'Metal', 2873: 'Others'
    };
    let styleCounts = {}, totalStyledSongs = 0, genreCounts = {}, totalGenreSongs = 0;
    try {
      allSongs.forEach(song => {
        let hasStyleInSong = false, hasGenreInSong = false;
        if (song.style && Array.isArray(song.style)) {
          song.style.forEach(styleIdentifier => {
            let styleName = null;
            if (typeof styleIdentifier === 'number' && styleIdToName[styleIdentifier]) {
              styleName = styleIdToName[styleIdentifier];
            } else if (typeof styleIdentifier === 'string' && styleIdentifier.trim() !== '') {
              styleName = styleIdentifier.trim();
            } else if (typeof styleIdentifier === 'string' && styleIdentifier.startsWith('style-')) {
              const potentialName = styleIdentifier.substring(6);
              if (Object.keys(styleIdToName).some(key => styleIdToName[key].toLowerCase() === potentialName.toLowerCase())) {
                styleName = potentialName.charAt(0).toUpperCase() + potentialName.slice(1);
              }
            }
            if (styleName) {
              styleCounts[styleName] = (styleCounts[styleName] || 0) + 1;
              hasStyleInSong = true;
            }
          });
        }
        if (hasStyleInSong) totalStyledSongs++;
        if (song.genre_data && Array.isArray(song.genre_data)) {
          song.genre_data.forEach(genre => {
            if (genre && typeof genre.name === 'string' && genre.name.trim() !== '') {
              const genreName = genre.name.trim();
              genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
              hasGenreInSong = true;
            }
          });
        }
        if (hasGenreInSong) totalGenreSongs++;
      });
    } catch (error) {}
    const stylePercentages = Object.entries(styleCounts)
      .map(([style, count]) => ({ style, percentage: totalStyledSongs > 0 ? Math.round((count / totalStyledSongs) * 100) : 0 }))
      .filter(item => item.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);
    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, percentage: totalGenreSongs > 0 ? Math.round((count / totalGenreSongs) * 100) : 0 }))
      .filter(item => item.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);
    // ★ここまで
    let relatedArtists = [];
    if (artistData.acf && artistData.acf.related_artists) {
      relatedArtists = artistData.acf.related_artists.split('|').map(item => {
        const match = item.trim().match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          return { name: match[1].trim(), slug: match[2].trim() };
        }
        return null;
      }).filter(item => item !== null);
    }
    const startSongNumber = (currentPage - 1) * songsPerPage + 1;
    const endSongNumber = Math.min(currentPage * songsPerPage, totalSongs);
    return {
      artistData,
      songs: paginatedSongs,
      currentPage,
      totalPages: safeTotalPages,
      totalSongs,
      stylePercentages,
      topGenres,
      members,
      relatedArtists,
      startSongNumber,
      endSongNumber
    };
  } catch (error) {
    console.error('getArtistDataForPage error:', error, 'slug:', slug, 'page:', page);
    return null;
  }
}
// --- End of restored data fetching logic ---

// --- Implement generateStaticParams ---
export async function generateStaticParams() {
  return [];
}

export const revalidate = 43200; // 12時間ごとにISR再生成

// --- Restore generateMetadata ---
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const artistData = await getArtistJsonBySlug(resolvedParams.slug);

  if (!artistData) {
    return {
      title: 'Not Found',
      description: 'The requested artist could not be found'
    };
  }
  const pageNum = parseInt(resolvedParams.page, 10);
  const displayPage = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;
  return {
    title: `${artistData.name} (Page ${displayPage}) | Artist`,
    description: artistData.description || `Music by ${artistData.name}`
  };
}
// --- End of restored generateMetadata ---

export default async function ArtistPageWithPagination({ params }) {
  const page = params.page ? parseInt(params.page, 10) : 1;
  if (isNaN(page) || page < 1) {
    notFound();
  }
  const artistData = await getArtistDataForPage(params.slug, page);
  if (!artistData) {
    notFound();
  }
  const { posts, totalPages, ...restOfArtistData } = artistData;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ArtistPageClient 
        songs={posts} 
        artist={restOfArtistData}
        currentPage={page}
        totalPages={totalPages}
      />
    </Suspense>
  );
}